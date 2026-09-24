#!/usr/bin/env node
// Vega Bulut yönetim komutları:
//   node src/cli.js demo                              → "demo" firması + demo/demo123 kullanıcısı + örnek veri
//   node src/cli.js yonetici-ekle <kullanici> <sifre> → sistem yöneticisi
//   node src/cli.js firma-ekle <kod> "<ad>" <yonetici> <sifre>
//   node src/cli.js kopru-anahtari <firma-kodu>       → yeni köprü anahtarı
//   node src/cli.js sifre <kullanici> <yeni-sifre>
//   node src/cli.js yedek                             → data/yedek/<zaman>/ altına tüm veritabanları

const fs = require("fs");
const path = require("path");
const { backup } = require("node:sqlite");
const { loadConfig } = require("./config");
const { Registry } = require("./db/registry");
const { TenantManager } = require("./tenants");
const { loadDemo } = require("./demo/load");
const P = require("./engine/period");

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const config = loadConfig();
  fs.mkdirSync(config.dataDir, { recursive: true });
  const registry = new Registry(path.join(config.dataDir, "registry.db"));
  const tenants = new TenantManager(config.dataDir);
  try {
    switch (cmd) {
      case "demo": {
        let t = registry.tenantBySlug("demo");
        if (!t) t = registry.createTenant({ slug: "demo", ad: "Demo Ticaret A.Ş.", settings: { enflasyon: 25, sektor: "toptan" } });
        if (!registry.userByName("demo")) registry.createUser({ username: "demo", password: "demo123", rol: "admin", tenantId: t.id, ad: "Demo Yönetici" });
        if (!registry.userByName("izleyici")) registry.createUser({ username: "izleyici", password: "izleyici123", rol: "user", tenantId: t.id, ad: "Demo İzleyici" });
        if (!registry.countSupers()) registry.createUser({ username: "admin", password: "admin123", rol: "super", ad: "Sistem Yöneticisi" });
        const store = tenants.get(t);
        store.wipe();
        const t0 = Date.now();
        const out = loadDemo(store, { today: P.todayTR() });
        store.setMeta("demo", true);
        console.log(`Demo yüklendi: ${out.rows.toLocaleString("tr-TR")} satır, ${out.chunks} parça, ${Date.now() - t0} ms`);
        console.log("Giriş: demo / demo123 (firma yöneticisi) · izleyici / izleyici123 · admin / admin123 (sistem yöneticisi — ilk kurulumsa)");
        break;
      }
      case "yonetici-ekle": {
        const [u, p] = args;
        if (!u || !p) throw new Error("Kullanım: yonetici-ekle <kullanici> <sifre>");
        registry.createUser({ username: u, password: p, rol: "super", ad: "Sistem Yöneticisi" });
        console.log(`Sistem yöneticisi eklendi: ${u}`);
        break;
      }
      case "firma-ekle": {
        const [kod, ad, u, p] = args;
        if (!kod || !ad) throw new Error('Kullanım: firma-ekle <kod> "<ad>" [yonetici] [sifre]');
        const settings = config.varsayilanEnflasyon !== null ? { enflasyon: config.varsayilanEnflasyon } : {};
        const t = registry.createTenant({ slug: kod, ad, settings });
        if (u && p) registry.createUser({ username: u, password: p, rol: "admin", tenantId: t.id, ad: "" });
        const token = registry.createBridgeToken(t.id, "cli");
        console.log(`Firma eklendi: ${t.slug}\nKöprü anahtarı (bir kez gösterilir): ${token}`);
        break;
      }
      case "kopru-anahtari": {
        const t = registry.tenantBySlug(args[0] || "");
        if (!t) throw new Error("Firma bulunamadı.");
        console.log(registry.createBridgeToken(t.id, "cli"));
        break;
      }
      case "sifre": {
        const [u, p] = args;
        const user = registry.userByName(u || "");
        if (!user) throw new Error("Kullanıcı bulunamadı.");
        registry.updateUser(user.id, { password: p });
        console.log("Şifre değiştirildi.");
        break;
      }
      case "yedek": {
        const dir = path.join(config.dataDir, "yedek", new Date().toISOString().replace(/[:.]/g, "-"));
        fs.mkdirSync(path.join(dir, "tenants"), { recursive: true });
        await backup(registry.db.raw, path.join(dir, "registry.db"));
        for (const t of registry.tenants()) await backup(tenants.get(t).db.raw, path.join(dir, "tenants", `${t.slug}.db`));
        console.log(`Yedek alındı: ${dir}`);
        break;
      }
      default:
        console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(1, 9).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
    }
  } finally {
    tenants.closeAll();
    registry.close();
  }
}

main().catch((e) => { console.error(`Hata: ${e.message}`); process.exit(1); });
