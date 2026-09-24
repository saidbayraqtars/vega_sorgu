// Döngü ve verimlilik oranları: DSO, DPO, DIO, nakit dönüşüm süresi, nakit yeterliliği,
// yoğunlaşma, oynaklık, marj eğilimi. Hepsi "son 365 gün" (veri yoksa mevcut kadar, yıllıklandırılmış).

const P = require("./period");
const Q = require("./query");
const S = require("./stats");
const { position, portfolioSummary } = require("./position");
const B = require("./balances");

// Son 365 günün toplamı; veri daha kısa ise mevcut günlere göre yıllıklandır.
function annual(ctx, mid) {
  const t = ctx.today;
  const bas365 = P.addDays(t, -364);
  const first = ctx.firstDate();
  const bas = first && first > bas365 ? first : bas365;
  const days = P.diffDays(bas, t) + 1;
  if (days < 30) return null;
  const v = Q.total(ctx, mid, { bas, bit: t });
  return (v * 365) / days;
}

function ratios(ctx, opts = {}) {
  return ctx.cached("ratios", () => {
    const t = ctx.today;
    const pos = position(ctx, opts);
    const satisY = annual(ctx, "satis");
    const alisY = annual(ctx, "alis");
    const maliyetY = annual(ctx, "maliyet");
    const out = {};
    out.dso = satisY > 0 ? pos.cari.alacak / (satisY / 365) : null;
    out.dpo = alisY > 0 ? pos.cari.borc / (alisY / 365) : null;
    out.dio = pos.stok.veriVar && maliyetY > 0 ? pos.stok.deger / (maliyetY / 365) : null;
    out.ccc = out.dso !== null && out.dpo !== null ? out.dso + (out.dio || 0) - out.dpo : null;

    // Nakit yeterliliği: likit / günlük ödeme ihtiyacı (son 90 gün: tedarikçi ödemesi + kasa masrafları)
    const w90 = { bas: P.addDays(t, -89), bit: t };
    const odeme90 = (Q.total(ctx, "tediye", w90) || 0) + (Q.total(ctx, "kasa_gider_diger", w90) || 0);
    out.gunlukOdeme = odeme90 / 90;
    out.nakitGun = out.gunlukOdeme > 0 ? Math.max(0, pos.likit) / out.gunlukOdeme : null;

    // Tahsilat oranı (son 90 gün)
    out.tahsilatOrani90 = Q.total(ctx, "tahsilat_orani", w90);

    // Brüt marj: son 365 gün ve son 90 gün vs geçen yıl aynı 90 gün
    out.marj = Q.total(ctx, "brut_marj", { bas: P.addDays(t, -364), bit: t });
    const m90 = Q.total(ctx, "brut_marj", w90);
    const m90ly = Q.total(ctx, "brut_marj", { bas: P.addYears(w90.bas, -1), bit: P.addYears(w90.bit, -1) });
    out.marj90 = m90;
    out.marjTrend = m90 !== null && m90ly !== null ? m90 - m90ly : null; // yüzde puan

    // Zararına satış payı (son 90 gün, ürün bazında kâr < 0 olanların cirosu / toplam)
    const urun = Q.byDim(ctx, "brut_kar", "urun", { ...w90, limit: 0 }).satirlar;
    const netU = Q.byDim(ctx, "net_satis", "urun", { ...w90, limit: 0 }).satirlar;
    const netMap = new Map(netU.map((r) => [r.k, r.v]));
    const totNet = netU.reduce((s, r) => s + Math.max(0, r.v || 0), 0);
    const zararli = urun.filter((r) => r.v < 0);
    out.zararliUrun = zararli.length;
    out.zararSatisPayi = totNet > 0 ? zararli.reduce((s, r) => s + Math.max(0, netMap.get(r.k) || 0), 0) / totNet : null;

    // Müşteri yoğunlaşması (son 365 gün satış)
    const cust = Q.byDim(ctx, "satis", "cari", { bas: P.addDays(t, -364), bit: t, limit: 0 }).satirlar.map((r) => r.v);
    const conc = S.concentration(cust, 5);
    out.ilk5Pay = conc.topShare;
    out.hhi = conc.hhi;
    out.enBuyukMusteriPay = cust.length ? Math.max(...cust) / (cust.filter((v) => v > 0).reduce((s, v) => s + v, 0) || 1) : null;

    // Aylık satış oynaklığı (son 12 tam ay)
    const lastFull = P.endOfMonth(P.addMonths(t, -1));
    const first = ctx.firstDate();
    const firstFullMonth = first ? (first.slice(8) === "01" ? first.slice(0, 7) : P.addMonths(P.startOfMonth(first), 1).slice(0, 7)) : null;
    const valid = firstFullMonth
      ? Q.series(ctx, "net_ciro", { bas: P.startOfMonth(P.addMonths(t, -12)), bit: lastFull, gran: "ay" })
        .filter((p) => p.k >= firstFullMonth).map((p) => p.v || 0)
      : [];
    out.oynaklik = valid.length >= 4 ? S.cv(valid) : null;

    // Kaldıraç: (banka kredisi + verilen çek/senet) / (likit + alacak + alınan çek/senet)
    const pf = portfolioSummary(ctx);
    const yuk = pos.yukumlulukler.kredi + pf.cek.verilen + pf.senet.verilen;
    const kaynak = pos.likit + pos.cari.alacak + pf.cek.alinan + pf.senet.alinan;
    out.kaldirac = kaynak > 0 ? yuk / kaynak : null;

    // Vadesi geçmiş alacak oranı (FIFO yaşlandırma)
    const aging = B.receivableAging(ctx);
    out.vadesiGecenAlacak = aging.vadesiGecen;
    out.vadesiGecenOran = aging.toplam > 0 ? aging.vadesiGecen / aging.toplam : null;
    // Vadesi geçmiş alınan çek/senet oranı
    const alinan = pf.cek.alinan + pf.senet.alinan;
    out.vadesiGecenCekOran = alinan > 0 ? (pf.cek.alinanVadesiGecmis + pf.senet.alinanVadesiGecmis) / alinan : (alinan === 0 ? 0 : null);

    // 30 gün vade karşılama: (likit + 30 gün içinde tahsil edilecek çek/senet) / 30 gün içinde ödenecek
    const odenecek30 = pf.cek.verilen30 + pf.senet.verilen30 + pf.cek.verilenVadesiGecmis + pf.senet.verilenVadesiGecmis;
    out.vadeKarsilama = odenecek30 > 0 ? (pos.likit + pf.cek.alinan30 + pf.senet.alinan30) / odenecek30 : null;
    out.odenecek30 = odenecek30;

    out.satisYillik = satisY; out.alisYillik = alisY; out.maliyetYillik = maliyetY;
    return out;
  });
}

module.exports = { ratios, annual };
