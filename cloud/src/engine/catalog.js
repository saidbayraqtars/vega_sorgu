// ═══════════════════════════════════════════════════════════════════════════
//  Rapor kataloğu — yüzlerce rapor, tek kurala bağlı üretim:
//    ölçü × görünüm (kpi, trend, yoy, kümülatif, mevsim, ısı) +
//    ölçü × boyut × (top, pay, karşılaştır, pareto, dağılım) +
//    elle yazılmış özel raporlar (sağlık, büyüme, bilanço, yaşlandırma, RFM, ABC…)
//  Her rapor: id, başlık, kısa ad, ikon, kategori, varsayılan grafik ve dönem.
//  Sonuç türleri (arayüz sözleşmesi): kpi | seri | kategori | matris | tablo | coklu
//                                     + saglik | buyume | durum | projeksiyon
// ═══════════════════════════════════════════════════════════════════════════

const P = require("./period");
const Q = require("./query");
const S = require("./stats");
const { MEASURES, DIMENSIONS, dimsForMeasure } = require("./model");
const OZEL = require("./special");

const KATEGORILER = [
  { id: "durum", ad: "Genel Durum", ikon: "Gauge", renk: "indigo" },
  { id: "satis", ad: "Satış", ikon: "ShoppingCart", renk: "blue" },
  { id: "karlilik", ad: "Kârlılık", ikon: "PiggyBank", renk: "emerald" },
  { id: "musteri", ad: "Müşteriler", ikon: "Users", renk: "violet" },
  { id: "urun", ad: "Ürünler", ikon: "Package", renk: "amber" },
  { id: "stok", ad: "Stok", ikon: "Warehouse", renk: "orange" },
  { id: "tahsilat", ad: "Tahsilat & Alacak", ikon: "HandCoins", renk: "teal" },
  { id: "alis", ad: "Alış & Tedarik", ikon: "Truck", renk: "slate" },
  { id: "nakit", ad: "Kasa", ikon: "Wallet", renk: "green" },
  { id: "banka", ad: "Banka", ikon: "Landmark", renk: "sky" },
  { id: "cek", ad: "Çek & Senet", ikon: "Ticket", renk: "rose" },
  { id: "siparis", ad: "Sipariş", ikon: "ClipboardList", renk: "cyan" },
  { id: "veri", ad: "Veri Kontrolü", ikon: "ShieldCheck", renk: "gray" },
];

const GRAN_AD = { gun: "Günlük", hafta: "Haftalık", ay: "Aylık", ceyrek: "Çeyreklik", yil: "Yıllık" };
const TREND_DONEM = { gun: "son30", hafta: "son90", ay: "son12", ceyrek: "tumu", yil: "tumu" };
const YOY_DONEM = { gun: "bu_ay", hafta: "bu_ceyrek", ay: "bu_yil" };
const GRAFIK = {
  kpi: ["sayi"],
  seri: ["cizgi", "alan", "sutun", "tablo"],
  kategori: ["cubuk", "pasta", "agac", "tablo"],
  kategoriOran: ["cubuk", "tablo"],
  dagilim: ["sutun", "cubuk", "tablo"],
  karsilastir: ["karsilastir", "tablo"],
  pareto: ["pareto", "tablo"],
  matris: ["isi", "tablo"],
  tablo: ["tablo"],
};

function additive(m) { return !m.d && m.additive !== false && !m.combo; }

// ─── Katalog üretimi ──────────────────────────────────────────────────────
function buildCatalog() {
  const list = [];
  const add = (r) => list.push(r);
  for (const [mid, m] of Object.entries(MEASURES)) {
    const base = { olcu: mid, kategori: m.kat, birim: m.birim, iyi: m.iyi };
    add({ ...base, id: `${mid}.kpi`, ad: m.ad, kisa: m.kisa, ikon: m.ikon, gorunum: "kpi", tur: "kpi", grafik: "sayi", grafikler: GRAFIK.kpi,
      donem: "bu_ay", aciklama: m.aciklama });
    for (const g of Object.keys(GRAN_AD)) {
      add({ ...base, id: `${mid}.trend.${g}`, ad: `${m.ad} — ${GRAN_AD[g]} Trend`, kisa: `${m.kisa} ${GRAN_AD[g].toLocaleLowerCase("tr-TR")}`,
        ikon: "LineChart", gorunum: "trend", kirilim: g, tur: "seri", grafik: g === "gun" || g === "hafta" ? "alan" : "sutun", grafikler: GRAFIK.seri,
        donem: TREND_DONEM[g], aciklama: `${m.aciklama} ${GRAN_AD[g]} kırılımda.` });
    }
    for (const g of Object.keys(YOY_DONEM)) {
      add({ ...base, id: `${mid}.yoy.${g}`, ad: `${m.ad} — Geçen Yılla ${GRAN_AD[g]}`, kisa: `${m.kisa} vs geçen yıl`,
        ikon: "GitCompareArrows", gorunum: "yoy", kirilim: g, tur: "seri", grafik: g === "gun" ? "cizgi" : "sutun", grafikler: GRAFIK.seri,
        donem: YOY_DONEM[g], aciklama: `Seçilen dönem ile geçen yılın aynı dönemi yan yana (${GRAN_AD[g].toLocaleLowerCase("tr-TR")}).` });
    }
    if (additive(m)) {
      add({ ...base, id: `${mid}.kumulatif`, ad: `${m.ad} — Yıl Boyu Kümülatif`, kisa: `${m.kisa} kümülatif`, ikon: "TrendingUp", gorunum: "kumulatif",
        tur: "seri", grafik: "cizgi", grafikler: GRAFIK.seri, donem: "bu_yil", aciklama: "Yıl başından itibaren birikimli toplam; geçen yılın aynı eğrisiyle." });
      add({ ...base, id: `${mid}.isi`, ad: `${m.ad} — Haftalık Isı Haritası`, kisa: `${m.kisa} ısı`, ikon: "Grid3x3", gorunum: "isi",
        tur: "matris", grafik: "isi", grafikler: GRAFIK.matris, donem: "son90", aciklama: "Haftanın günleri × haftalar: yoğun ve durgun günler." });
    }
    add({ ...base, id: `${mid}.mevsim`, ad: `${m.ad} — Mevsimsellik`, kisa: `${m.kisa} mevsim`, ikon: "Sun", gorunum: "mevsim",
      tur: "matris", grafik: "isi", grafikler: GRAFIK.matris, donem: "tumu", aciklama: "Aylar × yıllar: hangi aylar güçlü, yıllar arası fark." });
    for (const did of dimsForMeasure(mid)) {
      const d = DIMENSIONS[did];
      const dAd = did === "cari" && m.cariAd ? m.cariAd : d.ad;
      const db = { ...base, boyut: did, boyutAd: dAd };
      if (d.sirali) {
        add({ ...db, id: `${mid}.dagilim.${did}`, ad: `${m.ad} — ${dAd} Dağılımı`, kisa: `${m.kisa} / ${dAd.toLocaleLowerCase("tr-TR")}`, ikon: d.ikon,
          gorunum: "dagilim", tur: "kategori", grafik: "sutun", grafikler: GRAFIK.dagilim, donem: "son90", aciklama: `${m.ad}, ${dAd.toLocaleLowerCase("tr-TR")} bazında.` });
        continue;
      }
      add({ ...db, id: `${mid}.top.${did}`, ad: `${m.ad} — ${dAd} Sıralaması`, kisa: `En iyi ${dAd.toLocaleLowerCase("tr-TR")}`, ikon: d.ikon,
        gorunum: "top", tur: "kategori", grafik: "cubuk", grafikler: additive(m) ? GRAFIK.kategori : GRAFIK.kategoriOran, donem: "bu_yil",
        aciklama: `${dAd} bazında ${m.ad.toLocaleLowerCase("tr-TR")} — en yüksekten düşüğe.` });
      if (additive(m) && m.birim !== "%") {
        add({ ...db, id: `${mid}.pay.${did}`, ad: `${m.ad} — ${dAd} Payları`, kisa: `${m.kisa} payı`, ikon: "PieChart",
          gorunum: "pay", tur: "kategori", grafik: "pasta", grafikler: GRAFIK.kategori, donem: "bu_yil", aciklama: `Toplam ${m.ad.toLocaleLowerCase("tr-TR")} içindeki paylar.` });
      }
      add({ ...db, id: `${mid}.karsilastir.${did}`, ad: `${m.ad} — ${dAd} Karşılaştırma`, kisa: `${dAd} değişimi`, ikon: "ArrowUpDown",
        gorunum: "karsilastir", tur: "kategori", grafik: "karsilastir", grafikler: GRAFIK.karsilastir, donem: "bu_ay",
        aciklama: `Seçilen dönem ile önceki dönem arasında en çok artan ve azalan ${dAd.toLocaleLowerCase("tr-TR")}.` });
      if (additive(m) && ["cari", "urun"].includes(did) && m.iyi !== "asagi") {
        add({ ...db, id: `${mid}.pareto.${did}`, ad: `${m.ad} — ${dAd} ABC (Pareto)`, kisa: `${dAd} ABC`, ikon: "BarChart3",
          gorunum: "pareto", tur: "kategori", grafik: "pareto", grafikler: GRAFIK.pareto, donem: "son12",
          aciklama: "Toplamın %80'ini oluşturanlar A, sonraki %15 B, kalanlar C." });
      }
    }
  }
  for (const r of OZEL.LIST) add({ ...r, ozel: true, grafikler: r.grafikler || GRAFIK[r.tur] || ["tablo"] });
  return list;
}

let CATALOG = null;
let INDEX = null;
function catalog() {
  if (!CATALOG) {
    CATALOG = buildCatalog();
    INDEX = new Map(CATALOG.map((r) => [r.id, r]));
  }
  return CATALOG;
}
function getReport(id) { catalog(); return INDEX.get(id) || null; }

// ─── Çalıştırıcı ───────────────────────────────────────────────────────────
function err(msg, status = 400) { return Object.assign(new Error(msg), { status }); }

function resolveParams(ctx, rep, q = {}) {
  const kod = q.donem || rep.donem || "bu_ay";
  const donem = P.resolvePeriod(kod, { bas: q.bas, bit: q.bit, today: ctx.today, ilkTarih: ctx.firstDate() });
  let n = Number(q.n) || rep.n || 10;
  n = Math.min(100, Math.max(3, Math.round(n)));
  return { donem, n, kirilim: q.kirilim && P.GRANS[q.kirilim] ? q.kirilim : null };
}

function labeled(gran, pts) { return pts.map((p) => ({ k: p.k, ad: P.bucketLabel(gran, p.k), v: p.v })); }

function sparkGran(p) { return p.gun <= 45 ? "gun" : p.gun <= 200 ? "hafta" : "ay"; }

function run(ctx, id, q = {}) {
  const rep = getReport(id);
  if (!rep) throw err(`Rapor bulunamadı: ${id}`, 404);
  const prm = resolveParams(ctx, rep, q);
  const { donem } = prm;
  const meta = { id: rep.id, ad: rep.ad, kisa: rep.kisa, ikon: rep.ikon, kategori: rep.kategori, birim: rep.birim, iyi: rep.iyi, aciklama: rep.aciklama, grafik: rep.grafik, grafikler: rep.grafikler };
  const envelope = (sonuc, extra = {}) => ({ rapor: meta, donem, ...extra, sonuc });
  if (rep.ozel) return envelope(OZEL.run(ctx, rep, prm, q));

  const m = MEASURES[rep.olcu];
  const w = { bas: donem.bas, bit: donem.bit };
  switch (rep.gorunum) {
    case "kpi": {
      const deger = Q.total(ctx, rep.olcu, w);
      const onceki = P.previousPeriod(donem);
      const gy = P.lastYearPeriod(donem);
      const vOnceki = Q.total(ctx, rep.olcu, onceki);
      const vGy = Q.total(ctx, rep.olcu, gy);
      const g = sparkGran(donem);
      const seri = labeled(g, Q.series(ctx, rep.olcu, { ...w, gran: g }));
      const fark = (a, b) => (m.birim === "%" ? (a !== null && b !== null ? a - b : null) : S.growth(a, b, { minBase: m.birim === "adet" ? 1 : 1 }));
      return envelope({ tur: "kpi", birim: m.birim, iyi: m.iyi, deger, onceki: vOnceki, gecenYil: vGy,
        degisim: { onceki: fark(deger, vOnceki), gecenYil: fark(deger, vGy), tip: m.birim === "%" ? "puan" : "oran" },
        karsilastirma: { onceki, gecenYil: gy }, seri });
    }
    case "trend": {
      let gran = prm.kirilim || rep.kirilim;
      let not = null;
      const maxPts = { gun: 400, hafta: 260, ay: 180, ceyrek: 80, yil: 30 };
      const cnt = P.enumerateBuckets(gran, w.bas, w.bit).length;
      if (cnt > maxPts[gran]) { gran = P.autoGran(donem); not = `Nokta sayısı çok fazla olduğu için ${GRAN_AD[gran].toLocaleLowerCase("tr-TR")} kırılıma geçildi.`; }
      // İlk kova yarım kalmasın: hafta/ay/çeyrek/yıl kırılımında başlangıcı kova başına çek
      const hb = { gun: (d) => d, hafta: P.startOfWeek, ay: P.startOfMonth, ceyrek: P.startOfQuarter, yil: P.startOfYear }[gran](w.bas);
      const veri = labeled(gran, Q.series(ctx, rep.olcu, { bas: hb, bit: w.bit, gran }));
      // Son kova bugün devam ediyorsa işaretle (ör. ayın ortası)
      if (veri.length && w.bit >= ctx.today && P.bucketEnd(gran, veri[veri.length - 1].k) > ctx.today) veri[veri.length - 1].devam = true;
      return envelope({ tur: "seri", birim: m.birim, kirilim: gran, seriler: [{ id: "simdi", ad: donem.ad, veri }],
        toplam: additive(m) ? veri.reduce((s, p) => s + (p.v || 0), 0) : Q.total(ctx, rep.olcu, { bas: hb, bit: w.bit }), not }, { donem: { ...donem, bas: hb, gun: P.diffDays(hb, donem.bit) + 1 } });
    }
    case "yoy": {
      const gran = prm.kirilim || rep.kirilim;
      const gy = P.lastYearPeriod(donem);
      const cur = labeled(gran, Q.series(ctx, rep.olcu, { ...w, gran }));
      const prev = labeled(gran, Q.series(ctx, rep.olcu, { bas: gy.bas, bit: gy.bit, gran }));
      // Hizalama: geçen yılın kovaları sırasıyla bu yılınkilere eşlenir
      const prevAligned = cur.map((p, i) => ({ k: p.k, ad: p.ad, v: prev[i] ? prev[i].v : null }));
      const tc = Q.total(ctx, rep.olcu, w), tp = Q.total(ctx, rep.olcu, gy);
      return envelope({ tur: "seri", birim: m.birim, kirilim: gran, seriler: [
        { id: "simdi", ad: donem.ad, veri: cur }, { id: "gecenYil", ad: "Geçen yıl", veri: prevAligned, kesikli: true },
      ], toplam: tc, oncekiToplam: tp, degisim: m.birim === "%" ? (tc !== null && tp !== null ? tc - tp : null) : S.growth(tc, tp, { minBase: 1 }) });
    }
    case "kumulatif": {
      const y = donem.bit.slice(0, 4);
      const bas = `${y}-01-01`, bit = donem.bit;
      const gy = { bas: `${Number(y) - 1}-01-01`, bit: `${Number(y) - 1}-12-31` };
      const cumul = (pts) => { let acc = 0; return pts.map((p) => ({ k: p.k, ad: p.ad, v: (acc += p.v || 0) })); };
      const cur = cumul(labeled("gun", Q.series(ctx, rep.olcu, { bas, bit, gran: "gun" })));
      const prevRaw = cumul(labeled("gun", Q.series(ctx, rep.olcu, { ...gy, gran: "gun" })));
      // Geçen yılın tüm yılı (tahmin hedefi) — gün-ay etiketine göre hizala
      const prev = prevRaw.map((p) => ({ k: `${y}${p.k.slice(4)}`, ad: p.ad, v: p.v }));
      const veriCur = prev.map((p) => { const c = cur.find((x) => x.k.slice(5) === p.k.slice(5)); return { k: p.k, ad: p.ad, v: c ? c.v : null }; });
      return envelope({ tur: "seri", birim: m.birim, kirilim: "gun", seriler: [
        { id: "simdi", ad: `${y}`, veri: veriCur }, { id: "gecenYil", ad: `${Number(y) - 1}`, veri: prev, kesikli: true },
      ], toplam: cur.length ? cur[cur.length - 1].v : 0, oncekiToplam: prev.length ? prev[prev.length - 1].v : 0 }, { donem: { ...donem, bas, bit, ad: `${y} yılı` } });
    }
    case "mevsim": {
      const mx = Q.matrix(ctx, rep.olcu, { ...w, x: "ayadi", y: "yil" });
      return envelope({ tur: "matris", birim: m.birim, ...mx });
    }
    case "isi": {
      const mx = Q.matrix(ctx, rep.olcu, { ...w, x: "hafta", y: "haftagunu" });
      return envelope({ tur: "matris", birim: m.birim, ...mx });
    }
    case "dagilim": {
      const r = Q.byDim(ctx, rep.olcu, rep.boyut, { ...w, limit: 0, sort: "key" });
      return envelope({ tur: "kategori", birim: m.birim, boyut: { id: rep.boyut, ad: rep.boyutAd }, satirlar: r.satirlar.map(pick), toplam: r.toplam, sirali: true });
    }
    case "top":
    case "pay": {
      const r = Q.byDim(ctx, rep.olcu, rep.boyut, { ...w, limit: prm.n, sort: m.iyi === "asagi" && rep.gorunum === "top" ? "desc" : "desc" });
      return envelope({ tur: "kategori", birim: m.birim, boyut: { id: rep.boyut, ad: rep.boyutAd }, satirlar: r.satirlar.map(pick),
        diger: r.diger ? pick(r.diger) : null, toplam: r.toplam, adet: r.adet });
    }
    case "karsilastir": {
      const onceki = P.previousPeriod(donem);
      const cur = Q.byDim(ctx, rep.olcu, rep.boyut, { ...w, limit: 0 }).satirlar;
      const prev = Q.byDim(ctx, rep.olcu, rep.boyut, { bas: onceki.bas, bit: onceki.bit, limit: 0 }).satirlar;
      const map = new Map();
      for (const r of prev) map.set(r.k, { k: r.k, ad: r.ad, v: null, onceki: r.v });
      for (const r of cur) map.set(r.k, { ...(map.get(r.k) || { onceki: null }), k: r.k, ad: r.ad, v: r.v });
      const rows = [...map.values()].map((r) => ({
        ...r, fark: (r.v || 0) - (r.onceki || 0),
        degisim: m.birim === "%" ? null : S.growth(r.v || 0, r.onceki || 0, { minBase: 1 }),
      }));
      rows.sort((a, b) => Math.abs(b.fark) - Math.abs(a.fark));
      const top = rows.slice(0, prm.n);
      return envelope({ tur: "kategori", birim: m.birim, boyut: { id: rep.boyut, ad: rep.boyutAd }, satirlar: top,
        karsilastirma: onceki, artan: rows.filter((r) => r.fark > 0).length, azalan: rows.filter((r) => r.fark < 0).length });
    }
    case "pareto": {
      const r = Q.byDim(ctx, rep.olcu, rep.boyut, { ...w, limit: 0 });
      const rows = r.satirlar.filter((x) => (x.v || 0) > 0);
      const tot = rows.reduce((s, x) => s + x.v, 0);
      let cum = 0;
      const all = rows.map((x) => { const pay = tot ? x.v / tot : 0; const once = cum; cum += pay; return { k: x.k, ad: x.ad, v: x.v, pay, kum: cum, sinif: once < 0.8 ? "A" : once < 0.95 ? "B" : "C" }; });
      const ozet = { A: { adet: 0, v: 0 }, B: { adet: 0, v: 0 }, C: { adet: 0, v: 0 } };
      for (const x of all) { ozet[x.sinif].adet++; ozet[x.sinif].v += x.v; }
      return envelope({ tur: "kategori", birim: m.birim, boyut: { id: rep.boyut, ad: rep.boyutAd }, satirlar: all.slice(0, Math.max(prm.n, 30)), toplam: tot, adet: all.length, abc: ozet });
    }
    default:
      throw err(`Bilinmeyen görünüm: ${rep.gorunum}`);
  }
}

function pick(r) {
  const o = { k: r.k, ad: r.ad, v: r.v };
  if (r.pay !== undefined) o.pay = r.pay;
  return o;
}

module.exports = { catalog, getReport, run, KATEGORILER, GRAFIK, buildCatalog };
