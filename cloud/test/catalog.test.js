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
  assert.equal(w.n, 500);
});

test("özel raporlar: iyi yönü ve seçiciler tanımlı; dönemsizlerde donem: null", () => {
  const O = require("../src/engine/special");
  assert.deepEqual(Object.keys(O.EK).sort(), [...O.DEF_IDS].sort(), "her özel raporun ek bilgisi olmalı");
  for (const r of CAT.catalog()) {
    assert.ok(r.parametreler && typeof r.parametreler.donem === "boolean", r.id);
    if (r.ozel) assert.ok(["yukari", "asagi", "notr"].includes(r.iyi), `${r.id}: iyi`);
    if (r.parametreler.n) {
      assert.ok(r.parametreler.nSecenekler.includes(r.parametreler.nVarsayilan), `${r.id}: varsayılan N seçeneklerde`);
    } else assert.equal(r.parametreler.nVarsayilan, null);
  }
  const store = demoStore();
  assert.equal(CAT.run(ctx(store), "ozel.kasa_durumu", {}).donem, null);
  assert.equal(CAT.run(ctx(store), "ozel.saglik", {}).donem, null);
  assert.equal(CAT.run(ctx(store), "ozel.kasa_bakiye_seyri", {}).donem.kod, "son12");
  assert.equal(CAT.run(ctx(store), "ozel.vade_takvimi", {}).rapor.iyi, "notr");
  assert.equal(CAT.run(ctx(store), "ozel.dso_seyri", {}).rapor.iyi, "asagi");
});

test("dönem bayrağı doğru: dönemsiz raporda dönem sonucu değiştirmez, dönemli raporda değiştirir", () => {
  const store = demoStore();
  const js = (id, q) => JSON.stringify(CAT.run(ctx(store), id, q).sonuc);
  for (const r of CAT.catalog().filter((x) => x.ozel)) {
    const a = js(r.id, { donem: "bu_yil" });
    const b = js(r.id, { donem: "gecen_yil" });
    if (r.donemsiz) assert.equal(a, b, `${r.id} dönemsiz işaretli ama dönem sonucu değiştiriyor`);
    else assert.notEqual(a, b, `${r.id} dönem kullanıyor ama dönemsiz sanılabilir`);
  }
});

test("kırılım ve N bayrakları doğru: yalnız işaretli raporlar parametreye tepki verir", () => {
  const store = demoStore();
  const js = (id, q) => JSON.stringify(CAT.run(ctx(store), id, q).sonuc);
  for (const r of CAT.catalog().filter((x) => x.ozel)) {
    const n1 = js(r.id, { n: 3 });
    const n2 = js(r.id, { n: 500 });
    if (!r.parametreler.n) assert.equal(n1, n2, `${r.id}: N işaretsiz ama sonucu değiştiriyor`);
    if (r.parametreler.kirilim) assert.notEqual(js(r.id, { kirilim: "hafta" }), js(r.id, { kirilim: "ay" }), `${r.id}: kırılım`);
  }
});

test("ilk N: satır sayısı N'ye eşit, varsayılan katalogdaki nVarsayilan", () => {
  const store = demoStore();
  const say = (id, q = {}) => {
    const s = CAT.run(ctx(store), id, q).sonuc;
    const t = s.tur === "coklu" ? s.parcalar.find((p) => p.tur === "tablo") : s;
    return { n: t.satirlar.length, adet: t.adet };
  };
  assert.equal(say("satis.top.cari").n, 10);
  assert.equal(say("satis.top.cari", { n: 20 }).n, 20);
  const p = say("satis.pareto.cari", { donem: "son12" });
  assert.equal(p.n, Math.min(30, p.adet));
  assert.equal(say("satis.pareto.cari", { n: 10, donem: "son12" }).n, 10);
  const b = say("ozel.borclu_musteriler");
  assert.equal(b.n, Math.min(100, b.adet));
  assert.equal(say("ozel.borclu_musteriler", { n: 25 }).n, Math.min(25, b.adet));
  const y = say("ozel.alacak_yaslandirma", { n: 25 });
  assert.equal(y.n, Math.min(25, y.adet));
  assert.equal(CAT.run(ctx(store), "satis.top.cari", { n: 20 }).n, 20); // uygulanan N yanıtta
});
