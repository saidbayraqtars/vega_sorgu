// Uçtan uca köprü testi — gerçek SQL Server gerekir:
//   MSSQL_E2E=1 MSSQL_SA_PASSWORD=... node --test test/e2e-mssql.test.js
// Akış: demo üreteci → SQL Server (Türkçe harmanlama, 2008 uyumluluk, salt-okunur Türkçe kullanıcı)
//       → köprü (gerçek SQL) → bulut API → kiracı DB  ==  JS kahini (rawToCanonical) → kiracı DB
// Sonra artımlı eşitleme: SQL'de satır ekle/güncelle/sil → yalnız değişen parçalar gider.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const sql = require("mssql");

const SKIP = !process.env.MSSQL_E2E;
const ROOT = path.join(__dirname, "..", "..");
const TODAY = "2026-09-24";

function tmpdir(p) { return fs.mkdtempSync(path.join(os.tmpdir(), p)); }

async function startCloud(dataDir) {
  process.env.TCMB_KURLARI = "0";
  const { loadConfig } = require(path.join(ROOT, "cloud/src/config"));
  const { Registry } = require(path.join(ROOT, "cloud/src/db/registry"));
  const { TenantManager } = require(path.join(ROOT, "cloud/src/tenants"));
  const { createApp } = require(path.join(ROOT, "cloud/src/app"));
  const config = { ...loadConfig({}), dataDir, kurlarAktif: false, webDir: "/yok" };
  const registry = new Registry(path.join(dataDir, "registry.db"));
  const tenants = new TenantManager(dataDir);
  const app = createApp({ registry, tenants, fx: null, config });
  const server = await new Promise((res) => { const s = app.listen(0, "127.0.0.1", () => res(s)); });
  return { registry, tenants, server, url: `http://127.0.0.1:${server.address().port}` };
}

function tableRows(store, ds) {
  const { DATASETS } = require(path.join(ROOT, "shared/datasets"));
  const def = DATASETS[ds];
  const pre = def.scope === "global" ? [] : def.scope === "firma" ? ["firma"] : ["firma", "donem"];
  const cols = [...pre, ...def.cols.map((c) => c[0])];
  return store.db.all(`SELECT ${cols.join(",")} FROM ${ds}`).map((r) => cols.map((c) => r[c]));
}

function normRow(r) {
  return r.map((v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v === "" ? null : v));
}

function compareStores(a, b, label) {
  const { DATASET_NAMES } = require(path.join(ROOT, "shared/datasets"));
  const diffs = [];
  for (const ds of DATASET_NAMES) {
    const ra = tableRows(a, ds).map(normRow).map((r) => JSON.stringify(r)).sort();
    const rb = tableRows(b, ds).map(normRow).map((r) => JSON.stringify(r)).sort();
    if (ra.length !== rb.length) { diffs.push(`${ds}: satır sayısı ${ra.length} ≠ ${rb.length}`); continue; }
    let bad = 0; let ex = null;
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) { bad++; if (!ex) ex = `${ra[i]}\n   ≠ ${rb[i]}`; }
    if (bad) diffs.push(`${ds}: ${bad} satır farklı. Örnek:\n   ${ex}`);
  }
  assert.deepStrictEqual(diffs, [], `${label}:\n${diffs.join("\n")}`);
}

test("köprü: gerçek SQL Server → bulut, JS kahini ile birebir", { skip: SKIP, timeout: 20 * 60000 }, async () => {
  const { generateRaw } = require(path.join(ROOT, "cloud/src/demo/generator"));
  const { rawToCanonical } = require(path.join(ROOT, "cloud/src/demo/canonical"));
  const { loadCanonical } = require(path.join(ROOT, "cloud/src/demo/load"));
  const { TenantStore } = require(path.join(ROOT, "cloud/src/db/tenant"));
  const { Context } = require(path.join(ROOT, "cloud/src/engine/context"));
  const { overview } = require(path.join(ROOT, "cloud/src/engine/overview"));
  const { loadRawToMssql } = require("./mssql-loader");
  const { Config } = require("../src/config");
  const { SyncEngine } = require("../src/sync");

  const raw = generateRaw({ today: TODAY, olcek: Number(process.env.OLCEK || 0.3), seed: 7 });
  const t0 = Date.now();
  const ms = await loadRawToMssql(raw, { saPassword: process.env.MSSQL_SA_PASSWORD });
  console.log(`SQL Server'a yüklendi: ${ms.rows} satır (${Date.now() - t0} ms)`);

  const dataDir = tmpdir("vb-e2e-");
  const cloud = await startCloud(dataDir);
  try {
    const tenant = cloud.registry.createTenant({ slug: "e2e", ad: "E2E" });
    const token = cloud.registry.createBridgeToken(tenant.id, "test");
    const cfgDir = tmpdir("vk-e2e-");
    const config = new Config(cfgDir);
    config.update({ sql: { server: "127.0.0.1", port: 1433, database: "VEGADB", user: ms.roUser, password: ms.roPassword }, bulut: { url: cloud.url, anahtar: token } });
    const log = { info: (m) => console.log(m), error: (m) => console.error(m) };
    const eng = new SyncEngine(config, { log, now: () => new Date(`${TODAY}T12:00:00Z`) });

    const s1 = await eng.runOnce({ reason: "test" });
    console.log("ilk eşitleme", s1);
    assert.ok(s1.gonderilen > 0 && s1.gonderilen === s1.parca, "ilk eşitlemede tüm parçalar gitmeli");

    const bridged = cloud.tenants.get(tenant);
    const oracle = new TenantStore(path.join(dataDir, "kahin.db"));
    loadCanonical(oracle, rawToCanonical(raw));
    compareStores(bridged, oracle, "ilk eşitleme");

    // Motor çıktıları da birebir olmalı
    const o1 = overview(new Context(bridged, { enflasyon: 25 }, { today: TODAY }));
    const o2 = overview(new Context(oracle, { enflasyon: 25 }, { today: TODAY }));
    assert.strictEqual(o1.saglik.skor, o2.saglik.skor);
    assert.strictEqual(Math.round(o1.buyume.yuzde * 1e6), Math.round(o2.buyume.yuzde * 1e6));
    assert.strictEqual(Math.round(o1.durum.kasa), Math.round(o2.durum.kasa));
    assert.strictEqual(Math.round(o1.durum.alacak), Math.round(o2.durum.alacak));

    // İkinci tur: hiçbir şey değişmedi → hiçbir parça gitmemeli
    const s2 = await eng.runOnce({ reason: "test" });
    assert.strictEqual(s2.gonderilen, 0, "değişiklik yokken parça gönderilmemeli");

    // Artımlı: SQL'de ekle / güncelle / sil
    const pool = await new sql.ConnectionPool({ server: "127.0.0.1", port: 1433, user: "sa", password: process.env.MSSQL_SA_PASSWORD, database: "VEGADB", options: { encrypt: false, trustServerCertificate: true } }).connect();
    const F = raw.F["0101"], D = F.D["0017"];
    const ch = D.TBLCARIHAREKETLERI;
    const newInd = Math.max(...ch.map((r) => r.IND)) + 1;
    const c0 = F.TBLCARI.find((c) => c.IND >= 100);
    const yeni = { IND: newInd, FIRMANO: c0.IND, TARIH: "2026-09-24", IZAHAT: "21", EVRAKNO: "TEST0001", BORC: 12345.67, ALACAK: 0, KUR: 1, PARABIRIMI: "TL",
      ODEMETARIHI: "2026-10-24", ISLEMTARIHI: "2026-09-24 11:00:00", OZELKOD: "MERKEZ", IADE: 0 };
    await pool.request().input("t", sql.DateTime, new Date("2026-09-24T00:00:00Z")).input("o", sql.DateTime, new Date("2026-10-24T00:00:00Z"))
      .input("i", sql.DateTime, new Date("2026-09-24T11:00:00Z"))
      .query(`INSERT INTO F0101D0017TBLCARIHAREKETLERI (IND, FIRMANO, TARIH, IZAHAT, EVRAKNO, BORC, ALACAK, KUR, PARABIRIMI, ODEMETARIHI, ISLEMTARIHI, OZELKOD, IADE)
        VALUES (${newInd}, ${c0.IND}, @t, N'21', N'TEST0001', 12345.67, 0, 1, N'TL', @o, @i, N'MERKEZ', 0)`);
    ch.push(yeni);
    const old = ch.find((r) => r.TARIH.startsWith("2026-02") && Number(r.BORC) > 0 && r.IZAHAT === "21");
    await pool.request().query(`UPDATE F0101D0017TBLCARIHAREKETLERI SET BORC = BORC + 1000 WHERE IND = ${old.IND}`);
    old.BORC = Math.round((Number(old.BORC) + 1000) * 100) / 100;
    const ks = D.TBLKASA.find((r) => r.TARIH.startsWith("2026-03") && r.ISLEMTIPI === 1 && Number(r.GIDER) > 0);
    await pool.request().query(`DELETE FROM F0101D0017TBLKASA WHERE IND = ${ks.IND}`);
    D.TBLKASA.splice(D.TBLKASA.indexOf(ks), 1);
    await pool.close();

    const s3 = await eng.runOnce({ reason: "test" });
    console.log("artımlı eşitleme", s3);
    assert.strictEqual(s3.gonderilen, 3, "yalnız değişen 3 parça (Eylül ve Şubat cari, Mart kasa) gitmeli");
    const oracle2 = new TenantStore(path.join(dataDir, "kahin2.db"));
    loadCanonical(oracle2, rawToCanonical(raw));
    compareStores(bridged, oracle2, "artımlı eşitleme");
    oracle.close(); oracle2.close();
  } finally {
    cloud.server.close();
    cloud.tenants.closeAll();
    cloud.registry.close();
  }
});
