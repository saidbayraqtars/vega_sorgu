// Köprü alım protokolü: manifest farkı, çok parçalı staging, silme kapsamı, sürüm.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { TenantStore } = require("../src/db/tenant");
const { chunkKey, scopeKey, DATASETS } = require("../../shared/datasets");
const { tmpdir } = require("./helpers");

const COLS = DATASETS.cari_hareket.cols.map((c) => c[0]);
const row = (id, tarih, borc = 100) => [id, tarih, 101, 21, borc, 0, 1, "TL", tarih, "MERKEZ", 0, `A${id}`, 10];

test("manifest: yeni/değişen parçalar istenir, kapsamdaki eski parçalar silinir", () => {
  const s = new TenantStore(path.join(tmpdir(), "t.db"));
  const k1 = chunkKey("cari_hareket", "0101", "0017", "2026-01");
  const k2 = chunkKey("cari_hareket", "0101", "0017", "2026-02");
  const scope = scopeKey("cari_hareket", "0101", "0017");
  let d = s.diffManifest("s1", [{ key: k1, n: 1, ck: "a", sm: 100 }, { key: k2, n: 1, ck: "b", sm: 100 }], [scope]);
  assert.deepEqual(d.need.sort(), [k1, k2].sort());
  s.receiveChunk({ syncId: "s1", key: k1, n: 1, ck: "a", sm: 100, cols: COLS, rows: [row(1, "2026-01-05")] });
  s.receiveChunk({ syncId: "s1", key: k2, n: 1, ck: "b", sm: 100, cols: COLS, rows: [row(2, "2026-02-05")] });
  assert.equal(s.commit("s1").dataVersion, 1);
  assert.equal(s.db.value("SELECT COUNT(*) FROM cari_hareket"), 2);

  // Aynı parmak izi → istenmez; k2 manifestte yok → silinir
  d = s.diffManifest("s2", [{ key: k1, n: 1, ck: "a", sm: 100 }], [scope]);
  assert.deepEqual(d.need, []);
  assert.deepEqual(d.drop, [k2]);
  const r = s.commit("s2");
  assert.equal(r.dropped, 1);
  assert.equal(s.db.value("SELECT COUNT(*) FROM cari_hareket"), 1);

  // Kapsam dışı (taranmamış eski dönem) parçaları silinmez
  const kOld = chunkKey("cari_hareket", "0101", "0016", "2025-06");
  s.diffManifest("s3", [{ key: kOld, n: 1, ck: "x", sm: 1 }], [scopeKey("cari_hareket", "0101", "0016")]);
  s.receiveChunk({ syncId: "s3", key: kOld, n: 1, ck: "x", sm: 1, cols: COLS, rows: [row(9, "2025-06-01")] });
  s.commit("s3");
  d = s.diffManifest("s4", [{ key: k1, n: 1, ck: "a", sm: 100 }], [scope]); // yalnız 0017 tarandı
  assert.deepEqual(d.drop, []);
  s.commit("s4");
  assert.equal(s.db.value("SELECT COUNT(*) FROM cari_hareket WHERE donem = '0016'"), 1);
  s.close();
});

test("çok parçalı gönderim: son parça gelmeden eski veri korunur, sonra atomik değişir", () => {
  const s = new TenantStore(path.join(tmpdir(), "t.db"));
  const k = chunkKey("cari_hareket", "0101", "0017", "2026-03");
  s.diffManifest("a", [{ key: k, n: 1, ck: "1", sm: 0 }], []);
  s.receiveChunk({ syncId: "a", key: k, n: 1, ck: "1", sm: 0, cols: COLS, rows: [row(1, "2026-03-01")] });
  s.commit("a");
  s.diffManifest("b", [{ key: k, n: 3, ck: "2", sm: 0 }], []);
  s.receiveChunk({ syncId: "b", key: k, n: 3, ck: "2", sm: 0, cols: COLS, rows: [row(10, "2026-03-02"), row(11, "2026-03-03")], seq: 0, last: false });
  // henüz son parça gelmedi: eski satır duruyor
  assert.deepEqual(s.db.all("SELECT id FROM cari_hareket ORDER BY id").map((r) => r.id), [1]);
  s.receiveChunk({ syncId: "b", key: k, n: 3, ck: "2", sm: 0, cols: COLS, rows: [row(12, "2026-03-04")], seq: 1, last: true });
  assert.deepEqual(s.db.all("SELECT id FROM cari_hareket ORDER BY id").map((r) => r.id), [10, 11, 12]);
  assert.equal(s.db.value("SELECT COUNT(*) FROM stage"), 0);
  s.close();
});

test("zenginleştirme: döviz kasa ve açılış devri satırı işaretlenir", () => {
  const s = new TenantStore(path.join(tmpdir(), "t.db"));
  const cols = DATASETS.kasa_hareket.cols.map((c) => c[0]);
  const k = chunkKey("kasa_hareket", "0101", "0017", "2026-01");
  s.diffManifest("z", [{ key: k, n: 2, ck: "1", sm: 0 }], []);
  s.receiveChunk({ syncId: "z", key: k, n: 2, ck: "1", sm: 0, cols, rows: [
    [1, "2025-12-31", "MERKEZ KASA", "MERKEZ", 5000, 0, 1, "TL", 1, 0, 0, "2026 AÇILIŞ DEVRİ"],
    [2, "2026-01-02", "İÇ KASA EURO", "MERKEZ", 100, 0, 1, "TL", 1, 0, 0, "EURO GİRİŞ"],
  ] });
  const rows = s.db.all("SELECT id, dv, devir FROM kasa_hareket ORDER BY id");
  assert.deepEqual(rows.map((r) => [r.id, r.dv, r.devir]), [[1, null, 1], [2, "EUR", 0]]);
  s.close();
});

test("hatalı kolon listesi ve bilinmeyen veri kümesi reddedilir", () => {
  const s = new TenantStore(path.join(tmpdir(), "t.db"));
  assert.throws(() => s.receiveChunk({ syncId: "x", key: chunkKey("cari_hareket", "0101", "0017", "2026-01"), cols: ["id"], rows: [] }), /kolonlar uyuşmuyor/);
  assert.throws(() => s.diffManifest("x", [{ key: "yok|0101||", n: 0, ck: "", sm: 0 }], []), /Bilinmeyen/);
  s.close();
});
