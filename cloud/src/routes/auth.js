// /api/auth — giriş, çıkış, oturum bilgisi, şifre değişikliği

const express = require("express");
const { setSessionCookie, clearSessionCookie, HttpError, LoginLimiter, requireUser } = require("../auth");
const { wrap } = require("./common");
const P = require("../engine/period");

function userView(registry, u, req) {
  const tenant = u.tenantId ? registry.tenant(u.tenantId) : null;
  return {
    id: u.id, kullanici: u.username, ad: u.ad || u.username, rol: u.rol, tercihler: u.prefs || {},
    firma: tenant ? { id: tenant.id, kod: tenant.slug, ad: tenant.ad } : null,
    gorunenFirma: req && req.tenant ? { id: req.tenant.id, kod: req.tenant.slug, ad: req.tenant.ad } : (tenant ? { id: tenant.id, kod: tenant.slug, ad: tenant.ad } : null),
  };
}

module.exports = function authRoutes(deps) {
  const { registry, config } = deps;
  const r = express.Router();
  const limiter = new LoginLimiter();

  r.post("/giris", wrap((req, res) => {
    const { kullanici, sifre } = req.body || {};
    const ip = req.ip;
    if (!kullanici || !sifre) throw new HttpError(400, "Kullanıcı adı ve şifre gerekli.");
    if (!limiter.check(ip, kullanici)) throw new HttpError(429, "Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.");
    const u = registry.checkLogin(kullanici, sifre);
    if (!u) {
      limiter.fail(ip, kullanici);
      throw new HttpError(401, "Kullanıcı adı veya şifre hatalı.");
    }
    limiter.reset(ip, kullanici);
    const s = registry.createSession(u.id, { ip, ua: req.headers["user-agent"] });
    setSessionCookie(res, s.token, s.expires, config.cookieSecure);
    registry.audit(u.id, u.tenantId, "giris", { ip });
    res.json({ kullanici: userView(registry, u) });
  }));

  r.post("/cikis", wrap((req, res) => {
    if (req.sessionToken) registry.deleteSession(req.sessionToken);
    clearSessionCookie(res, config.cookieSecure);
    res.json({ tamam: true });
  }));

  r.get("/ben", requireUser, wrap((req, res) => {
    res.json({ kullanici: userView(registry, req.user, req) });
  }));

  r.post("/sifre", requireUser, wrap((req, res) => {
    const { eski, yeni } = req.body || {};
    if (!registry.checkLogin(req.user.username, eski || "")) throw new HttpError(400, "Mevcut şifre hatalı.");
    registry.updateUser(req.user.id, { password: yeni });
    const s = registry.createSession(req.user.id, { ip: req.ip, ua: req.headers["user-agent"] });
    setSessionCookie(res, s.token, s.expires, config.cookieSecure);
    res.json({ tamam: true });
  }));

  r.put("/tercihler", requireUser, wrap((req, res) => {
    const prefs = req.body && typeof req.body === "object" ? req.body : {};
    const clean = {};
    if (["acik", "koyu", "sistem"].includes(prefs.tema)) clean.tema = prefs.tema;
    if (typeof prefs.donem === "string" && (P.PRESETS[prefs.donem] || prefs.donem === "ozel")) clean.donem = prefs.donem;
    // Özel dönem aralığı (donem = "ozel" iken kullanılır); null → temizle
    for (const k of ["donemBas", "donemBit"]) if (prefs[k] === null || P.isDate(prefs[k])) clean[k] = prefs[k];
    // ["hepsi"] = kapanmış firmalar dahil tümü; [] = etkin firmalar (varsayılan)
    if (Array.isArray(prefs.firmalar)) {
      clean.firmalar = prefs.firmalar.includes("hepsi") ? ["hepsi"] : prefs.firmalar.filter((f) => /^\d{4}$/.test(f)).slice(0, 50);
    }
    if (typeof prefs.anaPano === "number") clean.anaPano = prefs.anaPano;
    const u = registry.updateUser(req.user.id, { prefs: clean });
    res.json({ tercihler: u.prefs });
  }));

  return r;
};

module.exports.userView = userView;
