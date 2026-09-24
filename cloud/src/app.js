// Express uygulaması (test edilebilir fabrika).

const fs = require("fs");
const path = require("path");
const express = require("express");
const { sessionMiddleware, sameOrigin, HttpError } = require("./auth");
const log = require("./log");
const { overview } = require("./engine/overview");
const { Context } = require("./engine/context");
const P = require("./engine/period");
const { activeFirmas, alertKey } = require("./routes/common");
const { alerts } = require("./engine/alerts");
const pkg = require("../package.json");

function createApp(deps) {
  const { registry, config } = deps;
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);

  // Güvenlik başlıkları
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "same-origin");
    res.set("X-Frame-Options", "DENY");
    res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (!req.path.startsWith("/api/")) {
      res.set("Content-Security-Policy",
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    }
    next();
  });

  // Isıtma: eşitleme sonrası varsayılan durum hesabını önceden yap
  deps.warm = deps.warm || ((tenant) => {
    const store = deps.tenants.get(tenant);
    const today = P.todayTR();
    const act = activeFirmas(store, today);
    const ctx = new Context(store, tenant.settings, { firmalar: act.length ? act : null, today });
    const k = deps.fx && deps.fx.current();
    ctx.kurlar = k ? k.kurlar : null;
    const sonEsitleme = store.getMeta("lastSync", null);
    const v = store.dataVersion();
    deps.tenants.cached(tenant.id, v, `/durum?|${today}`, () => overview(ctx, { kurlar: ctx.kurlar, sonEsitleme }));
    // Uyarı sayıları (/surum her 60 sn'de ister): durum hesabının ara sonuçlarından, ek maliyetsiz
    deps.tenants.cached(tenant.id, v, alertKey("", today), () => alerts(ctx, { kurlar: ctx.kurlar, sonEsitleme }));
  });

  app.get("/api/saglik", (req, res) => res.json({ tamam: true, surum: pkg.version, zaman: new Date().toISOString() }));

  // Köprü uçları: kendi kimlik doğrulaması ve büyük gövde sınırı var (çerez/CSRF gerekmez)
  app.use("/api/kopru/v1", require("./routes/bridge")(deps));

  app.use("/api", express.json({ limit: "1mb" }));
  app.use("/api", sessionMiddleware(registry));
  app.use("/api", sameOrigin);
  app.use("/api/auth", require("./routes/auth")(deps));
  app.use("/api/panolar", require("./routes/boards")(deps));
  app.use("/api/yonetim", require("./routes/super")(deps));
  app.use("/api", require("./routes/admin")(deps));
  app.use("/api", require("./routes/data")(deps));
  app.use("/api", (req, res, next) => next(new HttpError(404, "Uç bulunamadı.")));

  // Arayüz (web/dist) — SPA geri dönüşü
  const webDir = config.webDir;
  if (fs.existsSync(path.join(webDir, "index.html"))) {
    app.use(express.static(webDir, {
      index: false,
      setHeaders: (res, file) => {
        if (/[\\/]assets[\\/]/.test(file)) res.set("Cache-Control", "public, max-age=31536000, immutable");
      },
    }));
    app.get(/^\/(?!api\/).*/, (req, res) => {
      res.set("Cache-Control", "no-cache");
      res.sendFile(path.join(webDir, "index.html"));
    });
  } else {
    app.get("/", (req, res) => res.type("text").send("Vega Bulut API çalışıyor. Arayüz derlemesi bulunamadı (web/dist)."));
  }

  // Hata yakalayıcı: her zaman JSON { hata }
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    let status = err.status || err.statusCode || 500;
    if (err.type === "entity.too.large") status = 413;
    if (err.type === "entity.parse.failed") status = 400;
    if (status >= 500) log.error("istek hatası", { yol: req.path, hata: err.message, yigin: err.stack && err.stack.split("\n").slice(0, 4).join(" | ") });
    res.status(status).json({ hata: status >= 500 ? "Sunucu hatası. Lütfen tekrar deneyin." : err.message });
  });

  return app;
}

module.exports = { createApp };
