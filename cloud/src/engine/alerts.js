// Kural tabanlı uyarılar. Her kural açıklanabilir: ne gördü, neden önemli, hangi rapora bakılmalı.
// seviye: kritik (hemen) · uyari (bu hafta) · bilgi (izle)

const P = require("./period");
const Q = require("./query");
const S = require("./stats");
const B = require("./balances");
const { position } = require("./position");
const { ratios } = require("./ratios");
const { growthAnalysis } = require("./growth");
const { projection } = require("./cashflow");
const { iyelik, iyelikBelirtme } = require("../util/tr");

const TL = (v) => `${Math.round(Number(v) || 0).toLocaleString("tr-TR")} ₺`;
const PCT = (v, d = 0) => `%${(Math.abs(v) * 100).toLocaleString("tr-TR", { maximumFractionDigits: d })}`;
const SIRA = { kritik: 0, uyari: 1, bilgi: 2 };

// eslint-disable-next-line no-unused-vars
function alerts(ctx, { kurlar = null, sonEsitleme = null } = {}) {
  return ctx.cached("alerts", () => {
    const out = [];
    const add = (a) => out.push(a);
    const t = ctx.today;
    const pos = position(ctx, { kurlar });
    const r = ratios(ctx, { kurlar });
    const g = growthAnalysis(ctx);
    const pr = projection(ctx, { kurlar });
    const pf = pos.portfoy;

    // (Köprü sessizliği uyarısı burada değil: staleAlert — önbelleğe girmez, istek anında eklenir.)

    // ── Nakit ──
    for (const k of pos.kasa.kasalar) {
      if (!k.doviz && k.bakiye < -1) add({ id: `kasa_eksi_${k.firma}_${k.kasa}`, seviye: "kritik", ikon: "WalletCards", baslik: "Kasa eksi bakiyede",
        mesaj: `${k.kasa} kasası ${TL(k.bakiye)} görünüyor. Kayıt hatası ya da girilmemiş tahsilat olabilir.`, deger: k.bakiye, rapor: "ozel.kasa_durumu" });
    }
    if (pr.ilkAcikTarih && P.diffDays(t, pr.ilkAcikTarih) <= 30) {
      add({ id: "nakit_acik", seviye: "kritik", ikon: "TrendingDown", baslik: "Nakit açığı riski",
        mesaj: `Vade takvimine göre ${P.trDate(pr.ilkAcikTarih)} tarihinde nakit eksiye düşüyor (en düşük ${TL(pr.minKesin.deger)}).`,
        deger: pr.minKesin.deger, rapor: "ozel.nakit_projeksiyonu" });
    }
    const odenecek7 = pf.cek.verilen7 + pf.senet.verilen7;
    if (odenecek7 > 0 && odenecek7 > pos.likit) {
      add({ id: "cek_7gun", seviye: "kritik", ikon: "CalendarClock", baslik: "7 gün içinde ödeme sıkışıklığı",
        mesaj: `7 gün içinde ${TL(odenecek7)} çek/senet ödenecek; kasa+banka ${TL(pos.likit)}.`, deger: odenecek7, rapor: "ozel.vade_takvimi" });
    }
    const verilenGecmis = pf.cek.verilenVadesiGecmis + pf.senet.verilenVadesiGecmis;
    if (verilenGecmis > 0) {
      add({ id: "verilen_gecmis", seviye: "kritik", ikon: "FileX", baslik: "Ödenmemiş vadesi geçmiş çek/senet",
        mesaj: `Verilen çek/senetlerden ${TL(verilenGecmis)} tutarında vadesi geçmiş ve 'ödenecek' görünen kayıt var.`, deger: verilenGecmis, rapor: "ozel.cek_verilen" });
    }
    if (r.nakitGun !== null && r.nakitGun < 15) {
      add({ id: "nakit_gun", seviye: r.nakitGun < 7 ? "kritik" : "uyari", ikon: "Hourglass", baslik: "Nakit tamponu ince",
        mesaj: `Kasa + banka, ortalama ödemelerle yalnızca ${Math.round(r.nakitGun)} gün yetiyor.`, deger: r.nakitGun, rapor: "ozel.finansal_durum" });
    }

    // ── Alacak / tahsilat ──
    const alinanGecmis = pf.cek.alinanVadesiGecmis + pf.senet.alinanVadesiGecmis;
    if (alinanGecmis > 0) {
      const adet = pf.cek.alinanVadesiGecmisAdet + pf.senet.alinanVadesiGecmisAdet;
      add({ id: "alinan_gecmis", seviye: "uyari", ikon: "FileWarning", baslik: "Tahsil edilmemiş çek/senet",
        mesaj: `${adet} adet alınan çek/senedin vadesi geçti (${TL(alinanGecmis)}) ama hâlâ portföyde.`, deger: alinanGecmis, rapor: "ozel.cek_alinan" });
    }
    if (r.tahsilatOrani90 !== null && r.tahsilatOrani90 < 85) {
      add({ id: "tahsilat_dusuk", seviye: "uyari", ikon: "HandCoins", baslik: "Tahsilat satışın gerisinde",
        mesaj: `Son 90 günde satışların yalnızca ${iyelik(`%${Math.round(r.tahsilatOrani90)}`)} kadar tahsilat yapıldı; alacak büyüyor.`, deger: r.tahsilatOrani90, rapor: "tahsilat_orani.trend.ay" });
    }
    if (r.vadesiGecenOran !== null && r.vadesiGecenOran > 0.25) {
      add({ id: "vadesi_gecen_alacak", seviye: "uyari", ikon: "AlarmClock", baslik: "Vadesi geçen alacak yüksek",
        mesaj: `Alacakların ${iyelik(PCT(r.vadesiGecenOran))} (${TL(r.vadesiGecenAlacak)}) vadesini geçmiş.`, deger: r.vadesiGecenAlacak, rapor: "ozel.alacak_yaslandirma" });
    }
    const cari = B.currentCari(ctx);
    const limitAsan = cari.list.filter((c) => c.kredi_limit > 0 && c.bakiye > c.kredi_limit);
    if (limitAsan.length) {
      const fazla = limitAsan.reduce((s, c) => s + (c.bakiye - c.kredi_limit), 0);
      add({ id: "limit_asan", seviye: "uyari", ikon: "ShieldAlert", baslik: "Kredi limitini aşan müşteriler",
        mesaj: `${limitAsan.length} müşteri limitini toplam ${TL(fazla)} aştı.`, deger: limitAsan.length, rapor: "ozel.limit_asimi" });
    }
    const esik = Math.max(1000, (cari.alacak || 0) * 0.005);
    const hareketsiz = cari.list.filter((c) => c.bakiye > esik && c.son && P.diffDays(c.son, t) > 90);
    if (hareketsiz.length) {
      add({ id: "hareketsiz_alacak", seviye: "uyari", ikon: "Snail", baslik: "Hareketsiz alacaklar",
        mesaj: `${hareketsiz.length} müşterinin 90 günden uzun süredir hareketi yok ama toplam ${TL(hareketsiz.reduce((s, c) => s + c.bakiye, 0))} borcu var.`,
        deger: hareketsiz.length, rapor: "ozel.hareketsiz_alacak" });
    }

    // ── Satış / kârlılık ──
    const dAy = g.detay.ay;
    const gunNo = Number(t.slice(8));
    if (gunNo >= 7 && dAy && dAy.yuzde !== null && dAy.yuzde < -0.15) {
      add({ id: "satis_ay", seviye: "uyari", ikon: "TrendingDown", baslik: "Bu ay satış geride",
        mesaj: `Ay başından bu yana ciro geçen yılın aynı dönemine göre ${PCT(dAy.yuzde)} düşük.`, deger: dAy.yuzde, rapor: "net_ciro.yoy.gun" });
    }
    if (g.reel !== null && g.reel < -0.1) {
      add({ id: "reel_kuculme", seviye: "uyari", ikon: "ArrowDownRight", baslik: "Reel küçülme",
        mesaj: `Enflasyondan arındırıldığında şirket ${PCT(g.reel)} küçülüyor (${g.ufukAd.toLocaleLowerCase("tr-TR")}).`, deger: g.reel, rapor: "ozel.buyume" });
    }
    if (g.ivme && g.ivme.durum === "yavasliyor") {
      add({ id: "ivme", seviye: "bilgi", ikon: "Gauge", baslik: "Büyüme yavaşlıyor",
        mesaj: `Son 90 günün yıllık büyümesi genel eğilimin ${Math.round(Math.abs(g.ivme.deger) * 100)} puan altında.`, deger: g.ivme.deger, rapor: "ozel.buyume" });
    }
    if (r.marjTrend !== null && r.marjTrend < -3) {
      add({ id: "marj", seviye: "uyari", ikon: "Percent", baslik: "Brüt marj geriliyor",
        mesaj: `Son 90 günün brüt marjı geçen yıla göre ${Math.abs(r.marjTrend).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} puan düşük.`, deger: r.marjTrend, rapor: "brut_marj.trend.ay" });
    }
    if (r.zararliUrun > 0) {
      add({ id: "zararli_urun", seviye: r.zararSatisPayi > 0.05 ? "uyari" : "bilgi", ikon: "TriangleAlert", baslik: "Zararına satılan ürünler",
        mesaj: `Son 90 günde ${r.zararliUrun} ürün maliyetinin altında satıldı${r.zararSatisPayi ? ` (cironun ${iyelik(PCT(r.zararSatisPayi, 1))})` : ""}.`, deger: r.zararliUrun, rapor: "ozel.zararli_urunler" });
    }
    if (r.enBuyukMusteriPay !== null && r.enBuyukMusteriPay > 0.25) {
      add({ id: "yogunlasma", seviye: r.enBuyukMusteriPay > 0.4 ? "uyari" : "bilgi", ikon: "PieChart", baslik: "Tek müşteriye bağımlılık",
        mesaj: `En büyük müşteri son 12 ayın cirosunun ${iyelikBelirtme(PCT(r.enBuyukMusteriPay))} oluşturuyor.`, deger: r.enBuyukMusteriPay, rapor: "satis.pay.cari" });
    }
    // Sipariş girişi (öncü gösterge)
    const s30 = Q.total(ctx, "siparis_tutar", { bas: P.addDays(t, -29), bit: t });
    const s30ly = Q.total(ctx, "siparis_tutar", { bas: P.addYears(P.addDays(t, -29), -1), bit: P.addYears(t, -1) });
    const sg = S.growth(s30, s30ly, { minBase: 1000 });
    if (sg !== null && sg < -0.2) {
      add({ id: "siparis", seviye: "bilgi", ikon: "ClipboardList", baslik: "Sipariş girişi azaldı",
        mesaj: `Son 30 günün sipariş tutarı geçen yıla göre ${PCT(sg)} düşük — önümüzdeki haftaların cirosunu etkileyebilir.`, deger: sg, rapor: "siparis_tutar.yoy.gun" });
    }
    // Olağandışı gün (dün): son 8 haftanın aynı gününe göre z > 3
    const dun = P.addDays(t, -1);
    const sameDays = [];
    for (let i = 1; i <= 8; i++) sameDays.push(P.addDays(dun, -7 * i));
    const vals = sameDays.map((d) => Q.total(ctx, "satis", { bas: d, bit: d }) || 0);
    const vDun = Q.total(ctx, "satis", { bas: dun, bit: dun }) || 0;
    const z = S.zscore(vDun, vals);
    if (z !== null && Math.abs(z) >= 3 && S.mean(vals) > 0) {
      add({ id: "anomali", seviye: "bilgi", ikon: z > 0 ? "Zap" : "ZapOff", baslik: z > 0 ? "Dün olağanüstü satış" : "Dün satış çok düşük",
        mesaj: `Dünkü satış ${TL(vDun)}; son 8 haftanın aynı günü ortalaması ${TL(S.mean(vals))}.`, deger: vDun, rapor: "satis.trend.gun" });
    }

    // ── Stok ──
    if (pos.stok.eksi > 0) {
      add({ id: "eksi_stok", seviye: "bilgi", ikon: "PackageX", baslik: "Eksi stok",
        mesaj: `${pos.stok.eksi} üründe stok eksiye düşmüş — giriş belgesi eksik olabilir.`, deger: pos.stok.eksi, rapor: "ozel.eksi_stok" });
    }
    if (pos.stok.maliyetsiz > 0) {
      add({ id: "maliyetsiz", seviye: "bilgi", ikon: "PackageSearch", baslik: "Maliyeti girilmemiş ürünler",
        mesaj: `Stokta olan ${pos.stok.maliyetsiz} ürünün maliyeti sıfır; stok değeri eksik hesaplanır.`, deger: pos.stok.maliyetsiz, rapor: "ozel.stok_degeri" });
    }

    // ── Ayar ──
    if (ctx.s.enflasyon === null) {
      add({ id: "enflasyon", seviye: "bilgi", ikon: "Settings", baslik: "Enflasyon oranı girilmedi",
        mesaj: "Reel büyüme hesaplanabilmesi için Ayarlar'dan yıllık enflasyon oranını girin.", rapor: null });
    }
    return out.sort((a, b) => SIRA[a.seviye] - SIRA[b.seviye]);
  });
}

// "Veriler güncel değil": köprü sessizken yeni veri sürümü gelmez, sonuç önbelleği de yenilenmez.
// Bu yüzden bu uyarı önbelleklenmiş listeye her istekte ayrıca eklenir (withStale).
function sureMetni(dk) {
  if (dk < 120) return `${Math.round(dk)} dakika`;
  if (dk < 48 * 60) return `${Math.round(dk / 60)} saat`;
  return `${Math.round(dk / 1440)} gün`;
}
function staleAlert(sonEsitleme, now = Date.now()) {
  if (!sonEsitleme) return null;
  const dk = (now - new Date(sonEsitleme).getTime()) / 60000;
  if (!(dk > 60)) return null;
  return { id: "veri_eski", seviye: dk > 180 ? "kritik" : "uyari", ikon: "WifiOff", baslik: "Veriler güncel değil",
    mesaj: `Son eşitleme ${sureMetni(dk)} önce. Köprü programı çalışıyor mu?`, deger: Math.round(dk), rapor: null };
}
function withStale(list, sonEsitleme, now = Date.now()) {
  const a = staleAlert(sonEsitleme, now);
  return a ? [a, ...list].sort((x, y) => SIRA[x.seviye] - SIRA[y.seviye]) : list;
}

module.exports = { alerts, staleAlert, withStale };
