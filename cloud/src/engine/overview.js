// "Durum" ekranı: tek çağrıda sağlık, büyüme, anlık finansal durum, bu ay, projeksiyon, uyarılar.

const P = require("./period");
const Q = require("./query");
const S = require("./stats");
const { healthScore } = require("./health");
const { growthAnalysis } = require("./growth");
const { position } = require("./position");
const { ratios } = require("./ratios");
const { projection } = require("./cashflow");
const { alerts } = require("./alerts");

function kpi(ctx, mid, { bas, bit }) {
  const simdi = Q.total(ctx, mid, { bas, bit });
  const gy = Q.total(ctx, mid, { bas: P.addYears(bas, -1), bit: P.addYears(bit, -1) });
  const len = P.diffDays(bas, bit) + 1;
  const onceki = Q.total(ctx, mid, { bas: P.addDays(bas, -len), bit: P.addDays(bas, -1) });
  return { simdi, gecenYil: gy, onceki, yoy: S.growth(simdi, gy, { minBase: 1 }), pop: S.growth(simdi, onceki, { minBase: 1 }) };
}

function overview(ctx, { kurlar = null, sonEsitleme = null } = {}) {
  const t = ctx.today;
  const health = healthScore(ctx, { kurlar });
  const growth = growthAnalysis(ctx);
  const pos = position(ctx, { kurlar });
  const r = ratios(ctx, { kurlar });
  const proj = projection(ctx, { kurlar });
  const uyarilar = alerts(ctx, { kurlar, sonEsitleme });

  const ay = { bas: P.startOfMonth(t), bit: t };
  const buAy = {
    satis: kpi(ctx, "net_ciro", ay),
    tahsilat: kpi(ctx, "tahsilat", ay),
    kar: kpi(ctx, "brut_kar", ay),
    siparis: kpi(ctx, "siparis_tutar", ay),
  };
  const bugun = {
    satis: Q.total(ctx, "net_ciro", { bas: t, bit: t }),
    tahsilat: Q.total(ctx, "tahsilat", { bas: t, bit: t }),
    kasaNet: Q.total(ctx, "kasa_net", { bas: t, bit: t }),
    fatura: Q.total(ctx, "fatura_sayisi", { bas: t, bit: t }),
  };
  // Son 30 günün günlük satış mini grafiği
  const spark = Q.series(ctx, "net_ciro", { bas: P.addDays(t, -29), bit: t, gran: "gun" }).map((p) => p.v || 0);

  return {
    tarih: t,
    firmalar: ctx.firmaList.map((f) => ({ kod: f.firma, ad: f.ad })),
    saglik: health,
    buyume: growth,
    durum: {
      kasa: pos.kasa.tl, kasaDoviz: pos.kasa.doviz, banka: pos.banka.tl, bankaVarlik: pos.banka.varlik, bankaKredi: -pos.banka.kredi,
      bankaDoviz: pos.banka.doviz, doviz: pos.doviz, dovizTL: pos.dovizTL, likit: pos.likit, netNakit: pos.netNakit,
      alacak: pos.cari.alacak, borc: pos.cari.borc, musteriSayisi: pos.cari.musteri, tedarikciSayisi: pos.cari.tedarikci,
      cekAlinan: pos.portfoy.cek.alinan, cekAlinanAdet: pos.portfoy.cek.alinanAdet,
      cekVerilen: pos.portfoy.cek.verilen, cekVerilenAdet: pos.portfoy.cek.verilenAdet,
      senetAlinan: pos.portfoy.senet.alinan, senetVerilen: pos.portfoy.senet.verilen,
      stok: pos.stok.deger, stokVar: pos.stok.veriVar,
      varliklar: pos.varliklar, yukumlulukler: pos.yukumlulukler, netIsletmeSermayesi: pos.netIsletmeSermayesi,
      oranlar: pos.oranlar,
    },
    oranlar: {
      dso: r.dso, dpo: r.dpo, dio: r.dio, ccc: r.ccc, nakitGun: r.nakitGun, tahsilatOrani90: r.tahsilatOrani90,
      marj: r.marj, marjTrend: r.marjTrend, ilk5Pay: r.ilk5Pay, vadesiGecenOran: r.vadesiGecenOran, kaldirac: r.kaldirac,
    },
    buAy, bugun, spark,
    projeksiyon: {
      baslangic: proj.baslangic, gun: proj.gun, minKesin: proj.minKesin, minBeklenen: proj.minBeklenen,
      ilkAcikTarih: proj.ilkAcikTarih, son: proj.son, vadesiGecenAlinan: proj.vadesiGecenAlinan,
      seri: proj.seri.filter((_, i) => i % 3 === 0 || i === proj.seri.length - 1).map((p) => ({ t: p.t, kesin: p.kesin, beklenen: p.beklenen })),
    },
    uyarilar,
    uyariOzet: { kritik: uyarilar.filter((a) => a.seviye === "kritik").length, uyari: uyarilar.filter((a) => a.seviye === "uyari").length, bilgi: uyarilar.filter((a) => a.seviye === "bilgi").length },
  };
}

module.exports = { overview, kpi };
