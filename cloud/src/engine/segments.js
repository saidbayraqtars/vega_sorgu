// Müşteri ve ürün segmentasyonu: ABC (Pareto) ve RFM (Kılavuz §41.6, §41.7 temelli).

const P = require("./period");
const Q = require("./query");
const S = require("./stats");

// ABC: cironun ilk %80'i A, sonraki %15'i B, kalanı C
function abc(ctx, { olcu = "net_satis", boyut = "urun", gun = 365 } = {}) {
  const t = ctx.today;
  const rows = Q.byDim(ctx, olcu, boyut, { bas: P.addDays(t, -(gun - 1)), bit: t, limit: 0 }).satirlar.filter((r) => r.v > 0);
  const tot = rows.reduce((s, r) => s + r.v, 0);
  let cum = 0;
  const out = rows.map((r) => {
    cum += r.v;
    const kum = tot ? cum / tot : 0;
    return { k: r.k, ad: r.ad, v: r.v, pay: tot ? r.v / tot : 0, kum, sinif: kum - (tot ? r.v / tot : 0) < 0.8 ? "A" : kum - (tot ? r.v / tot : 0) < 0.95 ? "B" : "C" };
  });
  const ozet = { A: { adet: 0, v: 0 }, B: { adet: 0, v: 0 }, C: { adet: 0, v: 0 } };
  for (const r of out) { ozet[r.sinif].adet++; ozet[r.sinif].v += r.v; }
  return { satirlar: out, ozet, toplam: tot };
}

const RFM_SEG = [
  { id: "sampiyon", ad: "Şampiyon", ikon: "Crown", aciklama: "Yakın zamanda, sık ve çok alan", test: (r, f, m) => r >= 4 && f >= 4 && m >= 4 },
  { id: "sadik", ad: "Sadık", ikon: "Heart", aciklama: "Düzenli alan müşteriler", test: (r, f) => r >= 3 && f >= 4 },
  { id: "yeni", ad: "Yeni", ikon: "Sparkles", aciklama: "İlk alışverişi son 90 günde", test: (r, f, m, x) => x.yeni },
  { id: "potansiyel", ad: "Potansiyel", ikon: "Sprout", aciklama: "Yakın zamanda aldı, sıklık düşük", test: (r, f) => r >= 4 && f <= 3 },
  { id: "risk", ad: "Risk altında", ikon: "AlertTriangle", aciklama: "Eskiden sık alıyordu, uzun süredir yok", test: (r, f) => r <= 2 && f >= 3 },
  { id: "uyuyan", ad: "Uykuda", ikon: "Moon", aciklama: "Uzun süredir alışveriş yapmıyor", test: (r) => r <= 1 },
  { id: "orta", ad: "Ortalama", ikon: "Minus", aciklama: "Diğer müşteriler", test: () => true },
];

function quintileScore(values, v, reverse = false) {
  if (!values.length) return 3;
  const q = [0.2, 0.4, 0.6, 0.8].map((p) => S.quantile(values, p));
  let s = 1;
  for (const x of q) if (v > x) s++;
  return reverse ? 6 - s : s;
}

function rfm(ctx, { gun = 365 } = {}) {
  const t = ctx.today;
  const bas = P.addDays(t, -(gun - 1));
  const rows = ctx.db.all(`
    SELECT h.firma || ':' || h.cari_id AS k, MAX(COALESCE(NULLIF(c.ad,''), '#' || h.cari_id)) AS ad,
           MAX(h.tarih) AS son, COUNT(DISTINCT COALESCE(NULLIF(h.evrak,''), h.id)) AS f, SUM(h.borc - h.alacak) AS m
    FROM cari_hareket h LEFT JOIN cari c ON c.firma = h.firma AND c.id = h.cari_id
    WHERE ${ctx.firmaIn("h")} AND h.izahat IN (${ctx.iz("SATIS")}) AND h.borc > h.alacak AND h.tarih BETWEEN ? AND ?
      AND NOT ${ctx.personel("c")}
    GROUP BY h.firma, h.cari_id`, bas, t);
  const firsts = new Map(ctx.db.all(`
    SELECT h.firma || ':' || h.cari_id AS k, MIN(h.tarih) AS ilk FROM cari_hareket h
    WHERE ${ctx.firmaIn("h")} AND h.izahat IN (${ctx.iz("SATIS")}) AND h.borc > h.alacak GROUP BY h.firma, h.cari_id`).map((r) => [r.k, r.ilk]));
  const first = ctx.firstDate();
  const recs = rows.map((r) => ({ ...r, r: P.diffDays(r.son, t) }));
  const R = recs.map((x) => x.r), F = recs.map((x) => x.f), M = recs.map((x) => x.m);
  const segs = Object.fromEntries(RFM_SEG.map((s) => [s.id, { ...s, adet: 0, ciro: 0, test: undefined }]));
  const out = recs.map((x) => {
    const rs = quintileScore(R, x.r, true);
    const fs = quintileScore(F, x.f);
    const ms = quintileScore(M, x.m);
    const ilk = firsts.get(x.k);
    const yeni = ilk && ilk >= P.addDays(t, -89) && first && P.diffDays(first, ilk) > 90;
    const seg = RFM_SEG.find((s) => s.test(rs, fs, ms, { yeni }));
    segs[seg.id].adet++; segs[seg.id].ciro += x.m;
    return { k: x.k, ad: x.ad, sonAlis: x.son, gunOnce: x.r, fatura: x.f, ciro: x.m, R: rs, F: fs, M: ms, segment: seg.id, segmentAd: seg.ad };
  });
  return { musteriler: out.sort((a, b) => b.ciro - a.ciro), segmentler: Object.values(segs).filter((s) => s.adet > 0) };
}

// Yeni / kaybedilen müşteriler: dönemde ilk kez alanlar ve önceki dönemde alıp bu dönemde almayanlar
function churn(ctx, { bas, bit }) {
  const len = P.diffDays(bas, bit) + 1;
  const pbas = P.addDays(bas, -len), pbit = P.addDays(bas, -1);
  const q = (b, e) => new Map(ctx.db.all(`
    SELECT h.firma || ':' || h.cari_id AS k, MAX(COALESCE(NULLIF(c.ad,''), '#' || h.cari_id)) AS ad, SUM(h.borc - h.alacak) AS v
    FROM cari_hareket h LEFT JOIN cari c ON c.firma = h.firma AND c.id = h.cari_id
    WHERE ${ctx.firmaIn("h")} AND h.izahat IN (${ctx.iz("SATIS")}) AND h.tarih BETWEEN ? AND ? AND NOT ${ctx.personel("c")}
    GROUP BY h.firma, h.cari_id HAVING SUM(h.borc - h.alacak) > 0`, b, e).map((r) => [r.k, r]));
  const cur = q(bas, bit), prev = q(pbas, pbit);
  const everBefore = new Set(ctx.db.all(`SELECT DISTINCT h.firma || ':' || h.cari_id AS k FROM cari_hareket h
    WHERE ${ctx.firmaIn("h")} AND h.izahat IN (${ctx.iz("SATIS")}) AND h.tarih < ?`, bas).map((r) => r.k));
  const yeni = [...cur.values()].filter((r) => !everBefore.has(r.k));
  const kayip = [...prev.values()].filter((r) => !cur.has(r.k));
  const geriDonen = [...cur.values()].filter((r) => everBefore.has(r.k) && !prev.has(r.k));
  return {
    yeni: yeni.sort((a, b) => b.v - a.v), kayip: kayip.sort((a, b) => b.v - a.v), geriDonen: geriDonen.sort((a, b) => b.v - a.v),
    buDonem: cur.size, oncekiDonem: prev.size,
    elde: prev.size ? (prev.size - kayip.length) / prev.size : null,
  };
}

module.exports = { abc, rfm, churn, RFM_SEG };
