// Vega Bulut — sunucu giriş noktası.

const fs = require("fs");
const path = require("path");
const { loadConfig } = require("./config");
const { Registry } = require("./db/registry");
const { TenantManager } = require("./tenants");
const { FxService } = require("./fx");
const { createApp } = require("./app");
const log = require("./log");

function start(config = loadConfig()) {
  log.setLevel(config.logLevel);
  fs.mkdirSync(config.dataDir, { recursive: true });
  const registry = new Registry(path.join(config.dataDir, "registry.db"));
  const tenants = new TenantManager(config.dataDir);
  const fx = new FxService(config.dataDir, { enabled: config.kurlarAktif });

  // İlk çalıştırma: sistem yöneticisi oluştur (ADMIN_USER/ADMIN_PASSWORD)
  if (!registry.countSupers()) {
    if (config.adminUser && config.adminPassword) {
      registry.createUser({ username: config.adminUser, password: config.adminPassword, rol: "super", ad: "Sistem Yöneticisi" });
      log.info("sistem yöneticisi oluşturuldu", { kullanici: config.adminUser });
    } else {
      log.warn("Sistem yöneticisi yok. ADMIN_USER ve ADMIN_PASSWORD verin ya da: node src/cli.js yonetici-ekle <kullanici> <sifre>");
    }
  }

  const deps = { registry, tenants, fx, config };
  const app = createApp(deps);
  const server = app.listen(config.port, config.host, () => {
    log.info("Vega Bulut dinliyor", { port: config.port, veri: config.dataDir, arayuz: config.webDir });
  });
  server.requestTimeout = 5 * 60000; // büyük köprü gövdeleri için
  fx.start();
  const cleanup = setInterval(() => { try { registry.cleanup(); } catch (e) { log.warn("temizlik", { hata: e.message }); } }, 6 * 3600000);
  cleanup.unref();

  const shutdown = () => {
    log.info("kapanıyor");
    server.close(() => {
      fx.stop();
      tenants.closeAll();
      registry.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  return { app, server, deps };
}

if (require.main === module) start();

module.exports = { start };
