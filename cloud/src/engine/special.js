// Özel (elle yazılmış) raporlar. Her biri genel sonuç türlerinden birini döndürür
// (kpi | seri | kategori | matris | tablo | coklu) ya da amiral gemisi türlerden birini
// (saglik | buyume | durum | projeksiyon) — arayüz bunları özel bileşenle çizer.

const P = require("./period");
const Q = require("./query");
const S = require("./stats");
const B = require("./balances");
const { position, portfolio, stockValue } = require("./position");
const { healthScore } = require("./health");
const { growthAnalysis } = require("./growth");
const { projection } = require("./cashflow");
const { alerts } = require("./alerts");
const { ratios } = require("./ratios");
const SEG = require("./segments");

const K = (id, ad, tip = "tl", ek = {}) => ({ id, ad, tip, ...ek });
const tablo = (kolonlar, satirlar, ek = {}) => ({ tur: "tablo", kolonlar, satirlar, ...ek });
// "İlk N" satırlı tablo: adet = kısaltılmadan önceki toplam satır sayısı
const tabloN = (kolonlar, satirlar, n, ek = {}) => tablo(kolonlar, satirlar.slice(0, n), { adet: satirlar.length, ...ek });

// id, ad, kisa, ikon, kategori, tur, grafik, donem, aciklama, fn(ctx, prm, q)
const DEF = [
  // ── Genel durum ──
  { id: "ozel.saglik", ad: "Finansal Sağlık Skoru", kisa: "Sağlık", ikon: "HeartPulse", kategori: "durum", tur: "saglik", grafik: "gosterge", grafikler: ["gosterge"],
    aciklama: "Likidite, kârlılık, büyüme, tahsilat ve risk ölçütlerinden 0-100 skor.", fn: (ctx, prm, q) => ({ tur: "saglik", ...healthScore(ctx, q) }) },
  { id: "ozel.buyume", ad: "Büyüme Endeksi", kisa: "Büyüme", ikon: "Rocket", kategori: "durum", tur: "buyume", grafik: "buyume", grafikler: ["buyume"],
    aciklama: "Net ciro, brüt kâr, tahsilat ve müşteri tabanının yıllık büyümesi; enflasyondan arındırılmış reel büyüme.", fn: (ctx) => ({ tur: "buyume", ...growthAnalysis(ctx) }) },
  { id: "ozel.finansal_durum", ad: "Anlık Finansal Durum", kisa: "Bilanço", ikon: "Scale", kategori: "durum", tur: "durum", grafik: "bilanco", grafikler: ["bilanco", "tablo"],
    aciklama: "Kasa, banka, alacak, çek/senet ve stok varlıkları ile borç, verilen çek/senet ve kredi yükümlülükleri.", fn: (ctx, prm, q) => ({ tur: "durum", ...position(ctx, q) }) },
  { id: "ozel.nakit_projeksiyonu", ad: "Nakit Projeksiyonu (90 gün)", kisa: "Projeksiyon", ikon: "Telescope", kategori: "durum", tur: "projeksiyon", grafik: "cizgi", grafikler: ["cizgi"],
    aciklama: "Vade takvimine göre kesin ve geçmiş ortalamalara göre beklenen nakit seyri.", fn: (ctx, prm, q) => ({ tur: "projeksiyon", ...projection(ctx, { gun: Math.min(365, Math.max(7, Math.round(Number(q.gun) || 90))) }) }) },
  { id: "ozel.uyarilar", ad: "Uyarılar", kisa: "Uyarılar", ikon: "Bell", kategori: "durum", tur: "tablo", grafik: "tablo",
    aciklama: "Kural tabanlı uyarıların tümü.", fn: (ctx) => tablo([K("seviye", "Seviye", "etiket"), K("baslik", "Konu", "metin"), K("mesaj", "Açıklama", "metin")], alerts(ctx)) },
  { id: "ozel.oranlar", ad: "Döngü ve Verimlilik Oranları", kisa: "Oranlar", ikon: "Repeat", kategori: "durum", tur: "tablo", grafik: "tablo",
    aciklama: "DSO, DPO, DIO, nakit dönüşüm süresi, nakit yeterliliği, tahsilat oranı, yoğunlaşma.", fn: (ctx) => {
      const r = ratios(ctx);
      const rows = [
        { ad: "Tahsil süresi (DSO)", deger: r.dso, birim: "gün", aciklama: "Alacakların ortalama kaç günde tahsil edildiği" },
        { ad: "Ödeme süresi (DPO)", deger: r.dpo, birim: "gün", aciklama: "Tedarikçi borçlarının ortalama kaç günde ödendiği" },
        { ad: "Stok süresi (DIO)", deger: r.dio, birim: "gün", aciklama: "Stoğun ortalama kaç günde satıldığı" },
        { ad: "Nakit dönüşüm süresi", deger: r.ccc, birim: "gün", aciklama: "DSO + DIO − DPO" },
        { ad: "Nakit yeterliliği", deger: r.nakitGun, birim: "gün", aciklama: "Kasa+banka, günlük ödemeleri kaç gün karşılar" },
        { ad: "Tahsilat oranı (90 gün)", deger: r.tahsilatOrani90, birim: "%", aciklama: "Tahsilat / satış" },
        { ad: "Brüt marj (12 ay)", deger: r.marj, birim: "%", aciklama: "Brüt kâr / net satış" },
        { ad: "İlk 5 müşteri payı", deger: r.ilk5Pay === null ? null : r.ilk5Pay * 100, birim: "%", aciklama: "Ciroda yoğunlaşma" },
        { ad: "Vadesi geçen alacak", deger: r.vadesiGecenOran === null ? null : r.vadesiGecenOran * 100, birim: "%", aciklama: "FIFO yaşlandırmaya göre" },
        { ad: "Kaldıraç", deger: r.kaldirac, birim: "x", aciklama: "(Kredi + verilen çek/senet) / (likit + alacak + alınan çek/senet)" },
      ];
      return tablo([K("ad", "Oran", "metin"), K("deger", "Değer", "sayi"), K("birim", "Birim", "metin"), K("aciklama", "Açıklama", "metin")], rows);
    } },
  { id: "ozel.gun_ozeti", ad: "Bugünün Özeti", kisa: "Bugün", ikon: "Sun", kategori: "durum", tur: "tablo", grafik: "tablo", donem: "bugun",
    aciklama: "Bugün kesilen fatura, satış, tahsilat, kasa ve banka hareketleri.", fn: (ctx, prm) => {
      const w = { bas: prm.donem.bas, bit: prm.donem.bit };
      const ids = ["satis", "net_ciro", "fatura_sayisi", "tahsilat", "tediye", "alis", "kasa_giris", "kasa_cikis", "banka_giris", "banka_cikis", "siparis_tutar", "siparis_sayisi"];
      return tablo([K("ad", "Kalem", "metin"), K("deger", "Tutar / Adet", "sayi"), K("birim", "Birim", "metin")],
        ids.map((id) => ({ ad: Q.measure(id).ad, deger: Q.total(ctx, id, w), birim: Q.measure(id).birim })));
    } },
  { id: "ozel.ay_kapanis", ad: "Aylık Kapanış Tablosu", kisa: "Ay kapanış", ikon: "CalendarCheck2", kategori: "durum", tur: "tablo", grafik: "tablo", donem: "son12",
    aciklama: "Her ay için satış, tahsilat, alış, ödeme, brüt kâr ve marj.", fn: (ctx, prm) => {
      const w = { bas: P.startOfMonth(prm.donem.bas), bit: prm.donem.bit, gran: "ay" };
      const cols = ["net_ciro", "tahsilat", "alis", "tediye", "net_satis", "brut_kar", "brut_marj"];
      const series = Object.fromEntries(cols.map((c) => [c, Q.series(ctx, c, w)]));
      const rows = series.net_ciro.map((p, i) => ({ ay: P.bucketLabel("ay", p.k), ...Object.fromEntries(cols.map((c) => [c, series[c][i].v])) })).reverse();
      return tablo([K("ay", "Ay", "metin"), K("net_ciro", "Net ciro"), K("tahsilat", "Tahsilat"), K("alis", "Alış"), K("tediye", "Ödeme"),
        K("net_satis", "Net satış (KDV hariç)"), K("brut_kar", "Brüt kâr"), K("brut_marj", "Marj", "yuzdeSayi")], rows);
    } },
  { id: "ozel.yil_karsilastirma", ad: "Yıl-Yıl Karşılaştırma", kisa: "Yıl-yıl", ikon: "CalendarRange", kategori: "durum", tur: "tablo", grafik: "tablo", donem: "bu_yil",
    aciklama: "Bu yılın her ayı geçen yılın aynı ayıyla.", fn: (ctx, prm) => {
      const y = Number(prm.donem.bit.slice(0, 4));
      const cur = Q.series(ctx, "net_ciro", { bas: `${y}-01-01`, bit: `${y}-12-31`, gran: "ay" });
      const prev = Q.series(ctx, "net_ciro", { bas: `${y - 1}-01-01`, bit: `${y - 1}-12-31`, gran: "ay" });
      const rows = cur.map((p, i) => ({ ay: P.AYLAR_UZUN[i], buYil: p.k <= ctx.today.slice(0, 7) ? p.v : null, gecenYil: prev[i].v,
        degisim: p.k <= ctx.today.slice(0, 7) ? S.growth(p.v, prev[i].v, { minBase: 1 }) : null }));
      return tablo([K("ay", "Ay", "metin"), K("buYil", String(y)), K("gecenYil", String(y - 1)), K("degisim", "Değişim", "yuzde")], rows);
    } },
  { id: "ozel.tahmin", ad: "Satış Tahmini (3 ay)", kisa: "Tahmin", ikon: "Sparkles", kategori: "durum", tur: "seri", grafik: "cizgi", grafikler: ["cizgi", "sutun", "tablo"],
    aciklama: "Holt-Winters (mevsimsel) veya Holt (eğilim) ile önümüzdeki 3 ayın net ciro tahmini.", fn: (ctx) => {
      const g = growthAnalysis(ctx);
      const t = ctx.today;
      const bas = P.startOfMonth(P.addMonths(t, -12));
      const lastFull = P.endOfMonth(P.addMonths(t, -1));
      const hist = Q.series(ctx, "net_ciro", { bas, bit: lastFull, gran: "ay" }).map((p) => ({ k: p.k, ad: P.bucketLabel("ay", p.k), v: p.v }));
      const fc = (g.tahmin && g.tahmin.aylar) || [];
      const keys = [...hist.map((p) => p.k), ...fc.map((f) => f.k)];
      const lab = (k) => P.bucketLabel("ay", k);
      return { tur: "seri", birim: "TL", kirilim: "ay", yontem: g.tahmin ? g.tahmin.yontem : null, seriler: [
        { id: "gercek", ad: "Gerçekleşen", veri: keys.map((k) => ({ k, ad: lab(k), v: (hist.find((p) => p.k === k) || {}).v ?? null })) },
        { id: "tahmin", ad: "Tahmin", kesikli: true, veri: keys.map((k) => ({ k, ad: lab(k), v: (fc.find((f) => f.k === k) || {}).deger ?? null })) },
        { id: "alt", ad: "Alt sınır", bant: true, veri: keys.map((k) => ({ k, ad: lab(k), v: (fc.find((f) => f.k === k) || {}).alt ?? null })) },
        { id: "ust", ad: "Üst sınır", bant: true, veri: keys.map((k) => ({ k, ad: lab(k), v: (fc.find((f) => f.k === k) || {}).ust ?? null })) },
      ] };
    } },

  // ── Kasa / banka ──
  { id: "ozel.kasa_durumu", ad: "Kasa Bakiyeleri", kisa: "Kasalar", ikon: "Wallet", kategori: "nakit", tur: "kategori", grafik: "cubuk", grafikler: ["cubuk", "tablo"],
    aciklama: "Kasa bazında nakit bakiye (Arctos 'Toplam Kasa Bakiyesi' formülü). Döviz kasaları kendi biriminde.", fn: (ctx) => {
      const k = B.currentKasa(ctx);
      return { tur: "kategori", birim: "TL", boyut: { id: "kasa", ad: "Kasa" },
        satirlar: k.kasalar.map((x) => ({ k: `${x.firma}:${x.kasa}`, ad: `${x.kasa}${x.doviz ? ` (${x.doviz})` : ""}${ctx.firmalar.length > 1 ? ` · ${ctx.firmaAd(x.firma)}` : ""}`, v: x.bakiye, doviz: x.doviz })),
        toplam: k.tl, doviz: k.doviz };
    } },
  { id: "ozel.banka_durumu", ad: "Banka Hesap Bakiyeleri", kisa: "Hesaplar", ikon: "Landmark", kategori: "banka", tur: "kategori", grafik: "cubuk", grafikler: ["cubuk", "tablo"],
    aciklama: "Aktif hesapların bakiyesi (müşteri bankaları ve pasif hesaplar hariç). Eksi bakiye = kredi kullanımı.", fn: (ctx) => {
      const b = B.currentBanka(ctx);
      return { tur: "kategori", birim: "TL", boyut: { id: "hesap", ad: "Hesap" },
        satirlar: b.hesaplar.map((x) => ({ k: `${x.firma}:${x.id}`, ad: `${x.ad}${x.doviz ? ` (${x.doviz})` : ""}`, v: x.bakiye, doviz: x.doviz })),
        toplam: b.tl, varlik: b.varlik, kredi: b.kredi, doviz: b.doviz };
    } },
  ...[["kasa", "Kasa Bakiyesi Seyri", "Wallet", "nakit"], ["banka", "Banka Bakiyesi Seyri", "Landmark", "banka"]].map(([kind, ad, ikon, kat]) => ({
    id: `ozel.${kind}_bakiye_seyri`, ad, kisa: ad.split(" ")[0] + " seyri", ikon, kategori: kat, tur: "seri", grafik: "alan", grafikler: ["alan", "cizgi", "sutun", "tablo"], donem: "son12",
    aciklama: "Dönem sonu bakiyeleri (açılış devri dahil, dönemler toplanmadan).", fn: (ctx, prm, q) => {
      const gran = prm.kirilim || (prm.donem.gun <= 62 ? "gun" : prm.donem.gun <= 200 ? "hafta" : "ay");
      const s = B.balanceSeries(ctx, kind, { bas: prm.donem.bas, bit: prm.donem.bit, gran });
      const seriler = [{ id: "net", ad: "Net bakiye", veri: s.map((p) => ({ k: p.k, ad: P.bucketLabel(gran, p.k), v: p.net })) }];
      if (kind === "banka") {
        seriler.push({ id: "varlik", ad: "Artı bakiyeler", veri: s.map((p) => ({ k: p.k, ad: P.bucketLabel(gran, p.k), v: p.pos })) });
        seriler.push({ id: "kredi", ad: "Kredi (eksi)", veri: s.map((p) => ({ k: p.k, ad: P.bucketLabel(gran, p.k), v: p.neg })) });
      }
      return { tur: "seri", birim: "TL", kirilim: gran, seriler };
    },
  })),
  { id: "ozel.likidite_seyri", ad: "Likidite Seyri (Kasa + Banka)", kisa: "Likidite", ikon: "Droplets", kategori: "nakit", tur: "seri", grafik: "alan", grafikler: ["alan", "cizgi", "tablo"], donem: "son12",
    aciklama: "Kasa ve banka net bakiyelerinin toplamı.", fn: (ctx, prm) => {
      const gran = prm.kirilim || (prm.donem.gun <= 62 ? "gun" : prm.donem.gun <= 200 ? "hafta" : "ay");
      const k = B.balanceSeries(ctx, "kasa", { bas: prm.donem.bas, bit: prm.donem.bit, gran });
      const b = B.balanceSeries(ctx, "banka", { bas: prm.donem.bas, bit: prm.donem.bit, gran });
      return { tur: "seri", birim: "TL", kirilim: gran, seriler: [
        { id: "toplam", ad: "Kasa + banka", veri: k.map((p, i) => ({ k: p.k, ad: P.bucketLabel(gran, p.k), v: p.net + b[i].net })) },
        { id: "kasa", ad: "Kasa", veri: k.map((p) => ({ k: p.k, ad: P.bucketLabel(gran, p.k), v: p.net })) },
        { id: "banka", ad: "Banka", veri: b.map((p) => ({ k: p.k, ad: P.bucketLabel(gran, p.k), v: p.net })) },
      ] };
    } },
  { id: "ozel.doviz", ad: "Döviz Pozisyonu", kisa: "Döviz", ikon: "Euro", kategori: "banka", tur: "tablo", grafik: "tablo",
    aciklama: "Döviz kasa ve hesapları kendi para biriminde (TL toplamına karışmaz).", fn: (ctx) => {
      const k = B.currentKasa(ctx), b = B.currentBanka(ctx);
      const rows = [
        ...k.kasalar.filter((x) => x.doviz).map((x) => ({ tur: "Kasa", ad: x.kasa, pb: x.doviz, bakiye: x.bakiye })),
        ...b.hesaplar.filter((x) => x.doviz).map((x) => ({ tur: "Banka", ad: x.ad, pb: x.doviz, bakiye: x.bakiye })),
      ];
      return tablo([K("tur", "Tür", "etiket"), K("ad", "Hesap", "metin"), K("pb", "Para birimi", "etiket"), K("bakiye", "Bakiye (kendi biriminde)", "sayi")], rows);
    } },

  // ── Alacak / borç ──
  { id: "ozel.alacak_yaslandirma", ad: "Alacak Yaşlandırma", kisa: "Yaşlandırma", ikon: "AlarmClock", kategori: "tahsilat", tur: "coklu", grafik: "coklu",
    aciklama: "Açık alacaklar vadesine göre (FIFO: bakiye en yeni faturalara dağıtılır).", fn: (ctx, prm) => {
      const a = B.receivableAging(ctx);
      const kov = [["gelmemis", "Vadesi gelmemiş"], ["g0_30", "1-30 gün"], ["g31_60", "31-60 gün"], ["g61_90", "61-90 gün"], ["g90", "90+ gün"]];
      return { tur: "coklu", parcalar: [
        { baslik: "Vade dilimleri", tur: "kategori", birim: "TL", sirali: true, grafik: "sutun", satirlar: kov.map(([k, ad]) => ({ k, ad, v: a.buckets[k] })), toplam: a.toplam },
        tabloN([K("ad", "Müşteri", "metin"), K("bakiye", "Bakiye"), K("gelmemis", "Gelmemiş"), K("g0_30", "1-30"), K("g31_60", "31-60"), K("g61_90", "61-90"), K("g90", "90+"), K("gecikme", "En eski gecikme (gün)", "sayi")],
          a.cariler, prm.n, { baslik: "Müşteri bazında" }),
      ] };
    } },
  { id: "ozel.borclu_musteriler", ad: "Borçlu Müşteriler", kisa: "Borçlular", ikon: "UserMinus", kategori: "tahsilat", tur: "tablo", grafik: "tablo",
    aciklama: "Bize borcu olan cariler (aktif dönem bakiyesi, KREDIHESABI ve personel hariç).", fn: (ctx, prm) => {
      const c = B.currentCari(ctx).list.filter((x) => x.bakiye > 0).sort((a, b) => b.bakiye - a.bakiye);
      return tabloN([K("ad", "Müşteri", "metin"), K("kod", "Kod", "metin"), K("il", "İl", "metin"), K("bakiye", "Bakiye"), K("kredi_limit", "Limit"), K("son", "Son hareket", "tarih")], c, prm.n,
        { toplam: { bakiye: c.reduce((t, x) => t + x.bakiye, 0) } });
    } },
  { id: "ozel.alacakli_tedarikciler", ad: "Borçlu Olduğumuz Cariler", kisa: "Borçlarımız", ikon: "UserPlus", kategori: "alis", tur: "tablo", grafik: "tablo",
    aciklama: "Tedarikçilere olan borçlar (eksi bakiyeler).", fn: (ctx, prm) => {
      const c = B.currentCari(ctx).list.filter((x) => x.bakiye < 0).sort((a, b) => a.bakiye - b.bakiye).map((x) => ({ ...x, borc: -x.bakiye }));
      return tabloN([K("ad", "Cari", "metin"), K("kod", "Kod", "metin"), K("borc", "Borcumuz"), K("son", "Son hareket", "tarih")], c, prm.n,
        { toplam: { borc: c.reduce((t, x) => t + x.borc, 0) } });
    } },
  { id: "ozel.hareketsiz_alacak", ad: "Hareketsiz Alacaklar", kisa: "Hareketsiz", ikon: "Snail", kategori: "tahsilat", tur: "tablo", grafik: "tablo",
    aciklama: "90 günden uzun süredir hareketi olmayan ama bakiyesi olan müşteriler.", fn: (ctx, prm) => {
      const t = ctx.today;
      const c = B.currentCari(ctx).list.filter((x) => x.bakiye > 0.009 && x.son && P.diffDays(x.son, t) > 90)
        .map((x) => ({ ...x, gun: P.diffDays(x.son, t) })).sort((a, b) => b.bakiye - a.bakiye);
      return tabloN([K("ad", "Müşteri", "metin"), K("bakiye", "Bakiye"), K("son", "Son hareket", "tarih"), K("gun", "Geçen gün", "sayi")], c, prm.n);
    } },
  { id: "ozel.limit_asimi", ad: "Kredi Limiti Aşımı", kisa: "Limit aşımı", ikon: "ShieldAlert", kategori: "tahsilat", tur: "tablo", grafik: "tablo",
    aciklama: "Bakiyesi cari kartındaki kredi limitini aşan müşteriler.", fn: (ctx, prm) => {
      const c = B.currentCari(ctx).list.filter((x) => x.kredi_limit > 0 && x.bakiye > x.kredi_limit)
        .map((x) => ({ ...x, asim: x.bakiye - x.kredi_limit, oran: x.bakiye / x.kredi_limit - 1 })).sort((a, b) => b.asim - a.asim);
      return tabloN([K("ad", "Müşteri", "metin"), K("bakiye", "Bakiye"), K("kredi_limit", "Limit"), K("asim", "Aşım"), K("oran", "Aşım oranı", "yuzde")], c, prm.n);
    } },
  { id: "ozel.dso_seyri", ad: "Tahsil Süresi (DSO) Seyri", kisa: "DSO seyri", ikon: "Timer", kategori: "tahsilat", tur: "seri", grafik: "cizgi", grafikler: ["cizgi", "sutun", "tablo"], donem: "son12",
    aciklama: "Her ay sonu: alacak / (son 90 günün satışı / 90).", birim: "gün", fn: (ctx, prm) => {
      const keys = P.enumerateBuckets("ay", prm.donem.bas, prm.donem.bit);
      const ends = keys.map((k) => P.minDate(P.bucketEnd("ay", k), ctx.today));
      const bal = B.balanceAt(ctx, "cari", [...new Set(ends)].sort());
      const veri = keys.map((k, i) => {
        const e = ends[i];
        const s90 = Q.total(ctx, "satis", { bas: P.addDays(e, -89), bit: e });
        return { k, ad: P.bucketLabel("ay", k), v: s90 > 0 ? bal.get(e).pos / (s90 / 90) : null };
      });
      return { tur: "seri", birim: "gün", kirilim: "ay", seriler: [{ id: "dso", ad: "DSO (gün)", veri }] };
    } },
  { id: "ozel.alacak_borc_seyri", ad: "Alacak ve Borç Seyri", kisa: "Alacak/borç", ikon: "ArrowLeftRight", kategori: "tahsilat", tur: "seri", grafik: "cizgi", grafikler: ["cizgi", "alan", "sutun", "tablo"], donem: "son12",
    aciklama: "Ay sonları itibarıyla toplam ticari alacak ve borç.", fn: (ctx, prm) => {
      const gran = prm.kirilim || (prm.donem.gun <= 62 ? "gun" : prm.donem.gun <= 200 ? "hafta" : "ay");
      const s = B.balanceSeries(ctx, "cari", { bas: prm.donem.bas, bit: prm.donem.bit, gran });
      return { tur: "seri", birim: "TL", kirilim: gran, seriler: [
        { id: "alacak", ad: "Alacak", veri: s.map((p) => ({ k: p.k, ad: P.bucketLabel(gran, p.k), v: p.pos })) },
        { id: "borc", ad: "Borç", veri: s.map((p) => ({ k: p.k, ad: P.bucketLabel(gran, p.k), v: -p.neg })) },
      ] };
    } },

  // ── Çek / senet ──
  ...[["cek", "alinan", "Alınan Çekler (Portföy)", "Ticket"], ["cek", "verilen", "Verilen Çekler (Ödenecek)", "TicketX"],
    ["senet", "alinan", "Alınan Senetler", "ScrollText"], ["senet", "verilen", "Verilen Senetler", "Scroll"]].map(([tur, yon, ad, ikon]) => ({
    id: `ozel.${tur}_${yon}`, ad, kisa: ad.split(" (")[0], ikon, kategori: "cek", tur: "tablo", grafik: "tablo",
    aciklama: `${ad}: yalnız açık olanlar (VARES görünümü; alınanlarda 'Tahsilat Yok', verilenlerde 'Ödenecek').`, fn: (ctx, prm) => {
      const t = ctx.today;
      const rows = portfolio(ctx).filter((r) => r.tur === tur && r.yon === yon && r.acik)
        .map((r) => ({ ...r, gun: r.vade ? P.diffDays(t, r.vade) : null, gecikti: r.vade && r.vade < t }))
        .sort((a, b) => (a.vade || "") < (b.vade || "") ? -1 : 1);
      return tabloN([K("vade", "Vade", "tarih"), K("gun", "Kalan gün", "sayi"), K("tutar", "Tutar"), K("cari", "Cari", "metin"), K("belgeno", "No", "metin"), K("banka", "Banka", "metin"), K("durum", "Durum", "etiket")],
        rows, prm.n, { toplam: { tutar: rows.reduce((s, r) => s + r.tutar, 0) } });
    },
  })),
  { id: "ozel.vade_takvimi", ad: "Vade Takvimi (Haftalık)", kisa: "Vade takvimi", ikon: "CalendarClock", kategori: "cek", tur: "seri", grafik: "sutun", grafikler: ["sutun", "tablo"],
    aciklama: "Önümüzdeki 12 haftada tahsil edilecek ve ödenecek çek/senetler.", fn: (ctx) => {
      const t = ctx.today;
      const keys = P.enumerateBuckets("hafta", t, P.addDays(t, 83));
      const gir = new Map(keys.map((k) => [k, 0])), cik = new Map(keys.map((k) => [k, 0]));
      for (const r of portfolio(ctx)) {
        if (!r.acik || !r.vade) continue;
        const k = P.bucketOf("hafta", r.vade < t ? t : r.vade);
        if (!gir.has(k)) continue;
        if (r.yon === "alinan") gir.set(k, gir.get(k) + r.tutar); else cik.set(k, cik.get(k) + r.tutar);
      }
      const lab = (k) => P.bucketLabel("hafta", k);
      return { tur: "seri", birim: "TL", kirilim: "hafta", seriler: [
        { id: "giris", ad: "Tahsil edilecek", veri: keys.map((k) => ({ k, ad: lab(k), v: gir.get(k) })) },
        { id: "cikis", ad: "Ödenecek", veri: keys.map((k) => ({ k, ad: lab(k), v: -cik.get(k) })) },
      ] };
    } },
  { id: "ozel.cek_banka", ad: "Alınan Çekler — Banka Dağılımı", kisa: "Çek/banka", ikon: "Landmark", kategori: "cek", tur: "kategori", grafik: "pasta", grafikler: ["pasta", "cubuk", "tablo"],
    aciklama: "Portföydeki alınan çeklerin keşideci bankalara dağılımı.", fn: (ctx) => {
      const m = new Map();
      for (const r of portfolio(ctx)) if (r.acik && r.tur === "cek" && r.yon === "alinan") m.set(r.banka || "(Banka yok)", (m.get(r.banka || "(Banka yok)") || 0) + r.tutar);
      const tot = [...m.values()].reduce((s, v) => s + v, 0);
      return { tur: "kategori", birim: "TL", boyut: { id: "banka", ad: "Banka" }, satirlar: [...m.entries()].map(([ad, v]) => ({ k: ad, ad, v, pay: tot ? v / tot : 0 })).sort((a, b) => b.v - a.v), toplam: tot };
    } },

  // ── Müşteri analizleri ──
  { id: "ozel.rfm", ad: "Müşteri Segmentleri (RFM)", kisa: "Segmentler", ikon: "Crown", kategori: "musteri", tur: "coklu", grafik: "coklu",
    aciklama: "Son alış zamanı, alış sıklığı ve tutarına göre şampiyon, sadık, risk altında, uykuda… müşteriler.", fn: (ctx, prm) => {
      const r = SEG.rfm(ctx);
      return { tur: "coklu", parcalar: [
        { baslik: "Segmentler", tur: "kategori", birim: "adet", grafik: "cubuk", satirlar: r.segmentler.map((s) => ({ k: s.id, ad: s.ad, v: s.adet, ciro: s.ciro, ikon: s.ikon, aciklama: s.aciklama })) },
        tabloN([K("ad", "Müşteri", "metin"), K("segmentAd", "Segment", "etiket"), K("sonAlis", "Son alış", "tarih"), K("gunOnce", "Gün önce", "sayi"), K("fatura", "Fatura", "sayi"), K("ciro", "Ciro (12 ay)")],
          r.musteriler, prm.n, { baslik: "Müşteriler" }),
      ] };
    } },
  { id: "ozel.yeni_kayip", ad: "Yeni, Kayıp ve Geri Dönen Müşteriler", kisa: "Yeni/kayıp", ikon: "UserRoundCheck", kategori: "musteri", tur: "coklu", grafik: "coklu", donem: "bu_ay",
    aciklama: "Dönemde ilk kez alan, önceki dönemde alıp bu dönemde almayan ve uzun aradan sonra dönen müşteriler.", fn: (ctx, prm) => {
      const c = SEG.churn(ctx, { bas: prm.donem.bas, bit: prm.donem.bit });
      const tb = (list, baslik) => tabloN([K("ad", "Müşteri", "metin"), K("v", "Ciro")], list, prm.n, { baslik });
      return { tur: "coklu", parcalar: [
        { baslik: "Özet", tur: "kategori", birim: "adet", grafik: "cubuk", satirlar: [
          { k: "yeni", ad: "Yeni", v: c.yeni.length }, { k: "geri", ad: "Geri dönen", v: c.geriDonen.length }, { k: "kayip", ad: "Kayıp", v: c.kayip.length },
        ], elde: c.elde },
        tb(c.yeni, "Yeni müşteriler"), tb(c.kayip, "Bu dönem alış yapmayanlar"), tb(c.geriDonen, "Geri dönenler"),
      ] };
    } },
  { id: "ozel.musteri_karlilik", ad: "Müşteri Kârlılığı", kisa: "Müşteri kârı", ikon: "BadgePercent", kategori: "karlilik", tur: "tablo", grafik: "tablo", donem: "bu_yil",
    aciklama: "Müşteri bazında net satış, maliyet, brüt kâr ve marj.", fn: (ctx, prm) => profitTable(ctx, prm, "cari", "Müşteri") },
  { id: "ozel.urun_karlilik", ad: "Ürün Kârlılığı", kisa: "Ürün kârı", ikon: "PackageCheck", kategori: "karlilik", tur: "tablo", grafik: "tablo", donem: "bu_yil",
    aciklama: "Ürün bazında net satış, maliyet, brüt kâr ve marj (Arctos kâr analizi).", fn: (ctx, prm) => profitTable(ctx, prm, "urun", "Ürün") },
  { id: "ozel.sinif_karlilik", ad: "Ürün Sınıfı Kârlılığı", kisa: "Sınıf kârı", ikon: "Shapes", kategori: "karlilik", tur: "tablo", grafik: "tablo", donem: "bu_yil",
    aciklama: "Stok sınıfı (KOD2) bazında kârlılık.", fn: (ctx, prm) => profitTable(ctx, prm, "sinif", "Sınıf") },
  { id: "ozel.zararli_urunler", ad: "Zararına Satılan Ürünler", kisa: "Zararlı ürünler", ikon: "TriangleAlert", kategori: "karlilik", tur: "tablo", grafik: "tablo", donem: "son90",
    aciklama: "Satış tutarı maliyetinin altında kalan ürünler.", fn: (ctx, prm) => {
      const t = profitRows(ctx, prm, "urun").filter((r) => r.kar < 0).sort((a, b) => a.kar - b.kar);
      return tabloN(profitCols("Ürün"), t, prm.n, { toplam: { kar: t.reduce((s, r) => s + r.kar, 0) } });
    } },
  { id: "ozel.urun_matrisi", ad: "Ürün Matrisi (Büyüme × Marj)", kisa: "Ürün matrisi", ikon: "ScatterChart", kategori: "urun", tur: "tablo", grafik: "tablo", donem: "son90",
    aciklama: "Her ürün için satış büyümesi (geçen yılın aynı dönemine göre) ve brüt marj: yıldızlar, nakit inekleri, sorunlular.", fn: (ctx, prm) => {
      const w = { bas: prm.donem.bas, bit: prm.donem.bit };
      const gy = P.lastYearPeriod(prm.donem);
      const cur = Q.byDim(ctx, "net_satis", "urun", { ...w, limit: 0 }).satirlar;
      const prev = new Map(Q.byDim(ctx, "net_satis", "urun", { bas: gy.bas, bit: gy.bit, limit: 0 }).satirlar.map((r) => [r.k, r.v]));
      const marj = new Map(Q.byDim(ctx, "brut_marj", "urun", { ...w, limit: 0 }).satirlar.map((r) => [r.k, r.v]));
      const medM = S.median([...marj.values()].filter((v) => v !== null)) || 0;
      const rows = cur.filter((r) => r.v > 0).map((r) => {
        const g = S.growth(r.v, prev.get(r.k) || 0, { minBase: 100 });
        const m = marj.get(r.k);
        const grup = g === null ? "Yeni" : g >= 0 && m >= medM ? "Yıldız" : g < 0 && m >= medM ? "Nakit ineği" : g >= 0 ? "Hacim" : "Sorunlu";
        return { ad: r.ad, satis: r.v, buyume: g, marj: m, grup };
      });
      return tabloN([K("ad", "Ürün", "metin"), K("satis", "Net satış"), K("buyume", "Büyüme", "yuzde"), K("marj", "Marj", "yuzdeSayi"), K("grup", "Grup", "etiket")], rows, prm.n);
    } },
  { id: "ozel.abc_urun", ad: "Ürün ABC Analizi", kisa: "Ürün ABC", ikon: "BarChart3", kategori: "urun", tur: "coklu", grafik: "coklu",
    aciklama: "Son 12 ayın net satışına göre A/B/C sınıfları.", fn: (ctx, prm) => abcReport(ctx, prm, "net_satis", "urun", "Ürün") },
  { id: "ozel.abc_musteri", ad: "Müşteri ABC Analizi", kisa: "Müşteri ABC", ikon: "BarChart3", kategori: "musteri", tur: "coklu", grafik: "coklu",
    aciklama: "Son 12 ayın satışına göre A/B/C müşteri sınıfları.", fn: (ctx, prm) => abcReport(ctx, prm, "satis", "cari", "Müşteri") },

  // ── Stok ──
  { id: "ozel.stok_degeri", ad: "Stok Değeri", kisa: "Stok değeri", ikon: "Warehouse", kategori: "stok", tur: "kategori", grafik: "agac", grafikler: ["agac", "pasta", "cubuk", "tablo"],
    aciklama: "Depo envanteri (SUM(ENVANTER), rezerv hariç) × kart maliyeti, sınıf bazında.", fn: (ctx) => {
      const rows = stockRows(ctx);
      const m = new Map();
      for (const r of rows) if (r.miktar > 0) m.set(r.sinif || "(Sınıfsız)", (m.get(r.sinif || "(Sınıfsız)") || 0) + r.deger);
      const tot = [...m.values()].reduce((s, v) => s + v, 0);
      return { tur: "kategori", birim: "TL", boyut: { id: "sinif", ad: "Sınıf" }, satirlar: [...m.entries()].map(([ad, v]) => ({ k: ad, ad, v, pay: tot ? v / tot : 0 })).sort((a, b) => b.v - a.v), toplam: tot };
    } },
  { id: "ozel.eksi_stok", ad: "Eksi Stoklu Ürünler", kisa: "Eksi stok", ikon: "PackageX", kategori: "stok", tur: "tablo", grafik: "tablo",
    aciklama: "Depo envanteri eksiye düşmüş ürünler — giriş belgesi eksik olabilir.", fn: (ctx, prm) => tabloN(stockCols(), stockRows(ctx).filter((r) => r.miktar < 0).sort((a, b) => a.miktar - b.miktar), prm.n) },
  { id: "ozel.kritik_stok", ad: "Kritik Seviyenin Altındakiler", kisa: "Kritik stok", ikon: "PackageMinus", kategori: "stok", tur: "tablo", grafik: "tablo",
    aciklama: "Kalanı kart kritik seviyesinin altında olan (sipariş verilmesi gereken) ürünler.", fn: (ctx, prm) => tabloN([...stockCols(), K("kritik", "Kritik", "sayi"), K("eksik", "Sipariş", "sayi")],
      stockRows(ctx).filter((r) => r.kritik > 0 && r.miktar < r.kritik).map((r) => ({ ...r, eksik: r.kritik - r.miktar })).sort((a, b) => b.eksik - a.eksik), prm.n) },
  { id: "ozel.olu_stok", ad: "Ölü Stok", kisa: "Ölü stok", ikon: "Skull", kategori: "stok", tur: "tablo", grafik: "tablo",
    aciklama: "Stoğu olduğu hâlde son 180 günde hiç satılmamış ürünler.", fn: (ctx, prm) => {
      const t = ctx.today;
      const sold = new Set(Q.byDim(ctx, "miktar", "urun", { bas: P.addDays(t, -179), bit: t, limit: 0 }).satirlar.filter((r) => r.v > 0).map((r) => r.k));
      const rows = stockRows(ctx).filter((r) => r.miktar > 0 && !sold.has(`${r.firma}:${r.id}`)).sort((a, b) => b.deger - a.deger);
      return tabloN(stockCols(), rows, prm.n, { toplam: { deger: rows.reduce((s, r) => s + r.deger, 0) } });
    } },
  { id: "ozel.stok_devir", ad: "Stok Devir Hızı", kisa: "Devir hızı", ikon: "RefreshCw", kategori: "stok", tur: "tablo", grafik: "tablo",
    aciklama: "Son 90 günün satış miktarına göre kaç günlük stok olduğu ve devir hızı.", fn: (ctx, prm) => {
      const t = ctx.today;
      const sold = new Map(Q.byDim(ctx, "miktar", "urun", { bas: P.addDays(t, -89), bit: t, limit: 0 }).satirlar.map((r) => [r.k, r.v]));
      const rows = stockRows(ctx).filter((r) => r.miktar > 0).map((r) => {
        const s = sold.get(`${r.firma}:${r.id}`) || 0;
        return { ...r, satis90: s, gunluk: s / 90, gunSayisi: s > 0 ? r.miktar / (s / 90) : null, devir: r.miktar > 0 ? s / r.miktar : null };
      }).sort((a, b) => (b.gunSayisi ?? 1e9) - (a.gunSayisi ?? 1e9));
      return tabloN([...stockCols(), K("satis90", "90 gün satış", "sayi"), K("gunSayisi", "Kaç günlük", "sayi"), K("devir", "Devir hızı (90g)", "sayi")], rows, prm.n);
    } },

  // ── Veri kontrolü ──
  { id: "ozel.izahat_dagilimi", ad: "Cari İzahat Dağılımı", kisa: "İzahat", ikon: "ListTree", kategori: "veri", tur: "tablo", grafik: "tablo", donem: "bu_yil",
    aciklama: "Cari hareket kodlarının dağılımı ve hangi iş olayına eşlendiği (ayarlardan değiştirilebilir).", fn: (ctx, prm) => {
      const rows = ctx.db.all(`SELECT h.izahat, COUNT(*) AS adet, SUM(h.borc) AS borc, SUM(h.alacak) AS alacak FROM cari_hareket h
        WHERE ${ctx.firmaIn("h")} AND h.tarih BETWEEN ? AND ? GROUP BY h.izahat ORDER BY adet DESC`, prm.donem.bas, prm.donem.bit);
      const kat = (iz) => Object.entries(ctx.s.izahat).filter(([, v]) => v.includes(iz)).map(([k]) => k).join(", ") || "—";
      return tablo([K("izahat", "Kod", "sayi"), K("anlam", "Anlamı", "metin"), K("kategori", "Eşleme", "etiket"), K("adet", "Satır", "sayi"), K("borc", "Borç"), K("alacak", "Alacak")],
        rows.map((r) => ({ ...r, anlam: IZAHAT_AD[r.izahat] || "?", kategori: kat(r.izahat) })));
    } },
  { id: "ozel.havale_mutabakat", ad: "Havale Mutabakatı (Banka 83 ↔ Cari 83)", kisa: "Havale mutabakat", ikon: "CheckCheck", kategori: "veri", tur: "tablo", grafik: "tablo", donem: "son12",
    aciklama: "Banka havale girişleri ile cari havale tahsilatları kuruşu kuruşuna tutmalı (Kılavuz §36.10).", fn: (ctx, prm) => {
      const w = [prm.donem.bas, prm.donem.bit];
      const rows = ctx.db.all(`SELECT substr(tarih,1,7) AS ay, SUM(borc) AS v FROM banka_hareket b WHERE ${ctx.firmaIn("b")} AND izahat = 83 AND tarih BETWEEN ? AND ? GROUP BY ay`, ...w);
      const cari = new Map(ctx.db.all(`SELECT substr(tarih,1,7) AS ay, SUM(alacak) AS v FROM cari_hareket h WHERE ${ctx.firmaIn("h")} AND izahat = 83 AND tarih BETWEEN ? AND ? GROUP BY ay`, ...w).map((r) => [r.ay, r.v]));
      const out = rows.map((r) => ({ ay: P.bucketLabel("ay", r.ay), banka: r.v, cari: cari.get(r.ay) || 0, fark: r.v - (cari.get(r.ay) || 0) }));
      return tablo([K("ay", "Ay", "metin"), K("banka", "Banka 83 (BORÇ)"), K("cari", "Cari 83 (ALACAK)"), K("fark", "Fark")], out);
    } },
  { id: "ozel.veri_kapsami", ad: "Veri Kapsamı", kisa: "Kapsam", ikon: "Database", kategori: "veri", tur: "tablo", grafik: "tablo",
    aciklama: "Köprüden gelen veri kümeleri: satır sayısı, ilk ve son tarih.", fn: (ctx) => {
      const sets = [["cari_hareket", "Cari hareket"], ["kasa_hareket", "Kasa"], ["banka_hareket", "Banka"], ["satis", "Satış satırları"], ["alis", "Alış satırları"], ["siparis", "Siparişler"], ["cek_senet", "Çek/senet"], ["stok_durum", "Depo envanteri"]];
      const rows = sets.map(([t, ad]) => {
        const hasDate = !["cek_senet", "stok_durum"].includes(t);
        const r = ctx.db.get(`SELECT COUNT(*) AS n${hasDate ? ", MIN(tarih) AS ilk, MAX(tarih) AS son" : ""} FROM ${t} x WHERE ${ctx.firmaIn("x")}`);
        return { ad, satir: r.n, ilk: r.ilk || null, son: r.son || null };
      });
      return tablo([K("ad", "Veri", "metin"), K("satir", "Satır", "sayi"), K("ilk", "İlk tarih", "tarih"), K("son", "Son tarih", "tarih")], rows);
    } },
];

const IZAHAT_AD = { 11: "Cari çıkış / tediye", 12: "Çıkış iade bordrosu", 13: "Cari giriş / tahsilat", 16: "Çek ödeme", 19: "Verilen çek bordrosu", 20: "Alış faturası",
  21: "Satış faturası", 22: "Alış iade / irsaliye", 23: "Satış iade", 26: "Alış irsaliyesi", 27: "Satış irsaliyesi", 29: "İade irsaliyesi", 32: "Stok giriş fişi",
  33: "Stok çıkış / zayi", 34: "Stok giriş iade", 83: "Havale (banka tahsilat)", 84: "Banka ödeme", 103: "Cari devir giriş", 104: "Cari devir çıkış" };

function profitCols(ad) {
  return [K("ad", ad, "metin"), K("satis", "Net satış"), K("maliyet", "Maliyet"), K("kar", "Brüt kâr"), K("marj", "Marj", "yuzdeSayi"), K("miktar", "Miktar", "sayi")];
}
function profitRows(ctx, prm, dim) {
  const w = { bas: prm.donem.bas, bit: prm.donem.bit, limit: 0 };
  const sat = Q.byDim(ctx, "net_satis", dim, w).satirlar;
  const mal = new Map(Q.byDim(ctx, "maliyet", dim, w).satirlar.map((r) => [r.k, r.v]));
  const kar = new Map(Q.byDim(ctx, "brut_kar", dim, w).satirlar.map((r) => [r.k, r.v]));
  const mik = dim === "urun" ? new Map(Q.byDim(ctx, "miktar", dim, w).satirlar.map((r) => [r.k, r.v])) : new Map();
  return sat.map((r) => ({ ad: r.ad, satis: r.v, maliyet: mal.get(r.k) || 0, kar: kar.get(r.k) || 0, marj: r.v ? ((kar.get(r.k) || 0) / r.v) * 100 : null, miktar: mik.get(r.k) ?? null }));
}
function profitTable(ctx, prm, dim, ad) {
  const rows = profitRows(ctx, prm, dim).sort((a, b) => b.kar - a.kar);
  return tabloN(profitCols(ad), rows, prm.n, {
    toplam: { satis: rows.reduce((s, r) => s + r.satis, 0), maliyet: rows.reduce((s, r) => s + r.maliyet, 0), kar: rows.reduce((s, r) => s + r.kar, 0) },
  });
}
function abcReport(ctx, prm, olcu, boyut, ad) {
  const a = SEG.abc(ctx, { olcu, boyut });
  return { tur: "coklu", parcalar: [
    { baslik: "Sınıflar", tur: "kategori", birim: "TL", grafik: "cubuk", satirlar: ["A", "B", "C"].map((s) => ({ k: s, ad: `${s} sınıfı (${a.ozet[s].adet})`, v: a.ozet[s].v, pay: a.toplam ? a.ozet[s].v / a.toplam : 0 })), toplam: a.toplam },
    tabloN([K("ad", ad, "metin"), K("v", "Tutar"), K("pay", "Pay", "yuzde"), K("kum", "Kümülatif", "yuzde"), K("sinif", "Sınıf", "etiket")], a.satirlar, prm.n, { baslik: `${ad} listesi` }),
  ] };
}
function stockCols() {
  return [K("ad", "Ürün", "metin"), K("kod", "Kod", "metin"), K("sinif", "Sınıf", "metin"), K("miktar", "Kalan", "sayi"), K("maliyet", "Birim maliyet"), K("deger", "Değer")];
}
function stockRows(ctx) {
  return ctx.cached("stockRows", () => {
    const out = [];
    for (const firma of ctx.firmalar) {
      const donem = ctx.activeDonem(firma);
      if (!donem) continue;
      const rows = ctx.db.all(`
        SELECT st.id, st.kod, st.ad, st.sinif, IFNULL(st.maliyet, 0) AS maliyet, IFNULL(st.kritik, 0) AS kritik, q.m AS miktar
        FROM (SELECT stok_id, SUM(miktar) AS m FROM stok_durum WHERE firma = ? AND donem = ? GROUP BY stok_id) q
        JOIN stok st ON st.firma = ? AND st.id = q.stok_id
        WHERE st.id >= 100 AND IFNULL(st.tip, 0) NOT IN (3, 7, 9) AND IFNULL(st.pasif, 0) = 0`, firma, donem, firma);
      for (const r of rows) out.push({ ...r, firma, deger: Math.max(0, r.miktar) * r.maliyet });
    }
    return out;
  });
}

// Rapor başına ek bilgi (tek yerde, testle zorunlu tutulur):
//   iyi       — artış iyi mi (yukari) · kötü mü (asagi) · yönsüz (notr); arayüz değişim renklerini buna göre boyar
//   donemsiz  — dönem kullanmaz (anlık bakiye ya da sabit pencere): arayüz dönem seçicisini gizler, yanıtta donem: null
//   kirilimli — gün/hafta/ay kırılımı seçilebilir
//   n, nSecenekler — "ilk N" satır: varsayılan ve seçenekler (yoksa rapor tüm satırları döndürür)
const N_TABLO = [25, 50, 100, 250, 500];
const T = { n: 100, nSecenekler: N_TABLO };
const EK = {
  "ozel.saglik": { iyi: "yukari", donemsiz: true },
  "ozel.buyume": { iyi: "yukari", donemsiz: true },
  "ozel.finansal_durum": { iyi: "notr", donemsiz: true },
  "ozel.nakit_projeksiyonu": { iyi: "yukari", donemsiz: true },
  "ozel.uyarilar": { iyi: "notr", donemsiz: true },
  "ozel.oranlar": { iyi: "notr", donemsiz: true },
  "ozel.gun_ozeti": { iyi: "notr" },
  "ozel.ay_kapanis": { iyi: "notr" },
  "ozel.yil_karsilastirma": { iyi: "yukari" },
  "ozel.tahmin": { iyi: "yukari", donemsiz: true },
  "ozel.kasa_durumu": { iyi: "yukari", donemsiz: true },
  "ozel.banka_durumu": { iyi: "yukari", donemsiz: true },
  "ozel.kasa_bakiye_seyri": { iyi: "yukari", kirilimli: true },
  "ozel.banka_bakiye_seyri": { iyi: "yukari", kirilimli: true },
  "ozel.likidite_seyri": { iyi: "yukari", kirilimli: true },
  "ozel.doviz": { iyi: "notr", donemsiz: true },
  "ozel.alacak_yaslandirma": { iyi: "asagi", donemsiz: true, n: 50, nSecenekler: N_TABLO },
  "ozel.borclu_musteriler": { iyi: "asagi", donemsiz: true, ...T },
  "ozel.alacakli_tedarikciler": { iyi: "asagi", donemsiz: true, ...T },
  "ozel.hareketsiz_alacak": { iyi: "asagi", donemsiz: true, ...T },
  "ozel.limit_asimi": { iyi: "asagi", donemsiz: true, ...T },
  "ozel.dso_seyri": { iyi: "asagi" },
  "ozel.alacak_borc_seyri": { iyi: "notr", kirilimli: true },
  "ozel.cek_alinan": { iyi: "notr", donemsiz: true, ...T },
  "ozel.cek_verilen": { iyi: "notr", donemsiz: true, ...T },
  "ozel.senet_alinan": { iyi: "notr", donemsiz: true, ...T },
  "ozel.senet_verilen": { iyi: "notr", donemsiz: true, ...T },
  "ozel.vade_takvimi": { iyi: "notr", donemsiz: true },
  "ozel.cek_banka": { iyi: "notr", donemsiz: true },
  "ozel.rfm": { iyi: "notr", donemsiz: true, ...T },
  "ozel.yeni_kayip": { iyi: "notr", n: 30, nSecenekler: [10, 30, 50, 100] },
  "ozel.musteri_karlilik": { iyi: "yukari", ...T },
  "ozel.urun_karlilik": { iyi: "yukari", ...T },
  "ozel.sinif_karlilik": { iyi: "yukari", ...T },
  "ozel.zararli_urunler": { iyi: "asagi", ...T },
  "ozel.urun_matrisi": { iyi: "notr", ...T },
  "ozel.abc_urun": { iyi: "notr", donemsiz: true, ...T },
  "ozel.abc_musteri": { iyi: "notr", donemsiz: true, ...T },
  "ozel.stok_degeri": { iyi: "notr", donemsiz: true },
  "ozel.eksi_stok": { iyi: "asagi", donemsiz: true, ...T },
  "ozel.kritik_stok": { iyi: "asagi", donemsiz: true, ...T },
  "ozel.olu_stok": { iyi: "asagi", donemsiz: true, ...T },
  "ozel.stok_devir": { iyi: "notr", donemsiz: true, ...T },
  "ozel.izahat_dagilimi": { iyi: "notr" },
  "ozel.havale_mutabakat": { iyi: "notr" },
  "ozel.veri_kapsami": { iyi: "notr", donemsiz: true },
};

const LIST = DEF.map(({ fn, ...meta }) => ({ ...meta, ...EK[meta.id], donem: meta.donem || "bu_ay", birim: meta.birim || "TL" }));
const FN = new Map(DEF.map((d) => [d.id, d.fn]));

function run(ctx, rep, prm, q) {
  const fn = FN.get(rep.id);
  if (!fn) throw Object.assign(new Error(`Özel rapor yok: ${rep.id}`), { status: 404 });
  return fn(ctx, prm, q);
}

module.exports = { LIST, run, IZAHAT_AD, EK, DEF_IDS: DEF.map((d) => d.id) };
