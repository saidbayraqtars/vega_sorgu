// Tek etkin eşitleyici kilidi: aynı ayar klasörünü kullanan tepsi uygulaması ile
// Windows görevi (sunucu modu) aynı anda eşitleme yapmasın. Kilidi tutan süreç
// dosyayı 30 sn'de bir tazeler; 150 sn tazelenmeyen kilit bayat sayılır (çökme, uyku).

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const BEAT_MS = 30000;
const STALE_MS = 150000;

class Lock {
  constructor(dir, sahip = "kopru") {
    this.file = path.join(dir, "kopru.kilit");
    this.sahip = sahip;
    this.token = crypto.randomBytes(8).toString("hex");
    this.held = false;
    this.timer = null;
    this.onLost = null;
  }

  read() {
    try { return JSON.parse(fs.readFileSync(this.file, "utf8")); } catch { return null; }
  }

  // Bayat olmayan kilidin sahibi (yoksa null). Tazelik dosya zamanından okunur:
  // yarım yazılmış içerik yüzünden canlı kilit bayat sanılmasın.
  holder() {
    let st;
    try { st = fs.statSync(this.file); } catch { return null; }
    if (Date.now() - st.mtimeMs > STALE_MS) return null;
    return this.read() || { sahip: "?" };
  }

  tryAcquire() {
    if (this.held) return true;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    for (let i = 0; i < 2; i++) {
      try {
        const fd = fs.openSync(this.file, "wx");
        try { fs.writeSync(fd, JSON.stringify(this.payload())); } finally { fs.closeSync(fd); }
        this.held = true;
        this.timer = setInterval(() => this.beat(), BEAT_MS);
        if (this.timer.unref) this.timer.unref();
        return true;
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
        if (this.holder()) return false;
        try { fs.unlinkSync(this.file); } catch { /* başkası sildi */ }
      }
    }
    return false;
  }

  payload() {
    return { sahip: this.sahip, pid: process.pid, token: this.token, at: new Date().toISOString() };
  }

  beat() {
    if (!this.held) return;
    const l = this.read();
    if (l && l.token && l.token !== this.token) {
      // Uzun uyku sonrası kilit başkasına geçmiş
      this.held = false;
      clearInterval(this.timer);
      if (this.onLost) this.onLost();
      return;
    }
    try { fs.writeFileSync(this.file, JSON.stringify(this.payload())); } catch { /* yazılamadı; bir sonrakinde */ }
  }

  release() {
    clearInterval(this.timer);
    if (!this.held) return;
    this.held = false;
    const l = this.read();
    if (!l || l.token === this.token) {
      try { fs.unlinkSync(this.file); } catch { /* yok */ }
    }
  }
}

module.exports = { Lock, STALE_MS, BEAT_MS };
