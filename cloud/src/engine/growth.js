// ═══════════════════════════════════════════════════════════════════════════
//  Büyüme Endeksi — "şirket ne kadar büyüdü?"
//
//  1) Ufuk seçimi (veri geçmişine göre, mevsimselliği dışlamak için yıllık karşılaştırma öncelikli):
//       ttm : son 365 gün  vs  önceki 365 gün         (≥ 2 yıl veri)
//       ytd : yıl başı→bugün vs geçen yıl aynı dönem   (≥ 1 yıl + YTD ≥ 60 gün)
//       3a  : son 90 gün  vs  önceki 90 gün            (mevsim etkisi var — düşük güven)
//  2) Bileşenler (aynı ufukta): Net ciro %40 · Brüt kâr %30 · Tahsilat %20 · Aktif müşteri %10
//     Her bileşen [-95%, +300%] aralığına kırpılır; eksik bileşenlerde ağırlıklar yeniden ölçeklenir.
//  3) Reel büyüme: (1 + g) / (1 + TÜFE) − 1  (TÜFE ayarlardan; 3a ufkunda 90 güne oranlanır)
//  4) İvme: son 90 günün yıllık büyümesi − ufuk büyümesi (hızlanıyor / yavaşlıyor)
//  5) Eğilim: aylık net ciro üzerinde log-Theil–Sen (aykırı aylara dayanıklı), yıllıklandırılmış
//  6) Tahmin: Holt-Winters (≥ 24 ay) / Holt (≥ 6 ay); yıl sonu = YTD + (GY kalan) × (1 + g_ytd)
// ═══════════════════════════════════════════════════════════════════════════

const P = require("./period");
const Q = require("./query");
const S = require("./stats");

const COMPONENTS = [
  { id: "ciro", olcu: "net_ciro", ad: "Net ciro", ikon: "Receipt", agirlik: 0.4, minBase: 1000 },
  { id: "kar", olcu: "brut_kar", ad: "Brüt kâr", ikon: "PiggyBank", agirlik: 0.3, minBase: 1000 },
  { id: "tahsilat", olcu: "tahsilat", ad: "Tahsilat", ikon: "HandCoins", agirlik: 0.2, minBase: 1000 },
  { id: "musteri", olcu: "aktif_musteri", ad: "Aktif müşteri", ikon: "Users", agirlik: 0.1, minBase: 3 },
];

function windows(ctx) {
  const t = ctx.today;
  const first = ctx.firstDate();
  const ytdStart = P.startOfYear(t);
  const ytdDays = P.diffDays(ytdStart, t) + 1;
  const ttm = { cur: { bas: P.addDays(t, -364), bit: t }, prev: { bas: P.addDays(t, -729), bit: P.addDays(t, -365) } };
  const ytd = { cur: { bas: ytdStart, bit: t }, prev: { bas: P.addYears(ytdStart, -1), bit: P.addYears(t, -1) } };
  const q3 = { cur: { bas: P.addDays(t, -89), bit: t }, prev: { bas: P.addDays(t, -179), bit: P.addDays(t, -90) } };
  const q3yoy = { cur: q3.cur, prev: { bas: P.addYears(q3.cur.bas, -1), bit: P.addYears(q3.cur.bit, -1) } };
  let ufuk = null;
  if (first) {
    const tol = 45; // gün — ilk ayın eksik olmasına tolerans
    if (P.diffDays(first, ttm.prev.bas) >= -tol) ufuk = "ttm";
    else if (ytdDays >= 60 && P.diffDays(first, ytd.prev.bas) >= -tol) ufuk = "ytd";
    else if (P.diffDays(first, q3.prev.bas) >= -tol) ufuk = "3a";
  }
  return { ttm, ytd, q3, q3yoy, ufuk, first };
}

const UFUK_AD = {
  ttm: "Son 12 ay, önceki 12 aya göre",
  ytd: "Yıl başından bugüne, geçen yılın aynı dönemine göre",
  "3a": "Son 90 gün, önceki 90 güne göre",
};

function componentGrowth(ctx, c, w) {
  const cur = Q.total(ctx, c.olcu, w.cur);
  const prev = Q.total(ctx, c.olcu, w.prev);
  return { simdi: cur, onceki: prev, yuzde: S.growth(cur, prev, { minBase: c.minBase }) };
}

function composite(parts) {
  let wsum = 0, acc = 0;
  for (const p of parts) {
    if (p.yuzde === null || p.yuzde === undefined) continue;
    acc += p.agirlik * S.clamp(p.yuzde, -0.95, 3);
    wsum += p.agirlik;
  }
  return wsum > 0 ? acc / wsum : null;
}

function realGrowth(g, enflasyon, ufuk) {
  if (g === null || enflasyon === null || enflasyon === undefined) return null;
  const pi = Number(enflasyon) / 100;
  const factor = ufuk === "3a" ? (1 + pi) ** (90 / 365) : 1 + pi;
  return (1 + g) / factor - 1;
}

function growthAnalysis(ctx) {
  return ctx.cached("growth", () => {
    const W = windows(ctx);
    const out = {
      ufuk: W.ufuk, ufukAd: W.ufuk ? UFUK_AD[W.ufuk] : "Yetersiz veri", yuzde: null, reel: null,
      enflasyon: ctx.s.enflasyon, bilesenler: [], ivme: null, detay: {}, tahmin: null, guven: "dusuk",
      ilkTarih: W.first,
    };
    if (W.ufuk) {
      const w = W[W.ufuk === "3a" ? "q3" : W.ufuk];
      out.pencere = w;
      out.bilesenler = COMPONENTS.map((c) => ({ id: c.id, ad: c.ad, ikon: c.ikon, olcu: c.olcu, agirlik: c.agirlik, ...componentGrowth(ctx, c, w) }));
      out.yuzde = composite(out.bilesenler);
      out.reel = realGrowth(out.yuzde, ctx.s.enflasyon, W.ufuk);
      out.guven = W.ufuk === "ttm" ? "yuksek" : W.ufuk === "ytd" ? "orta" : "dusuk";
    }

    // ── Detay oranları (net ciro) ──
    const t = ctx.today;
    const yesterday = P.addDays(t, -1);
    const mStart = P.startOfMonth(t);
    const cut = t > mStart ? yesterday : t; // kısa pencerelerde yarım günü dışla
    const detay = (bas, bit, pb, pbit) => {
      const simdi = Q.total(ctx, "net_ciro", { bas, bit });
      const onceki = Q.total(ctx, "net_ciro", { bas: pb, bit: pbit });
      return { bas, bit, simdi, onceki, yuzde: S.growth(simdi, onceki, { minBase: 1000 }) };
    };
    out.detay.ay = detay(mStart, cut, P.addYears(mStart, -1), P.addYears(cut, -1));
    out.detay.ayOnceki = detay(mStart, cut, P.startOfMonth(P.addMonths(t, -1)), P.addMonths(cut, -1));
    out.detay.yil = detay(W.ytd.cur.bas, cut, W.ytd.prev.bas, P.addYears(cut, -1));
    out.detay.ttm = detay(W.ttm.cur.bas, t, W.ttm.prev.bas, W.ttm.prev.bit);
    out.detay.son90 = detay(W.q3yoy.cur.bas, t, W.q3yoy.prev.bas, W.q3yoy.prev.bit);

    // ── İvme ──
    const base = W.ufuk === "ttm" ? out.detay.ttm.yuzde : W.ufuk === "ytd" ? out.detay.yil.yuzde : null;
    if (base !== null && out.detay.son90.yuzde !== null) {
      const d = out.detay.son90.yuzde - base;
      out.ivme = { deger: d, durum: d > 0.05 ? "hizlaniyor" : d < -0.05 ? "yavasliyor" : "dengeli" };
    }

    // ── Aylık eğilim + tahmin ──
    const lastFull = P.endOfMonth(P.addMonths(t, -1));
    const from = P.startOfMonth(P.addMonths(t, -36));
    const bas = W.first && W.first > from ? P.startOfMonth(W.first) : from;
    const monthly = bas < lastFull ? Q.series(ctx, "net_ciro", { bas, bit: lastFull, gran: "ay" }) : [];
    // İlk kısmi ayı at (veri ayın ortasında başlamış olabilir)
    const vals = monthly.map((p) => p.v || 0);
    if (W.first && W.first.slice(8) !== "01" && monthly.length && monthly[0].k === W.first.slice(0, 7)) vals.shift();
    out.detay.trend = S.annualizedTrend(vals.slice(-24));
    let fc = null, yontem = null;
    if (vals.length >= 24) { fc = S.holtWinters(vals, 12, 3); yontem = "Holt-Winters (mevsimsel)"; }
    if (!fc && vals.length >= 6) { fc = S.holtLinear(vals, 3); yontem = "Holt (eğilim)"; }
    if (fc) {
      out.tahmin = {
        yontem,
        aylar: fc.map((f, i) => ({ k: P.addMonths(`${lastFull.slice(0, 7)}-01`, i + 1).slice(0, 7), deger: Math.max(0, f.deger), alt: Math.max(0, f.alt), ust: Math.max(0, f.ust) })),
      };
    }
    // Yıl sonu tahmini: YTD + geçen yılın kalan kısmı × (1 + g_ytd)
    const gy = Number(t.slice(0, 4)) - 1;
    const lyTotal = Q.total(ctx, "net_ciro", { bas: `${gy}-01-01`, bit: `${gy}-12-31` });
    // Kalan ayların büyümesi: YTD büyümesi ile son 90 günün yıllık büyümesinin ortalaması (ivmeyi yansıtır)
    const gy1 = out.detay.yil.yuzde, g90 = out.detay.son90.yuzde;
    const g = gy1 === null ? g90 : g90 === null ? gy1 : (gy1 + g90) / 2;
    if (lyTotal > 0 && g !== null) {
      const lyRest = lyTotal - (out.detay.yil.onceki || 0);
      const tahmin = (out.detay.yil.simdi || 0) + Math.max(0, lyRest) * (1 + S.clamp(g, -0.9, 3));
      out.yilSonu = { deger: tahmin, gecenYil: lyTotal, yuzde: S.growth(tahmin, lyTotal, { minBase: 1000 }) };
    }
    return out;
  });
}

module.exports = { growthAnalysis, windows, composite, realGrowth, COMPONENTS, UFUK_AD };
