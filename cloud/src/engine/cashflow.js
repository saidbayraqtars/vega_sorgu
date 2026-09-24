// ═══════════════════════════════════════════════════════════════════════════
//  Nakit Projeksiyonu (varsayılan 90 gün)
//
//  İki çizgi, ikisi de şeffaf:
//   • Vade takvimi (kesin): bugünkü likit + portföydeki alınan çek/senet (vadesinde)
//       + gelecek taksitler − ödenecek verilen çek/senet (vadesi geçmişse bugün).
//   • Olağan akış (beklenen): bugünkü likit + (son 90 günün günlük tahsilatı
//       − günlük ödeme ihtiyacı) × mevsim katsayısı. Katsayı: geçen yıl aynı
//       dönemin, geçen yılın önceki 90 gününe oranı (veri varsa).
//  Vadesi geçmiş alınan çek/senet projeksiyona katılmaz, ayrı gösterilir (risk).
// ═══════════════════════════════════════════════════════════════════════════

const P = require("./period");
const Q = require("./query");
const { position, portfolio } = require("./position");

function projection(ctx, { gun = 90, kurlar = null } = {}) {
  return ctx.cached(`proj:${gun}`, () => {
    const t = ctx.today;
    const pos = position(ctx, { kurlar });
    const start = pos.likit;
    const end = P.addDays(t, gun);
    const days = [];
    for (let i = 0; i <= gun; i++) days.push(P.addDays(t, i));
    const giris = new Map(days.map((d) => [d, 0]));
    const cikis = new Map(days.map((d) => [d, 0]));

    let vadesiGecenAlinan = 0, vadesiGecenAlinanAdet = 0;
    for (const r of portfolio(ctx)) {
      if (!r.acik || !r.vade) continue;
      if (r.yon === "alinan") {
        if (r.vade < t) { vadesiGecenAlinan += r.tutar; vadesiGecenAlinanAdet++; continue; }
        if (r.vade <= end) giris.set(r.vade, giris.get(r.vade) + r.tutar);
      } else {
        const d = r.vade < t ? t : r.vade;
        if (d <= end) cikis.set(d, cikis.get(d) + r.tutar);
      }
    }
    // Taksitli satış takvimi (gelecek taksitler)
    const taksit = ctx.db.all(`SELECT tarih, SUM(tutar) AS v FROM taksit x WHERE ${ctx.firmaIn("x")} AND tarih BETWEEN ? AND ? GROUP BY tarih`, t, end);
    for (const r of taksit) giris.set(r.tarih, (giris.get(r.tarih) || 0) + (Number(r.v) || 0));

    // Olağan akış: son 90 günün ortalaması × mevsim katsayısı
    const w90 = { bas: P.addDays(t, -89), bit: t };
    const tah90 = Q.total(ctx, "tahsilat", w90) || 0;
    const ode90 = (Q.total(ctx, "tediye", w90) || 0) + (Q.total(ctx, "kasa_gider_diger", w90) || 0);
    const lyPast = { bas: P.addYears(w90.bas, -1), bit: P.addYears(w90.bit, -1) };
    const lyNext = { bas: P.addYears(P.addDays(t, 1), -1), bit: P.addYears(end, -1) };
    const tahLyPast = Q.total(ctx, "tahsilat", lyPast) || 0;
    const tahLyNext = Q.total(ctx, "tahsilat", lyNext) || 0;
    let mevsim = 1;
    if (tahLyPast > 0 && tahLyNext > 0) mevsim = Math.min(1.6, Math.max(0.6, (tahLyNext / gun) / (tahLyPast / 90)));
    const gunlukTah = (tah90 / 90) * mevsim;
    const gunlukOde = (ode90 / 90) * mevsim;

    let kesin = start, beklenen = start;
    const seri = [];
    let minKesin = { tarih: t, deger: start }, minBeklenen = { tarih: t, deger: start };
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      kesin += giris.get(d) - cikis.get(d);
      if (i > 0) beklenen += gunlukTah - gunlukOde;
      seri.push({ t: d, kesin, beklenen, giris: giris.get(d), cikis: cikis.get(d) });
      if (kesin < minKesin.deger) minKesin = { tarih: d, deger: kesin };
      if (beklenen < minBeklenen.deger) minBeklenen = { tarih: d, deger: beklenen };
    }
    const toplamGiris = [...giris.values()].reduce((s, v) => s + v, 0);
    const toplamCikis = [...cikis.values()].reduce((s, v) => s + v, 0);
    const ilkAcik = seri.find((p) => p.kesin < 0);
    return {
      baslangic: start, gun, seri,
      toplamGiris, toplamCikis, vadesiGecenAlinan, vadesiGecenAlinanAdet,
      gunlukTahsilat: gunlukTah, gunlukOdeme: gunlukOde, mevsimKatsayisi: mevsim,
      minKesin, minBeklenen, ilkAcikTarih: ilkAcik ? ilkAcik.t : null,
      son: { kesin, beklenen },
    };
  });
}

module.exports = { projection };
