#!/usr/bin/env node
// Vega Köprü — komut satırı (Windows hizmeti / Linux için başsız çalışma)
//   vega-kopru kur --sunucu https://panel.ornek.com --anahtar vk_... --sql-sunucu MAKINE\SQLEXPRESS
//                  --sql-kullanici vega_okuma --sql-sifre ... [--veritabani VEGADB] [--sql-port 1433] [--firmalar 0101,0103]
//   vega-kopru test          SQL ve bulut bağlantısını dener
//   vega-kopru bir-kez [--tam]
//   vega-kopru calistir [--servis] [--gunluk dosya]   15 dakikada bir eşitler (Ctrl+C ile durur)
//   vega-kopru durum
// Ayar klasörü: VEGA_KOPRU_DIR (yoksa %APPDATA%\vega-sorgu-desktop)
// --servis: Windows görevi (sunucu modu) olarak çalışır; ayar klasöründe kopru-servis.dur
//           (kaldırma) ya da kopru-servis.bekle (güncelleme) belirince kendini kapatır.

const { Config } = require("./config");
const { Sql, discover } = require("./sql");
const { Cloud } = require("./http");
const { SyncEngine, humanError } = require("./sync");
const { Logger } = require("./logger");
const fs = require("fs");
const path = require("path");
const pkg = require("../package.json");

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      out[k] = v;
    } else out._.push(a);
  }
  return out;
}

async function main() {
  const a = args(process.argv.slice(2));
  const cmd = a._[0];
  const config = new Config();
  const logFile = typeof a.gunluk === "string" ? a.gunluk : process.env.VEGA_KOPRU_LOG || (a.servis ? path.join(config.dir, "servis.log") : null);
  const log = new Logger(logFile, { echo: true });
  switch (cmd) {
    case "kur": {
      const patch = { sql: {}, bulut: {} };
      if (a.sunucu) patch.bulut.url = a.sunucu;
      if (a.anahtar) patch.bulut.anahtar = a.anahtar;
      if (a["sql-sunucu"]) { const [srv, inst] = String(a["sql-sunucu"]).split("\\"); patch.sql.server = srv; patch.sql.instance = inst || ""; }
      if (a["sql-port"]) patch.sql.port = Number(a["sql-port"]);
      if (a["sql-kullanici"]) patch.sql.user = a["sql-kullanici"];
      if (a["sql-sifre"]) patch.sql.password = a["sql-sifre"];
      if (a.veritabani) patch.sql.database = a.veritabani;
      if (a.firmalar) patch.firmalar = String(a.firmalar).split(",").map((s) => s.trim().padStart(4, "0"));
      if (a["baslangic-yili"]) patch.baslangicYili = Number(a["baslangic-yili"]);
      if (a["kirli-okuma"]) patch.kirliOkuma = true;
      config.update(patch);
      console.log(`Ayarlar kaydedildi: ${config.file}`);
      console.log(JSON.stringify(config.public(), null, 2));
      break;
    }
    case "test": {
      const sql = new Sql(config.sqlConfig());
      try {
        const info = await sql.info();
        const d = await discover(sql);
        console.log(`✔ SQL: ${info.surum} · veritabanı ${info.veritabani} · kullanıcı ${info.kim}${info.sysadmin ? " (UYARI: sysadmin — salt-okunur kullanıcı önerilir)" : ""}`);
        console.log(`  ${d.firmalar.length} firma, ${d.donemler.length} dönem: ${d.firmalar.map((f) => `F${f.firma} ${f.ad || ""}`).join(", ")}`);
      } catch (e) { console.error(`✘ SQL: ${humanError(e)}`); process.exitCode = 1; } finally { await sql.close(); }
      try {
        const h = await new Cloud(config.cloud(), { agent: { surum: pkg.version } }).hello({ surum: pkg.version, makine: require("os").hostname() });
        console.log(`✔ Bulut: ${h.firma.ad} (${h.firma.kod}) · eşitleme aralığı ${h.aralikDk} dk`);
      } catch (e) { console.error(`✘ Bulut: ${e.message}`); process.exitCode = 1; }
      break;
    }
    case "bir-kez": {
      const eng = new SyncEngine(config, { log });
      eng.on("status", (s) => { if (s.ilerleme && process.stdout.isTTY) process.stdout.write(`\r${s.ilerleme.adim}`.padEnd(70)); });
      const st = await eng.runOnce({ full: !!a.tam, reason: "cli" });
      if (process.stdout.isTTY) process.stdout.write("\n");
      console.log(JSON.stringify(st));
      break;
    }
    case "calistir": {
      const servis = !!a.servis;
      const stopFile = path.join(config.dir, "kopru-servis.dur");
      // Sunucu modunda ayarlar henüz tamam değilse bekle (tepsi uygulamasından girilecek)
      while (!config.ready()) {
        if (!servis) throw new Error(`Ayarlar eksik. Önce: vega-kopru kur … (ayar dosyası: ${config.file})`);
        if (fs.existsSync(stopFile)) return;
        log.warn("Ayarlar eksik; 60 sn sonra yeniden denenecek.");
        await new Promise((r) => setTimeout(r, 60000));
        config.reloadIfChanged();
      }
      const eng = new SyncEngine(config, { log, sahip: servis ? "servis" : "komut" });
      eng.start();
      log.info(`Vega Köprü ${pkg.version} çalışıyor (aralık ${eng.intervalMin} dk${servis ? ", sunucu modu" : ""}).${servis ? "" : " Durdurmak için Ctrl+C."}`);
      const stop = () => { eng.stop(); process.exit(0); };
      process.on("SIGINT", stop); process.on("SIGTERM", stop);
      if (servis) {
        const waitFile = path.join(config.dir, "kopru-servis.bekle");
        setInterval(() => {
          if (fs.existsSync(stopFile)) { log.info("Sunucu modu kaldırıldı; köprü kapanıyor."); stop(); }
          let w = null;
          try { w = fs.statSync(waitFile); } catch { /* yok */ }
          if (w && Date.now() - w.mtimeMs < 30 * 60000 && !eng.running) { log.info("Güncelleme kuruluyor; köprü geçici olarak kapanıyor."); stop(); }
        }, 10000);
      }
      break;
    }
    case "durum": {
      console.log(JSON.stringify({ ayarlar: config.public(), durum: config.state(), dosya: config.file }, null, 2));
      break;
    }
    default:
      console.log(require("fs").readFileSync(__filename, "utf8").split("\n").slice(1, 10).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  }
}

main().catch((e) => { console.error(`Hata: ${e.message}`); process.exit(1); });
