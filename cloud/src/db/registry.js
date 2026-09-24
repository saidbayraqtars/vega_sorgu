// Kayıt veritabanı: kiracılar, kullanıcılar, oturumlar, köprü anahtarları,
// panolar, eşitleme günlüğü. Kiracı verisi burada DEĞİL — her kiracının ayrı dosyası var.

const crypto = require("crypto");
const { Db } = require("./sqlite");

const SESSION_DAYS = 30;

function now() { return new Date().toISOString(); }
function sha256(s) { return crypto.createHash("sha256").update(String(s)).digest("hex"); }
function randomToken(bytes = 32) { return crypto.randomBytes(bytes).toString("base64url"); }

// scrypt parola özeti: scrypt$N$r$p$tuz$özet
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const N = 16384, r = 8, p = 1;
  const hash = crypto.scryptSync(String(password), salt, 32, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}
function verifyPassword(password, stored) {
  try {
    const [alg, N, r, p, saltB64, hashB64] = String(stored).split("$");
    if (alg !== "scrypt") return false;
    const expected = Buffer.from(hashB64, "base64");
    const got = crypto.scryptSync(String(password), Buffer.from(saltB64, "base64"), expected.length, { N: +N, r: +r, p: +p });
    return crypto.timingSafeEqual(expected, got);
  } catch {
    return false;
  }
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

class Registry {
  constructor(file) {
    this.db = new Db(file);
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tenant (
        id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, ad TEXT NOT NULL,
        settings TEXT NOT NULL DEFAULT '{}', aktif INTEGER NOT NULL DEFAULT 1,
        sync_request INTEGER NOT NULL DEFAULT 0, full_resync INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS user (
        id INTEGER PRIMARY KEY, tenant_id INTEGER REFERENCES tenant(id) ON DELETE CASCADE,
        username TEXT UNIQUE NOT NULL COLLATE NOCASE, ad TEXT, pass TEXT NOT NULL,
        rol TEXT NOT NULL CHECK (rol IN ('super','admin','user')), aktif INTEGER NOT NULL DEFAULT 1,
        prefs TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, last_login TEXT
      );
      CREATE TABLE IF NOT EXISTS session (
        token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        view_tenant INTEGER, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, ip TEXT, ua TEXT
      );
      CREATE INDEX IF NOT EXISTS ix_session_user ON session(user_id);
      CREATE TABLE IF NOT EXISTS bridge_token (
        id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        token_hash TEXT UNIQUE NOT NULL, etiket TEXT, created_at TEXT NOT NULL,
        last_seen TEXT, agent TEXT, revoked INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS board (
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        ad TEXT NOT NULL, ikon TEXT, sira INTEGER NOT NULL DEFAULT 0, widgets TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_board_user ON board(user_id);
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        sync_id TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL,
        chunks INTEGER DEFAULT 0, rows INTEGER DEFAULT 0, bytes INTEGER DEFAULT 0, message TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ix_sync_log ON sync_log(tenant_id, sync_id);
      CREATE TABLE IF NOT EXISTS agent_event (
        id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
        at TEXT NOT NULL, level TEXT NOT NULL, msg TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit (
        id INTEGER PRIMARY KEY, at TEXT NOT NULL, user_id INTEGER, tenant_id INTEGER, action TEXT NOT NULL, detail TEXT
      );
    `);
  }

  // ─── Kiracılar ─────────────────────────────────────────────────────────
  createTenant({ slug, ad, settings = {} }) {
    slug = String(slug || "").trim().toLowerCase();
    if (!SLUG_RE.test(slug)) throw Object.assign(new Error("Kısa ad yalnızca küçük harf, rakam ve '-' içerebilir (2-41 karakter)."), { status: 400 });
    if (!String(ad || "").trim()) throw Object.assign(new Error("Firma adı gerekli."), { status: 400 });
    if (this.tenantBySlug(slug)) throw Object.assign(new Error("Bu kısa ad zaten kullanılıyor."), { status: 409 });
    const r = this.db.run("INSERT INTO tenant(slug, ad, settings, created_at) VALUES(?,?,?,?)", slug, String(ad).trim(), JSON.stringify(settings), now());
    return this.tenant(Number(r.lastInsertRowid));
  }
  tenant(id) { return decodeTenant(this.db.get("SELECT * FROM tenant WHERE id = ?", id)); }
  tenantBySlug(slug) { return decodeTenant(this.db.get("SELECT * FROM tenant WHERE slug = ?", slug)); }
  tenants() { return this.db.all("SELECT * FROM tenant ORDER BY ad").map(decodeTenant); }
  updateTenant(id, { ad, settings, aktif }) {
    const t = this.tenant(id);
    if (!t) return null;
    const next = {
      ad: ad !== undefined ? String(ad).trim() || t.ad : t.ad,
      settings: settings !== undefined ? { ...t.settings, ...settings } : t.settings,
      aktif: aktif !== undefined ? (aktif ? 1 : 0) : t.aktif,
    };
    this.db.run("UPDATE tenant SET ad = ?, settings = ?, aktif = ? WHERE id = ?", next.ad, JSON.stringify(next.settings), next.aktif, id);
    return this.tenant(id);
  }
  deleteTenant(id) { this.db.run("DELETE FROM tenant WHERE id = ?", id); }
  requestSync(id, full = false) {
    this.db.run(`UPDATE tenant SET sync_request = 1${full ? ", full_resync = 1" : ""} WHERE id = ?`, id);
  }
  takeSyncRequest(id) {
    const t = this.db.get("SELECT sync_request, full_resync FROM tenant WHERE id = ?", id);
    if (!t) return { syncNow: false, fullResync: false };
    if (t.sync_request || t.full_resync) this.db.run("UPDATE tenant SET sync_request = 0, full_resync = 0 WHERE id = ?", id);
    return { syncNow: !!t.sync_request || !!t.full_resync, fullResync: !!t.full_resync };
  }
  pendingSyncRequest(id) {
    const t = this.db.get("SELECT sync_request FROM tenant WHERE id = ?", id);
    return !!(t && t.sync_request);
  }

  // ─── Köprü anahtarları ─────────────────────────────────────────────────
  createBridgeToken(tenantId, etiket = "") {
    const t = this.tenant(tenantId);
    if (!t) throw Object.assign(new Error("Kiracı yok"), { status: 404 });
    const token = `vk_${t.slug}_${randomToken(24)}`;
    this.db.run("INSERT INTO bridge_token(tenant_id, token_hash, etiket, created_at) VALUES(?,?,?,?)", tenantId, sha256(token), String(etiket || "").slice(0, 60), now());
    return token; // düz metin yalnızca bir kez döner
  }
  verifyBridgeToken(token) {
    if (!token || !String(token).startsWith("vk_")) return null;
    const row = this.db.get(
      "SELECT b.id, b.tenant_id FROM bridge_token b JOIN tenant t ON t.id = b.tenant_id WHERE b.token_hash = ? AND b.revoked = 0 AND t.aktif = 1",
      sha256(token),
    );
    return row ? { tokenId: row.id, tenant: this.tenant(row.tenant_id) } : null;
  }
  touchBridgeToken(tokenId, agent) {
    this.db.run("UPDATE bridge_token SET last_seen = ?, agent = COALESCE(?, agent) WHERE id = ?", now(), agent ? JSON.stringify(agent) : null, tokenId);
  }
  bridgeTokens(tenantId) {
    return this.db.all("SELECT id, etiket, created_at, last_seen, agent, revoked FROM bridge_token WHERE tenant_id = ? ORDER BY id DESC", tenantId)
      .map((r) => ({ ...r, agent: r.agent ? safeJson(r.agent) : null, revoked: !!r.revoked }));
  }
  revokeBridgeToken(tenantId, id) {
    this.db.run("UPDATE bridge_token SET revoked = 1 WHERE id = ? AND tenant_id = ?", id, tenantId);
  }

  // ─── Kullanıcılar ──────────────────────────────────────────────────────
  createUser({ username, password, rol = "user", tenantId = null, ad = "" }) {
    username = String(username || "").trim();
    if (!/^[\p{L}\p{N}._@-]{3,40}$/u.test(username)) throw Object.assign(new Error("Kullanıcı adı 3-40 karakter olmalı (harf, rakam, . _ @ -)."), { status: 400 });
    if (String(password || "").length < 6) throw Object.assign(new Error("Şifre en az 6 karakter olmalı."), { status: 400 });
    if (!["super", "admin", "user"].includes(rol)) throw Object.assign(new Error("Geçersiz rol."), { status: 400 });
    if (rol !== "super" && !tenantId) throw Object.assign(new Error("Kullanıcı bir firmaya bağlı olmalı."), { status: 400 });
    if (this.db.get("SELECT id FROM user WHERE username = ?", username)) throw Object.assign(new Error("Bu kullanıcı adı alınmış."), { status: 409 });
    const r = this.db.run(
      "INSERT INTO user(tenant_id, username, ad, pass, rol, created_at) VALUES(?,?,?,?,?,?)",
      rol === "super" ? null : tenantId, username, String(ad || "").slice(0, 80), hashPassword(password), rol, now(),
    );
    return this.user(Number(r.lastInsertRowid));
  }
  user(id) { return decodeUser(this.db.get("SELECT * FROM user WHERE id = ?", id)); }
  userByName(username) { return decodeUser(this.db.get("SELECT * FROM user WHERE username = ?", String(username || "").trim())); }
  users(tenantId) {
    return (tenantId ? this.db.all("SELECT * FROM user WHERE tenant_id = ? ORDER BY username", tenantId)
      : this.db.all("SELECT * FROM user ORDER BY username")).map(decodeUser);
  }
  countSupers() { return this.db.value("SELECT COUNT(*) FROM user WHERE rol = 'super' AND aktif = 1"); }
  checkLogin(username, password) {
    const row = this.db.get("SELECT * FROM user WHERE username = ?", String(username || "").trim());
    // Kullanıcı yoksa da aynı maliyette doğrulama yap (zamanlama sızıntısı olmasın)
    const ok = verifyPassword(password, row ? row.pass : DUMMY_HASH);
    if (!row || !ok || !row.aktif) return null;
    if (row.tenant_id) {
      const t = this.tenant(row.tenant_id);
      if (!t || !t.aktif) return null;
    }
    this.db.run("UPDATE user SET last_login = ? WHERE id = ?", now(), row.id);
    return decodeUser(row);
  }
  updateUser(id, { ad, rol, aktif, password, prefs }) {
    const u = this.db.get("SELECT * FROM user WHERE id = ?", id);
    if (!u) return null;
    if (rol !== undefined && !["admin", "user"].includes(rol) && u.rol !== "super") throw Object.assign(new Error("Geçersiz rol."), { status: 400 });
    if (password !== undefined && String(password).length < 6) throw Object.assign(new Error("Şifre en az 6 karakter olmalı."), { status: 400 });
    this.db.run(
      "UPDATE user SET ad = ?, rol = ?, aktif = ?, pass = ?, prefs = ? WHERE id = ?",
      ad !== undefined ? String(ad).slice(0, 80) : u.ad,
      rol !== undefined && u.rol !== "super" ? rol : u.rol,
      aktif !== undefined ? (aktif ? 1 : 0) : u.aktif,
      password !== undefined ? hashPassword(password) : u.pass,
      prefs !== undefined ? JSON.stringify({ ...safeJson(u.prefs), ...prefs }) : u.prefs,
      id,
    );
    if (password !== undefined || aktif === false) this.db.run("DELETE FROM session WHERE user_id = ?", id);
    return this.user(id);
  }
  deleteUser(id) { this.db.run("DELETE FROM user WHERE id = ?", id); }

  // ─── Oturumlar ─────────────────────────────────────────────────────────
  createSession(userId, { ip, ua } = {}) {
    const token = randomToken(32);
    const exp = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
    this.db.run("INSERT INTO session(token_hash, user_id, created_at, expires_at, ip, ua) VALUES(?,?,?,?,?,?)",
      sha256(token), userId, now(), exp, ip || null, String(ua || "").slice(0, 200));
    return { token, expires: exp };
  }
  session(token) {
    if (!token) return null;
    const s = this.db.get("SELECT * FROM session WHERE token_hash = ?", sha256(token));
    if (!s) return null;
    if (s.expires_at < now()) { this.db.run("DELETE FROM session WHERE token_hash = ?", s.token_hash); return null; }
    const u = this.user(s.user_id);
    if (!u || !u.aktif) return null;
    return { ...s, user: u };
  }
  setSessionViewTenant(token, tenantId) {
    this.db.run("UPDATE session SET view_tenant = ? WHERE token_hash = ?", tenantId, sha256(token));
  }
  deleteSession(token) { this.db.run("DELETE FROM session WHERE token_hash = ?", sha256(token)); }
  cleanup() {
    this.db.run("DELETE FROM session WHERE expires_at < ?", now());
    this.db.run("DELETE FROM agent_event WHERE at < ?", new Date(Date.now() - 30 * 86400000).toISOString());
    this.db.run("DELETE FROM sync_log WHERE started_at < ?", new Date(Date.now() - 60 * 86400000).toISOString());
  }

  // ─── Panolar ───────────────────────────────────────────────────────────
  boards(userId) {
    return this.db.all("SELECT * FROM board WHERE user_id = ? ORDER BY sira, id", userId)
      .map((b) => ({ id: b.id, ad: b.ad, ikon: b.ikon, sira: b.sira, widgets: safeJson(b.widgets, []), updated_at: b.updated_at }));
  }
  saveBoard(userId, { id, ad, ikon, sira, widgets }) {
    if (!Array.isArray(widgets)) throw Object.assign(new Error("widgets dizi olmalı"), { status: 400 });
    if (widgets.length > 60) throw Object.assign(new Error("Bir panoda en fazla 60 kutu olabilir."), { status: 400 });
    const w = JSON.stringify(widgets);
    if (w.length > 200000) throw Object.assign(new Error("Pano çok büyük."), { status: 400 });
    if (id) {
      const b = this.db.get("SELECT id FROM board WHERE id = ? AND user_id = ?", id, userId);
      if (!b) throw Object.assign(new Error("Pano bulunamadı."), { status: 404 });
      this.db.run("UPDATE board SET ad = COALESCE(?, ad), ikon = COALESCE(?, ikon), sira = COALESCE(?, sira), widgets = ?, updated_at = ? WHERE id = ?",
        ad ? String(ad).slice(0, 40) : null, ikon ? String(ikon).slice(0, 40) : null, Number.isFinite(sira) ? sira : null, w, now(), id);
      return id;
    }
    if (this.db.value("SELECT COUNT(*) FROM board WHERE user_id = ?", userId) >= 12) throw Object.assign(new Error("En fazla 12 pano oluşturabilirsiniz."), { status: 400 });
    const r = this.db.run("INSERT INTO board(user_id, ad, ikon, sira, widgets, updated_at) VALUES(?,?,?,?,?,?)",
      userId, String(ad || "Panom").slice(0, 40), String(ikon || "LayoutGrid").slice(0, 40), Number.isFinite(sira) ? sira : 99, w, now());
    return Number(r.lastInsertRowid);
  }
  deleteBoard(userId, id) { this.db.run("DELETE FROM board WHERE id = ? AND user_id = ?", id, userId); }

  // ─── Eşitleme günlüğü ──────────────────────────────────────────────────
  syncStart(tenantId, syncId) {
    this.db.run(`INSERT INTO sync_log(tenant_id, sync_id, started_at, status) VALUES(?,?,?, 'calisiyor')
      ON CONFLICT(tenant_id, sync_id) DO NOTHING`, tenantId, syncId, now());
  }
  syncProgress(tenantId, syncId, { chunks = 0, rows = 0, bytes = 0 }) {
    this.db.run("UPDATE sync_log SET chunks = chunks + ?, rows = rows + ?, bytes = bytes + ? WHERE tenant_id = ? AND sync_id = ?",
      chunks, rows, bytes, tenantId, syncId);
  }
  syncFinish(tenantId, syncId, status, message = null) {
    this.db.run("UPDATE sync_log SET finished_at = ?, status = ?, message = ? WHERE tenant_id = ? AND sync_id = ?",
      now(), status, message, tenantId, syncId);
  }
  syncLogs(tenantId, limit = 20) {
    return this.db.all("SELECT * FROM sync_log WHERE tenant_id = ? ORDER BY id DESC LIMIT ?", tenantId, limit);
  }
  lastSync(tenantId) {
    return this.db.get("SELECT * FROM sync_log WHERE tenant_id = ? AND status = 'tamam' ORDER BY id DESC LIMIT 1", tenantId) || null;
  }
  agentEvent(tenantId, level, msg) {
    this.db.run("INSERT INTO agent_event(tenant_id, at, level, msg) VALUES(?,?,?,?)", tenantId, now(), String(level).slice(0, 10), String(msg).slice(0, 2000));
  }
  agentEvents(tenantId, limit = 30) {
    return this.db.all("SELECT at, level, msg FROM agent_event WHERE tenant_id = ? ORDER BY id DESC LIMIT ?", tenantId, limit);
  }
  audit(userId, tenantId, action, detail) {
    this.db.run("INSERT INTO audit(at, user_id, tenant_id, action, detail) VALUES(?,?,?,?,?)", now(), userId || null, tenantId || null, action, detail ? JSON.stringify(detail).slice(0, 2000) : null);
  }

  close() { this.db.close(); }
}

const DUMMY_HASH = hashPassword(crypto.randomBytes(8).toString("hex"));

function safeJson(s, def = {}) { try { return JSON.parse(s); } catch { return def; } }
function decodeTenant(t) {
  if (!t) return null;
  return { id: t.id, slug: t.slug, ad: t.ad, settings: safeJson(t.settings), aktif: !!t.aktif, created_at: t.created_at };
}
function decodeUser(u) {
  if (!u) return null;
  return {
    id: u.id, tenantId: u.tenant_id, username: u.username, ad: u.ad, rol: u.rol, aktif: !!u.aktif,
    prefs: safeJson(u.prefs), created_at: u.created_at, last_login: u.last_login,
  };
}

module.exports = { Registry, hashPassword, verifyPassword, sha256, randomToken };
