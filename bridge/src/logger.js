// Köprü günlüğü: dönen dosya (2 MB dolunca .1'e taşınır) + bellekte son satırlar.
// Hem komut satırı/sunucu modu hem tepsi uygulaması kullanır.

const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

class Logger extends EventEmitter {
  constructor(file = null, { maxBytes = 2 * 1024 * 1024, keep = 300, echo = false } = {}) {
    super();
    this.file = file;
    this.maxBytes = maxBytes;
    this.keep = keep;
    this.echo = echo;
    this.lines = [];
    if (file) { try { fs.mkdirSync(path.dirname(file), { recursive: true }); } catch { /* yok */ } }
  }

  write(seviye, mesaj) {
    const kayit = { zaman: new Date().toISOString(), seviye, mesaj: String(mesaj) };
    this.lines.push(kayit);
    if (this.lines.length > this.keep) this.lines.splice(0, this.lines.length - this.keep);
    const line = `${kayit.zaman} ${seviye === "hata" ? "HATA " : seviye === "uyari" ? "UYARI " : ""}${kayit.mesaj}\n`;
    if (this.echo) (seviye === "hata" ? process.stderr : process.stdout).write(line);
    if (this.file) {
      try {
        let size = 0;
        try { size = fs.statSync(this.file).size; } catch { /* yeni */ }
        if (size > this.maxBytes) fs.renameSync(this.file, `${this.file}.1`);
        fs.appendFileSync(this.file, line);
      } catch { /* disk dolu/izin — günlük eşitlemeyi durdurmasın */ }
    }
    this.emit("satir", kayit);
  }

  info(m) { this.write("bilgi", m); }
  warn(m) { this.write("uyari", m); }
  error(m) { this.write("hata", m); }
  tail(n = 100) { return this.lines.slice(-n); }
}

module.exports = { Logger };
