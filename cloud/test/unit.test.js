// Saf birim testleri: dönemler, istatistik, Türkçe ekler, ayarlar.

const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../src/engine/period");
const S = require("../src/engine/stats");
const tr = require("../src/util/tr");
const { resolveSettings, sanitizeSettingsPatch } = require("../src/engine/settings");
const { parseTcmb } = require("../src/fx");
const { detectDoviz, normPb } = require("../../shared/doviz");

test("dönem hazır ayarları", () => {
  const t = "2026-09-24"; // Perşembe
  assert.deepEqual([P.resolvePeriod("bugun", { today: t }).bas, P.resolvePeriod("bugun", { today: t }).bit], [t, t]);
  assert.equal(P.resolvePeriod("bu_hafta", { today: t }).bas, "2026-09-21"); // Pazartesi
  assert.equal(P.resolvePeriod("bu_ay", { today: t }).bas, "2026-09-01");
  const ga = P.resolvePeriod("gecen_ay", { today: t });
  assert.deepEqual([ga.bas, ga.bit], ["2026-08-01", "2026-08-31"]);
  assert.equal(P.resolvePeriod("son30", { today: t }).gun, 30);
  assert.equal(P.resolvePeriod("son12", { today: t }).bas, "2025-09-25");
  assert.equal(P.resolvePeriod("bu_ceyrek", { today: t }).bas, "2026-07-01");
  assert.throws(() => P.resolvePeriod("ozel", { today: t, bas: "2026-01-01" }), /bas ve bit/);
  assert.throws(() => P.resolvePeriod("yok", { today: t }));
  const oz = P.resolvePeriod("ozel", { today: t, bas: "2026-03-10", bit: "2026-03-01" });
  assert.deepEqual([oz.bas, oz.bit], ["2026-03-01", "2026-03-10"]);
});

test("önceki ve geçen yıl dönemleri (ay hizalı, 29 Şubat)", () => {
  const p = P.resolvePeriod("bu_ay", { today: "2026-09-24" });
  const o = P.previousPeriod(p);
  assert.deepEqual([o.bas, o.bit], ["2026-08-01", "2026-08-24"]);
  const ly = P.lastYearPeriod({ bas: "2024-02-29", bit: "2024-02-29" });
  assert.deepEqual([ly.bas, ly.bit], ["2023-02-28", "2023-02-28"]);
  const o2 = P.previousPeriod(P.resolvePeriod("son30", { today: "2026-09-24" }));
  assert.equal(o2.gun, 30);
  assert.equal(o2.bit, "2026-08-25");
});

test("zaman kovaları", () => {
  assert.equal(P.bucketOf("hafta", "2026-09-27"), "2026-09-21"); // Pazar → Pazartesi
  assert.equal(P.bucketOf("ceyrek", "2026-11-02"), "2026-Q4");
  assert.deepEqual(P.enumerateBuckets("ay", "2025-11-15", "2026-02-01"), ["2025-11", "2025-12", "2026-01", "2026-02"]);
  assert.equal(P.bucketEnd("ay", "2024-02"), "2024-02-29");
  assert.equal(P.bucketEnd("ceyrek", "2026-Q1"), "2026-03-31");
  assert.equal(P.bucketLabel("ay", "2026-09"), "Eyl 2026");
  assert.equal(P.addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(P.weekday("2026-09-24"), 3);
});

test("istatistik: büyüme, Theil–Sen, eğilim, puanlama", () => {
  assert.ok(Math.abs(S.growth(120, 100) - 0.2) < 1e-12);
  assert.equal(S.growth(10, 0.5), null); // taban çok küçük
  assert.equal(S.growth(-50, -100), 0.5); // negatif tabanda işaret korunur
  // Theil–Sen aykırı değere dayanıklı
  const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const ys = xs.map((x) => 2 * x + 1);
  ys[5] = 500;
  const f = S.theilSen(xs, ys);
  assert.ok(Math.abs(f.b - 2) < 1e-9);
  // Aylık %2 büyüyen seri → yıllık ≈ %26.8
  const vals = Array.from({ length: 24 }, (_, i) => 100 * 1.02 ** i);
  assert.ok(Math.abs(S.annualizedTrend(vals) - (1.02 ** 12 - 1)) < 1e-9);
  assert.equal(S.annualizedTrend([1, 2, 3]), null);
  const anchors = [[0, 0], [10, 50], [20, 100]];
  assert.equal(S.scorePiecewise(5, anchors), 25);
  assert.equal(S.scorePiecewise(-5, anchors), 0);
  assert.equal(S.scorePiecewise(99, anchors), 100);
  assert.equal(S.scorePiecewise(null, anchors), null);
  const c = S.concentration([50, 30, 10, 5, 5], 2);
  assert.equal(c.topShare, 0.8);
});

test("istatistik: Holt-Winters mevsimsel seriyi yakalar", () => {
  const season = [0.8, 0.9, 1, 1.1, 1.2, 1.1, 0.9, 0.8, 1, 1.1, 1.2, 1.3];
  const series = Array.from({ length: 36 }, (_, i) => 1000 * (1 + 0.01 * i) * season[i % 12]);
  const fc = S.holtWinters(series, 12, 3);
  assert.equal(fc.length, 3);
  const expected = [36, 37, 38].map((i) => 1000 * (1 + 0.01 * i) * season[i % 12]);
  fc.forEach((f, i) => assert.ok(Math.abs(f.deger - expected[i]) / expected[i] < 0.12, `tahmin ${i}: ${f.deger} vs ${expected[i]}`));
  assert.equal(S.holtWinters(series.slice(0, 20), 12, 3), null);
});

test("Türkçe iyelik ekleri", () => {
  assert.equal(tr.iyelik("%37"), "%37'si");
  assert.equal(tr.iyelik("%10"), "%10'u");
  assert.equal(tr.iyelik("%40"), "%40'ı");
  assert.equal(tr.iyelik("%0,5"), "%0,5'i");
  assert.equal(tr.iyelikBelirtme("%25"), "%25'ini");
  assert.equal(tr.iyelikTamlayan("%20"), "%20'sinin");
  assert.equal(tr.iyelik("%100"), "%100'ü");
});

test("ayarlar: varsayılanlar ve doğrulama", () => {
  const s = resolveSettings({});
  assert.deepEqual(s.izahat.TAHSILAT, [13, 83]);
  assert.equal(s.enflasyon, null);
  assert.equal(resolveSettings({ syncDakika: 1 }).syncDakika, 5);
  assert.deepEqual(resolveSettings({ izahat: { SATIS: [21, "27"] } }).izahat.SATIS, [21, 27]);
  assert.throws(() => sanitizeSettingsPatch({ enflasyon: 900 }), /Enflasyon/);
  assert.throws(() => sanitizeSettingsPatch({ firmalar: ["101"] }), /4 haneli/);
  assert.deepEqual(sanitizeSettingsPatch({ enflasyon: "", sektor: "toptan" }), { enflasyon: null, sektor: "toptan" });
});

test("döviz tespiti (hesap adından)", () => {
  assert.equal(detectDoviz("HALKBANK-EURO", "TL"), "EUR");
  assert.equal(detectDoviz("İÇ KASA DOLAR", ""), "USD");
  assert.equal(detectDoviz("İŞ BANKASI TL", "TL"), null);
  assert.equal(detectDoviz("X", "€"), "EUR");
  assert.equal(detectDoviz("İÇ KASA STERLİN", null), "GBP");
  assert.equal(normPb("₺"), "TL");
});

test("TCMB XML ayrıştırma", () => {
  const xml = `<Tarih_Date Tarih="24.09.2026"><Currency CrossOrder="0" Kod="USD" CurrencyCode="USD"><Unit>1</Unit><ForexSelling>41.2300</ForexSelling></Currency>
  <Currency Kod="JPY" CurrencyCode="JPY"><Unit>100</Unit><ForexSelling>28.10</ForexSelling></Currency></Tarih_Date>`;
  const r = parseTcmb(xml);
  assert.equal(r.kurlar.USD, 41.23);
  assert.ok(Math.abs(r.kurlar.JPY - 0.281) < 1e-9);
  assert.equal(r.tarih, "24.09.2026");
});
