// Katalogdaki HER rapor demo veride çalışmalı: hata yok, beklenen sonuç türü, sonlu sayılar.

const test = require("node:test");
const assert = require("node:assert/strict");
const { demoStore, ctx, findNonFinite } = require("./helpers");
const CAT = require("../src/engine/catalog");
const { validateWidgets, defaultBoards } = require("../src/routes/boards");

test("katalog: yüzlerce benzersiz rapor, geçerli meta veri", () => {
  const list = CAT.catalog();
  assert.ok(list.length >= 500, `rapor sayısı ${list.length}`);
  const ids = new Set(list.map((r) => r.id));
  assert.equal(ids.size, list.length, "yinelenen rapor kimliği");
  const kats = new Set(CAT.KATEGORILER.map((k) => k.id));
  for (const r of list) {
    assert.ok(r.ad && r.kisa && r.ikon && r.tur && r.grafik, r.id);
    assert.ok(kats.has(r.kategori), `${r.id}: kategori ${r.kategori}`);
    assert.ok(r.grafikler.includes(r.grafik), `${r.id}: varsayılan grafik izinli değil`);
  }
});

test("katalog: tüm raporlar demo veride çalışır", { timeout: 10 * 60000 }, () => {
  const store = demoStore();
  const failures = [];
  let n = 0;
  for (const r of CAT.catalog()) {
    try {
      const out = CAT.run(ctx(store), r.id, {});
      const s = out.sonuc;
      if (!s || !s.tur) throw new Error("sonuç türü yok");
      if (!r.ozel && s.tur !== r.tur) throw new Error(`tür ${s.tur} ≠ ${r.tur}`);
      const bad = findNonFinite(out);
      if (bad) throw new Error(`sonlu olmayan sayı: ${bad}`);
      JSON.stringify(out);
      n++;
    } catch (e) {
      failures.push(`${r.id}: ${e.message}`);
    }
  }
  assert.deepEqual(failures, []);
  assert.ok(n >= 500);
});

test("katalog: dönem/boyut parametreleri uygulanır", () => {
  const store = demoStore();
  const a = CAT.run(ctx(store), "satis.top.cari", { donem: "son12", n: 5 });
  assert.equal(a.sonuc.satirlar.length, 5);
  assert.ok(a.sonuc.diger);
  const b = CAT.run(ctx(store), "net_ciro.trend.ay", { donem: "ozel", bas: "2025-01-15", bit: "2025-06-30" });
  assert.equal(b.donem.bas, "2025-01-01"); // kova başına hizalandı
  assert.equal(b.sonuc.seriler[0].veri.length, 6);
  assert.throws(() => CAT.run(ctx(store), "yok.rapor", {}), /bulunamadı/);
  assert.throws(() => CAT.run(ctx(store), "satis.kpi", { donem: "bilinmeyen" }), /Bilinmeyen dönem/);
});

test("varsayılan panolar geçerli kutular içerir", () => {
  for (const b of defaultBoards()) assert.equal(validateWidgets(b.widgets).length, b.widgets.length);
  assert.throws(() => validateWidgets([{ rapor: "satis.kpi", grafik: "pasta" }]), /geçersiz grafik/);
  assert.throws(() => validateWidgets([{ rapor: "yok" }]), /Bilinmeyen rapor/);
  const w = validateWidgets([{ rapor: "satis.trend.ay", boyut: "x", n: 1000, donem: "son12" }])[0];
  assert.equal(w.boyut, "m");
  assert.equal(w.n, 100);
});
