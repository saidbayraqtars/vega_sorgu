// Ortam değişkenlerinden yapılandırma (VPS'te .env / docker-compose ile verilir).

const path = require("path");

function bool(v, def = false) {
  if (v === undefined || v === "") return def;
  return ["1", "true", "evet", "yes", "on"].includes(String(v).toLowerCase());
}

function loadConfig(env = process.env) {
  const root = path.join(__dirname, "..");
  const publicUrl = env.PUBLIC_URL || "";
  return {
    port: Number(env.PORT) || 8080,
    host: env.HOST || "0.0.0.0",
    dataDir: path.resolve(env.DATA_DIR || path.join(root, "data")),
    webDir: path.resolve(env.WEB_DIR || path.join(root, "..", "web", "dist")),
    publicUrl,
    // HTTPS arkasında (Caddy) çalışırken çerez Secure olmalı
    cookieSecure: bool(env.COOKIE_SECURE, publicUrl.startsWith("https://")),
    trustProxy: env.TRUST_PROXY || "loopback, linklocal, uniquelocal",
    adminUser: env.ADMIN_USER || "",
    adminPassword: env.ADMIN_PASSWORD || "",
    varsayilanEnflasyon: env.VARSAYILAN_ENFLASYON === undefined || env.VARSAYILAN_ENFLASYON === "" ? null : Number(env.VARSAYILAN_ENFLASYON),
    kurlarAktif: bool(env.TCMB_KURLARI, true),
    bridgeMaxMb: Number(env.KOPRU_MAX_MB) || 64,
    logLevel: env.LOG_LEVEL || "info",
    demoIzinli: bool(env.DEMO_IZINLI, true),
  };
}

module.exports = { loadConfig };
