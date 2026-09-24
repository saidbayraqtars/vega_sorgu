// Köprü ayarları: kopru.json (parola ve köprü anahtarı obfüske edilmiş).
// Eski Vega Sorgu masaüstü uygulamasının config.json'ı varsa SQL bilgileri oradan alınır —
// kurulu müşterilerde yalnız bulut adresi + köprü anahtarı girilir.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { encrypt, decrypt } = require("./secret");

function defaultDir() {
  if (process.env.VEGA_KOPRU_DIR) return process.env.VEGA_KOPRU_DIR;
  const base = process.platform === "win32" ? (process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"))
    : process.platform === "darwin" ? path.join(os.homedir(), "Library", "Application Support") : (process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"));
  return path.join(base, "vega-sorgu-desktop"); // Electron userData ile aynı klasör
}

const DEFAULTS = {
  sql: { server: "localhost", instance: "", port: 1433, database: "VEGADB", user: "", password: "", encrypt: false },
  bulut: { url: "", anahtar: "" },
  firmalar: null,        // null = hepsi; ör. ["0101","0103"]
  baslangicYili: null,   // null = son 5 yıl
  kirliOkuma: false,     // READ UNCOMMITTED (yoğun kurulumlarda kilit beklememek için)
  eskiDonemSaat: 6,      // eski (kapanmış) dönemler en fazla bu kadar saatte bir taranır
};

class Config {
  constructor(dir = defaultDir()) {
    this.dir = dir;
    this.file = path.join(dir, "kopru.json");
    this.stateFile = path.join(dir, "kopru-durum.json");
    this.data = JSON.parse(JSON.stringify(DEFAULTS));
    this.load();
  }

  load() {
    let raw = null;
    try { raw = JSON.parse(fs.readFileSync(this.file, "utf8")); } catch { /* yok */ }
    if (raw) {
      this.data = { ...DEFAULTS, ...raw, sql: { ...DEFAULTS.sql, ...(raw.sql || {}) }, bulut: { ...DEFAULTS.bulut, ...(raw.bulut || {}) } };
      return;
    }
    // Eski masaüstü uygulamasının config.json'ı (server/database/username/password/port)
    try {
      const old = JSON.parse(fs.readFileSync(path.join(this.dir, "config.json"), "utf8"));
      if (old && old.server && old.password && !old.pinHash) {
        const [server, instance] = String(old.server).split("\\");
        this.data.sql = { ...this.data.sql, server, instance: instance || "", port: Number(old.port) || 1433, database: old.database || "VEGADB",
          user: old.username || "", password: old.password /* zaten şifreli */ };
        this.migrated = true;
      }
    } catch { /* yok */ }
  }

  save() {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  // Düz metin değerlerle güncelle (parola/anahtar burada şifrelenir)
  update(patch = {}) {
    if (patch.sql) {
      const s = { ...patch.sql };
      if (s.password !== undefined) s.password = s.password ? encrypt(s.password) : "";
      this.data.sql = { ...this.data.sql, ...s };
    }
    if (patch.bulut) {
      const b = { ...patch.bulut };
      if (b.anahtar !== undefined) b.anahtar = b.anahtar ? encrypt(b.anahtar.trim()) : "";
      if (b.url !== undefined) b.url = String(b.url).trim().replace(/\/+$/, "");
      this.data.bulut = { ...this.data.bulut, ...b };
    }
    for (const k of ["firmalar", "baslangicYili", "kirliOkuma", "eskiDonemSaat"]) if (patch[k] !== undefined) this.data[k] = patch[k];
    this.save();
  }

  sqlConfig() { return { ...this.data.sql, password: decrypt(this.data.sql.password) }; }
  cloud() { return { url: this.data.bulut.url, anahtar: decrypt(this.data.bulut.anahtar) }; }
  ready() { return !!(this.data.sql.server && this.data.sql.user && this.data.sql.password && this.data.bulut.url && this.data.bulut.anahtar); }

  // Arayüze gösterilecek (sırlar gizli)
  public() {
    return {
      sql: { ...this.data.sql, password: this.data.sql.password ? "••••••" : "" },
      bulut: { url: this.data.bulut.url, anahtar: this.data.bulut.anahtar ? "••••••" : "" },
      firmalar: this.data.firmalar, baslangicYili: this.data.baslangicYili, kirliOkuma: this.data.kirliOkuma,
      hazir: this.ready(), eskiAyarlarAlindi: !!this.migrated,
    };
  }

  state() { try { return JSON.parse(fs.readFileSync(this.stateFile, "utf8")); } catch { return {}; } }
  setState(patch) {
    const s = { ...this.state(), ...patch };
    try { fs.mkdirSync(this.dir, { recursive: true }); fs.writeFileSync(this.stateFile, JSON.stringify(s, null, 2)); } catch { /* yazılamadı */ }
    return s;
  }
}

module.exports = { Config, defaultDir, DEFAULTS };
