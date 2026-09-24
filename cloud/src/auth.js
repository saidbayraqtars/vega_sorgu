// Oturum çerezi, yetki ara katmanları, giriş hız sınırı.

const COOKIE = "vb_oturum";

function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { out[k] = part.slice(i + 1).trim(); }
  }
  return out;
}

function setSessionCookie(res, token, expires, secure) {
  const parts = [`${COOKIE}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Expires=${new Date(expires).toUTCString()}`];
  if (secure) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}
function clearSessionCookie(res, secure) {
  res.append("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? "; Secure" : ""}`);
}

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Oturumu yükle: req.user, req.session, req.tenant (etkin kiracı)
function sessionMiddleware(registry) {
  return (req, res, next) => {
    const token = parseCookies(req.headers.cookie)[COOKIE];
    req.sessionToken = token || null;
    const s = token ? registry.session(token) : null;
    if (s) {
      req.session = s;
      req.user = s.user;
      if (s.user.rol === "super") req.tenant = s.view_tenant ? registry.tenant(s.view_tenant) : null;
      else req.tenant = s.user.tenantId ? registry.tenant(s.user.tenantId) : null;
    }
    next();
  };
}

function requireUser(req, res, next) {
  if (!req.user) return next(new HttpError(401, "Oturum açmanız gerekiyor."));
  next();
}
function requireTenant(req, res, next) {
  if (!req.user) return next(new HttpError(401, "Oturum açmanız gerekiyor."));
  if (!req.tenant) return next(new HttpError(409, req.user.rol === "super" ? "Önce bir firma seçin (Yönetim → Firmalar)." : "Hesabınız bir firmaya bağlı değil."));
  if (!req.tenant.aktif && req.user.rol !== "super") return next(new HttpError(403, "Firma hesabı pasif."));
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user) return next(new HttpError(401, "Oturum açmanız gerekiyor."));
  if (req.user.rol !== "admin" && req.user.rol !== "super") return next(new HttpError(403, "Bu işlem için yönetici yetkisi gerekli."));
  next();
}
function requireSuper(req, res, next) {
  if (!req.user) return next(new HttpError(401, "Oturum açmanız gerekiyor."));
  if (req.user.rol !== "super") return next(new HttpError(403, "Bu işlem yalnız sistem yöneticisine açık."));
  next();
}

// Durum değiştiren isteklerde aynı-köken denetimi (CSRF'e karşı, SameSite=Lax'a ek olarak)
function sameOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // tarayıcı dışı istemci (curl, köprü) — çerezsiz çalışır
  try {
    const o = new URL(origin);
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    if (o.host === host) return next();
  } catch { /* geçersiz */ }
  next(new HttpError(403, "Geçersiz köken."));
}

// Giriş hız sınırı: IP+kullanıcı başına 15 dakikada 10 deneme
class LoginLimiter {
  constructor({ max = 10, windowMs = 15 * 60000 } = {}) { this.max = max; this.windowMs = windowMs; this.map = new Map(); }
  key(ip, user) { return `${ip}|${String(user || "").toLowerCase()}`; }
  check(ip, user) {
    const k = this.key(ip, user);
    const now = Date.now();
    const e = this.map.get(k);
    if (!e || now - e.start > this.windowMs) return true;
    return e.count < this.max;
  }
  fail(ip, user) {
    const k = this.key(ip, user);
    const now = Date.now();
    const e = this.map.get(k);
    if (!e || now - e.start > this.windowMs) this.map.set(k, { start: now, count: 1 });
    else e.count++;
    if (this.map.size > 10000) this.map.delete(this.map.keys().next().value);
  }
  reset(ip, user) { this.map.delete(this.key(ip, user)); }
}

module.exports = {
  COOKIE, parseCookies, setSessionCookie, clearSessionCookie, HttpError,
  sessionMiddleware, requireUser, requireTenant, requireAdmin, requireSuper, sameOrigin, LoginLimiter,
};
