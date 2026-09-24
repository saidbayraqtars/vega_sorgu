// ═══════════════════════════════════════════════════════════════════════════
//  Ölçü (measure) ve boyut (dimension) sözlüğü.
//  Her formül Vega Kılavuzu KISIM V'teki DOĞRULANMIŞ Arctos formüllerine dayanır:
//   • Kasa nakdi   : (GELIR-GIDER)/KUR · ISLEMTIPI=1 · KREDIKASA hariç (§24)
//   • Banka        : (BORC-ALACAK)/KUR · MUSBANKA=0 · STATUS<>2 (§25)
//   • Cari         : BORC-ALACAK · KREDIHESABI hariç · personel hariç (§26)
//   • Ciro/Tahsilat: IZAHAT 21 (BORC) / 13+83 (ALACAK) (§26.4, §12.4)
//   • Kârlılık     : GERCEKTOPLAM − MIKTAR×AFIYATI − MASRAF · STOKTIPI∉(12,13,14) · DETAY=0 (§28)
//  Döviz kasa/hesapları TL toplamına karışmaz (§9.2); açılış devri akışlara girmez (§24.6).
// ═══════════════════════════════════════════════════════════════════════════

const TL_SET = "('', 'TL', 'TRY', 'YTL', '₺')";
// Satır tutarını TL'ye çevir: TL satırlar olduğu gibi, dövizli satırlar ×KUR.
const fx = (a) => `(CASE WHEN UPPER(IFNULL(${a}.pb, '')) IN ${TL_SET} THEN 1.0 ELSE IFNULL(NULLIF(${a}.kur, 0), 1.0) END)`;
// İade faturası satırı ciroyu düşürür
const sgn = (a) => `(CASE WHEN IFNULL(${a}.iade, 0) = 1 THEN -1.0 ELSE 1.0 END)`;
const kurx = (a) => `IFNULL(NULLIF(${a}.kur, 0), 1.0)`;

// ─── Kaynaklar ─────────────────────────────────────────────────────────────
const SOURCES = {
  cari: {
    alias: "h",
    from: () => "cari_hareket h LEFT JOIN cari c ON c.firma = h.firma AND c.id = h.cari_id",
    where: (ctx) => `${ctx.firmaIn("h")} AND h.izahat NOT IN (${ctx.iz("DEVIR")}) AND NOT ${ctx.personel("c")} AND IFNULL(h.ozelkod, '') <> 'KREDIHESABI'`,
  },
  satis: {
    alias: "s",
    from: () => "satis s LEFT JOIN stok st ON st.firma = s.firma AND st.id = s.stok_id LEFT JOIN cari c ON c.firma = s.firma AND c.id = s.cari_id",
    where: (ctx) => `${ctx.firmaIn("s")} AND IFNULL(s.stoktipi, 0) NOT IN (12, 13, 14) AND IFNULL(s.detay, 0) = 0 AND IFNULL(s.iptal, 0) = 0`,
  },
  alis: {
    alias: "a",
    from: () => "alis a LEFT JOIN stok st ON st.firma = a.firma AND st.id = a.stok_id LEFT JOIN cari c ON c.firma = a.firma AND c.id = a.cari_id",
    where: (ctx) => `${ctx.firmaIn("a")} AND IFNULL(a.iptal, 0) = 0`,
  },
  kasa: {
    alias: "k",
    from: () => "kasa_hareket k",
    where: (ctx) => `${ctx.firmaIn("k")} AND k.islemtipi = 1 AND IFNULL(k.kredikasa, 0) = 0 AND k.dv IS NULL AND IFNULL(k.devir, 0) = 0`,
  },
  banka: {
    alias: "b",
    from: () => "banka_hareket b JOIN banka ba ON ba.firma = b.firma AND ba.id = b.banka_id",
    where: (ctx) => `${ctx.firmaIn("b")} AND IFNULL(ba.musbanka, 0) = 0 AND IFNULL(ba.status, 1) <> 2 AND ba.dv IS NULL AND IFNULL(b.devir, 0) = 0`,
  },
  siparis: {
    alias: "o",
    from: () => "siparis o LEFT JOIN cari c ON c.firma = o.firma AND c.id = o.cari_id",
    where: (ctx) => `${ctx.firmaIn("o")} AND IFNULL(o.iptal, 0) = 0`,
  },
};

// ─── Ölçüler ───────────────────────────────────────────────────────────────
// n: pay ifadesi, d: (varsa) payda ifadesi, calc: (n,d) → değer
// filter: kaynağın WHERE'ine eklenen koşul
// iyi: 'yukari' (artış iyi) | 'asagi' (azalış iyi) | 'notr'
const pct = (n, d) => (d ? (n / d) * 100 : null);
const div = (n, d) => (d ? n / d : null);

const MEASURES = {
  // ── Satış (cari defterinden, KDV dahil — tüm faturaları kapsar) ──
  satis: {
    ad: "Satış (KDV dahil)", kisa: "Satış", ikon: "ShoppingCart", kat: "satis", birim: "TL", iyi: "yukari", src: "cari",
    filter: (ctx) => `h.izahat IN (${ctx.iz("SATIS")})`, n: () => "SUM(h.borc - h.alacak)",
    aciklama: "Satış faturalarının cariye yansıyan genel toplamı (IZAHAT 21, BORÇ). KDV dahildir.",
  },
  satis_iade: {
    ad: "Satış İadesi", kisa: "İade", ikon: "Undo2", kat: "satis", birim: "TL", iyi: "asagi", src: "cari",
    filter: (ctx) => `h.izahat IN (${ctx.iz("SATIS_IADE")})`, n: () => "-SUM(h.borc - h.alacak)",
    aciklama: "Satış iadelerinin cariye yansıyan tutarı (IZAHAT 23).",
  },
  net_ciro: {
    ad: "Net Ciro (KDV dahil)", kisa: "Net ciro", ikon: "Receipt", kat: "satis", birim: "TL", iyi: "yukari", src: "cari",
    filter: (ctx) => `h.izahat IN (${ctx.iz("SATIS", "SATIS_IADE")})`, n: () => "SUM(h.borc - h.alacak)",
    aciklama: "Satış − iade (KDV dahil).",
  },
  fatura_sayisi: {
    ad: "Satış Faturası Sayısı", kisa: "Fatura", ikon: "FileText", kat: "satis", birim: "adet", iyi: "yukari", src: "cari",
    filter: (ctx) => `h.izahat IN (${ctx.iz("SATIS")}) AND h.borc > h.alacak`,
    n: () => "COUNT(DISTINCT h.firma || '|' || COALESCE(NULLIF(h.evrak, ''), h.id))", additive: false,
    aciklama: "Dönemde kesilen farklı satış faturası sayısı.",
  },
  ort_fatura: {
    ad: "Ortalama Fatura Tutarı", kisa: "Ort. fatura", ikon: "Calculator", kat: "satis", birim: "TL", iyi: "yukari", src: "cari",
    filter: (ctx) => `h.izahat IN (${ctx.iz("SATIS")}) AND h.borc > h.alacak`,
    n: () => "SUM(h.borc - h.alacak)", d: () => "COUNT(DISTINCT h.firma || '|' || COALESCE(NULLIF(h.evrak, ''), h.id))", calc: div, additive: false,
    aciklama: "Satış tutarı / fatura sayısı (KDV dahil).",
  },
  aktif_musteri: {
    ad: "Aktif Müşteri", kisa: "Müşteri", ikon: "Users", kat: "musteri", birim: "adet", iyi: "yukari", src: "cari",
    filter: (ctx) => `h.izahat IN (${ctx.iz("SATIS")}) AND h.borc > h.alacak`,
    n: () => "COUNT(DISTINCT h.firma || '|' || h.cari_id)", additive: false,
    aciklama: "Dönemde en az bir satış faturası kesilen farklı müşteri sayısı.",
  },
  musteri_basi: {
    ad: "Müşteri Başına Satış", kisa: "Müşteri başı", ikon: "UserCheck", kat: "musteri", birim: "TL", iyi: "yukari", src: "cari",
    filter: (ctx) => `h.izahat IN (${ctx.iz("SATIS")})`,
    n: () => "SUM(h.borc - h.alacak)", d: () => "COUNT(DISTINCT CASE WHEN h.borc > h.alacak THEN h.firma || '|' || h.cari_id END)", calc: div, additive: false,
    aciklama: "Satış / aktif müşteri sayısı.",
  },
  // ── Tahsilat / ödeme / alış (cari) ──
  tahsilat: {
    ad: "Tahsilat", kisa: "Tahsilat", ikon: "HandCoins", kat: "tahsilat", birim: "TL", iyi: "yukari", src: "cari",
    filter: (ctx) => `h.izahat IN (${ctx.iz("TAHSILAT")})`, n: () => "SUM(h.alacak - h.borc)",
    aciklama: "Müşterilerden alınan ödemeler: cari giriş bordrosu (13) + havale (83). Nakit, çek, senet, kart, havale hepsi.",
  },
  tahsilat_bordro: {
    ad: "Bordro Tahsilatı", kisa: "Bordro", ikon: "ClipboardCheck", kat: "tahsilat", birim: "TL", iyi: "yukari", src: "cari",
    filter: () => "h.izahat = 13", n: () => "SUM(h.alacak - h.borc)",
    aciklama: "Cari giriş bordrosuyla alınan tahsilatlar (IZAHAT 13).",
  },
  tahsilat_havale: {
    ad: "Havale Tahsilatı", kisa: "Havale", ikon: "ArrowDownToLine", kat: "tahsilat", birim: "TL", iyi: "yukari", src: "cari",
    filter: () => "h.izahat = 83", n: () => "SUM(h.alacak - h.borc)",
    aciklama: "Bankaya gelen havale/EFT ile kapanan alacaklar (IZAHAT 83).",
  },
  tahsilat_orani: {
    ad: "Tahsilat Oranı", kisa: "Tahsilat %", ikon: "Percent", kat: "tahsilat", birim: "%", iyi: "yukari", src: "cari",
    filter: (ctx) => `h.izahat IN (${ctx.iz("TAHSILAT", "SATIS")})`,
    n: (ctx) => `SUM(CASE WHEN h.izahat IN (${ctx.iz("TAHSILAT")}) THEN h.alacak - h.borc ELSE 0 END)`,
    d: (ctx) => `SUM(CASE WHEN h.izahat IN (${ctx.iz("SATIS")}) THEN h.borc - h.alacak ELSE 0 END)`, calc: pct, additive: false,
    aciklama: "Tahsilat / satış × 100. %100'ün altı alacağın büyüdüğünü gösterir.",
  },
  alis: {
    ad: "Alış (KDV dahil)", kisa: "Alış", ikon: "Truck", kat: "alis", birim: "TL", iyi: "notr", src: "cari", cariAd: "Tedarikçi",
    filter: (ctx) => `h.izahat IN (${ctx.iz("ALIS")})`, n: () => "SUM(h.alacak - h.borc)",
    aciklama: "Alış faturalarının cariye yansıyan genel toplamı (IZAHAT 20, ALACAK). KDV dahildir.",
  },
  tediye: {
    ad: "Ödeme (Tediye)", kisa: "Ödeme", ikon: "Send", kat: "alis", birim: "TL", iyi: "notr", src: "cari", cariAd: "Tedarikçi",
    filter: (ctx) => `h.izahat IN (${ctx.iz("TEDIYE")})`, n: () => "SUM(h.borc - h.alacak)",
    aciklama: "Tedarikçilere yapılan ödemeler: cari çıkış bordrosu (11) + banka ödemesi (84).",
  },
  // ── Satış satırları (KDV hariç, kârlılık) ──
  net_satis: {
    ad: "Net Satış (KDV hariç)", kisa: "Net satış", ikon: "BadgeDollarSign", kat: "karlilik", birim: "TL", iyi: "yukari", src: "satis",
    n: () => `SUM(${sgn("s")} * ${fx("s")} * IFNULL(s.tutar, 0))`,
    aciklama: "Satış faturası satırlarının toplamı (GERCEKTOPLAM). Hizmet/masraf/promosyon satırları ve iptaller hariç.",
  },
  maliyet: {
    ad: "Satılan Malın Maliyeti", kisa: "Maliyet", ikon: "PackageMinus", kat: "karlilik", birim: "TL", iyi: "notr", src: "satis",
    n: () => `SUM(${sgn("s")} * ${fx("s")} * IFNULL(s.miktar, 0) * IFNULL(s.afiyat, 0))`,
    aciklama: "Σ miktar × AFIYATI (satış anındaki birim maliyet).",
  },
  brut_kar: {
    ad: "Brüt Kâr", kisa: "Kâr", ikon: "PiggyBank", kat: "karlilik", birim: "TL", iyi: "yukari", src: "satis",
    n: () => `SUM(${sgn("s")} * ${fx("s")} * (IFNULL(s.tutar, 0) - IFNULL(s.miktar, 0) * IFNULL(s.afiyat, 0) - IFNULL(s.masraf, 0)))`,
    aciklama: "Net satış − maliyet − masraf (Arctos kâr analizi formülü).",
  },
  brut_marj: {
    ad: "Brüt Kâr Marjı", kisa: "Marj", ikon: "Gauge", kat: "karlilik", birim: "%", iyi: "yukari", src: "satis",
    n: () => `SUM(${sgn("s")} * ${fx("s")} * (IFNULL(s.tutar, 0) - IFNULL(s.miktar, 0) * IFNULL(s.afiyat, 0) - IFNULL(s.masraf, 0)))`,
    d: () => `SUM(${sgn("s")} * ${fx("s")} * IFNULL(s.tutar, 0))`, calc: pct, additive: false,
    aciklama: "Brüt kâr / net satış × 100 (satış üzeri marj).",
  },
  kar_orani: {
    ad: "Kâr Oranı (maliyet üzeri)", kisa: "Kâr %", ikon: "TrendingUp", kat: "karlilik", birim: "%", iyi: "yukari", src: "satis",
    n: () => `SUM(${sgn("s")} * ${fx("s")} * (IFNULL(s.tutar, 0) - IFNULL(s.miktar, 0) * IFNULL(s.afiyat, 0) - IFNULL(s.masraf, 0)))`,
    d: () => `SUM(${sgn("s")} * ${fx("s")} * IFNULL(s.miktar, 0) * IFNULL(s.afiyat, 0))`, calc: pct, additive: false,
    aciklama: "Brüt kâr / maliyet × 100 — Arctos'un 'KAR' olarak gösterdiği oran.",
  },
  miktar: {
    ad: "Satış Miktarı", kisa: "Miktar", ikon: "Boxes", kat: "urun", birim: "adet", iyi: "yukari", src: "satis",
    n: () => `SUM(${sgn("s")} * IFNULL(s.miktar, 0))`,
    aciklama: "Satılan toplam miktar (birim karışık olabilir).",
  },
  urun_cesidi: {
    ad: "Satılan Ürün Çeşidi", kisa: "Çeşit", ikon: "LayoutGrid", kat: "urun", birim: "adet", iyi: "yukari", src: "satis",
    n: () => "COUNT(DISTINCT s.firma || '|' || s.stok_id)", additive: false,
    aciklama: "Dönemde satılan farklı ürün sayısı.",
  },
  sepet: {
    ad: "Fatura Başına Kalem", kisa: "Sepet", ikon: "ShoppingBasket", kat: "urun", birim: "adet", iyi: "yukari", src: "satis",
    n: () => "COUNT(*)", d: () => "COUNT(DISTINCT s.firma || '|' || s.fatura_id)", calc: div, additive: false,
    aciklama: "Ortalama fatura satırı sayısı.",
  },
  birim_fiyat: {
    ad: "Ortalama Birim Fiyat", kisa: "Birim fiyat", ikon: "Tag", kat: "urun", birim: "TL", iyi: "notr", src: "satis",
    n: () => `SUM(${sgn("s")} * ${fx("s")} * IFNULL(s.tutar, 0))`, d: () => `SUM(${sgn("s")} * IFNULL(s.miktar, 0))`, calc: div, additive: false,
    aciklama: "Net satış / miktar.",
  },
  // ── Alış satırları ──
  alis_net: {
    ad: "Alış (KDV hariç, satır)", kisa: "Alış net", ikon: "PackagePlus", kat: "alis", birim: "TL", iyi: "notr", src: "alis", cariAd: "Tedarikçi",
    n: () => `SUM(${sgn("a")} * ${fx("a")} * IFNULL(a.tutar, 0))`,
    aciklama: "Alış faturası satırları toplamı (KDV hariç).",
  },
  alis_miktar: {
    ad: "Alış Miktarı", kisa: "Alış mik.", ikon: "Container", kat: "alis", birim: "adet", iyi: "notr", src: "alis", cariAd: "Tedarikçi",
    n: () => `SUM(${sgn("a")} * IFNULL(a.miktar, 0))`,
    aciklama: "Alınan toplam miktar.",
  },
  // ── Kasa (nakit) ──
  kasa_giris: {
    ad: "Kasa Girişi", kisa: "Kasa giriş", ikon: "ArrowDownCircle", kat: "nakit", birim: "TL", iyi: "yukari", src: "kasa",
    n: () => `SUM(IFNULL(k.gelir, 0) / ${kurx("k")})`,
    aciklama: "Kasaya giren fiziksel nakit (ISLEMTIPI=1, açılış devri ve virman hariç).",
  },
  kasa_cikis: {
    ad: "Kasa Çıkışı", kisa: "Kasa çıkış", ikon: "ArrowUpCircle", kat: "nakit", birim: "TL", iyi: "asagi", src: "kasa",
    n: () => `SUM(IFNULL(k.gider, 0) / ${kurx("k")})`,
    aciklama: "Kasadan çıkan fiziksel nakit.",
  },
  kasa_net: {
    ad: "Kasa Net Akışı", kisa: "Kasa net", ikon: "Wallet", kat: "nakit", birim: "TL", iyi: "yukari", src: "kasa",
    n: () => `SUM((IFNULL(k.gelir, 0) - IFNULL(k.gider, 0)) / ${kurx("k")})`,
    aciklama: "Kasa girişi − çıkışı (TL kasalar).",
  },
  // ── Banka ──
  banka_giris: {
    ad: "Banka Girişi", kisa: "Banka giriş", ikon: "Landmark", kat: "banka", birim: "TL", iyi: "yukari", src: "banka",
    n: () => `SUM(IFNULL(b.borc, 0) / ${kurx("b")})`,
    aciklama: "TL banka hesaplarına giren tutar (devir hariç).",
  },
  banka_cikis: {
    ad: "Banka Çıkışı", kisa: "Banka çıkış", ikon: "LogOut", kat: "banka", birim: "TL", iyi: "asagi", src: "banka",
    n: () => `SUM(IFNULL(b.alacak, 0) / ${kurx("b")})`,
    aciklama: "TL banka hesaplarından çıkan tutar.",
  },
  banka_net: {
    ad: "Banka Net Akışı", kisa: "Banka net", ikon: "ArrowLeftRight", kat: "banka", birim: "TL", iyi: "yukari", src: "banka",
    n: () => `SUM((IFNULL(b.borc, 0) - IFNULL(b.alacak, 0)) / ${kurx("b")})`,
    aciklama: "Banka girişi − çıkışı (TL hesaplar, müşteri bankaları hariç).",
  },
  ticari_denge: {
    ad: "Ticari Nakit Dengesi", kisa: "Tahsilat−Ödeme", ikon: "Scale", kat: "tahsilat", birim: "TL", iyi: "yukari", src: "cari",
    filter: (ctx) => `h.izahat IN (${ctx.iz("TAHSILAT", "TEDIYE")})`,
    n: (ctx) => `SUM(CASE WHEN h.izahat IN (${ctx.iz("TAHSILAT")}) THEN h.alacak - h.borc ELSE -(h.borc - h.alacak) END)`,
    aciklama: "Müşteri tahsilatları − tedarikçi ödemeleri. Ticari faaliyetin ürettiği net nakit.",
  },
  kasa_gider_diger: {
    ad: "Kasa Masrafları (cari dışı)", kisa: "Kasa masraf", ikon: "Coins", kat: "nakit", birim: "TL", iyi: "asagi", src: "kasa",
    filter: (ctx) => `IFNULL(k.gider, 0) > 0 AND IFNULL(k.belgeizahat, -1) NOT IN (${ctx.iz("TEDIYE")})`,
    n: () => `SUM(IFNULL(k.gider, 0) / ${kurx("k")})`,
    aciklama: "Kasadan tedarikçi ödemesi dışında çıkan nakit (masraf, maaş, avans vb.).",
  },
  // ── Sipariş ──
  siparis_tutar: {
    ad: "Alınan Sipariş Tutarı", kisa: "Sipariş", ikon: "ClipboardList", kat: "siparis", birim: "TL", iyi: "yukari", src: "siparis",
    n: () => `SUM(${fx("o")} * IFNULL(o.tutar, 0))`,
    aciklama: "Müşterilerden alınan siparişlerin toplamı (iptaller hariç). Ciroya dönüşecek talebin öncü göstergesi.",
  },
  siparis_sayisi: {
    ad: "Sipariş Sayısı", kisa: "Sipariş #", ikon: "ListOrdered", kat: "siparis", birim: "adet", iyi: "yukari", src: "siparis",
    n: () => "COUNT(*)", additive: true,
    aciklama: "Alınan sipariş adedi (iptaller hariç).",
  },
  siparis_ort: {
    ad: "Ortalama Sipariş", kisa: "Ort. sipariş", ikon: "Scale", kat: "siparis", birim: "TL", iyi: "yukari", src: "siparis",
    n: () => `SUM(${fx("o")} * IFNULL(o.tutar, 0))`, d: () => "COUNT(*)", calc: div, additive: false,
    aciklama: "Sipariş tutarı / sipariş sayısı.",
  },
};

// ─── Boyutlar ──────────────────────────────────────────────────────────────
// key: gruplama ifadesi, label: görünen ad ifadesi (yoksa key), map: JS etiket eşlemesi
const DIMENSIONS = {
  cari: {
    ad: "Müşteri", ikon: "User",
    src: {
      cari: { key: "h.firma || ':' || h.cari_id", label: "COALESCE(NULLIF(c.ad, ''), '#' || h.cari_id)" },
      satis: { key: "s.firma || ':' || s.cari_id", label: "COALESCE(NULLIF(c.ad, ''), '#' || s.cari_id)" },
      alis: { key: "a.firma || ':' || a.cari_id", label: "COALESCE(NULLIF(c.ad, ''), '#' || a.cari_id)" },
      siparis: { key: "o.firma || ':' || o.cari_id", label: "COALESCE(NULLIF(c.ad, ''), '#' || o.cari_id)" },
    },
  },
  il: {
    ad: "İl", ikon: "MapPin",
    src: Object.fromEntries(["cari", "satis", "alis", "siparis"].map((s) => [s, { key: "COALESCE(NULLIF(TRIM(c.il), ''), '(Belirsiz)')" }])),
  },
  grup: {
    ad: "Cari Grubu", ikon: "Group",
    src: Object.fromEntries(["cari", "satis", "siparis"].map((s) => [s, { key: "COALESCE(NULLIF(TRIM(c.grup), ''), '(Grupsuz)')" }])),
  },
  temsilci: {
    ad: "Temsilci", ikon: "BadgeCheck",
    src: Object.fromEntries(["cari", "satis", "siparis"].map((s) => [s, { key: "COALESCE(NULLIF(TRIM(c.temsilci), ''), '(Atanmamış)')" }])),
  },
  urun: {
    ad: "Ürün", ikon: "Package",
    src: {
      satis: { key: "s.firma || ':' || s.stok_id", label: "COALESCE(NULLIF(st.ad, ''), '#' || s.stok_id)" },
      alis: { key: "a.firma || ':' || a.stok_id", label: "COALESCE(NULLIF(st.ad, ''), '#' || a.stok_id)" },
    },
  },
  sinif: {
    ad: "Ürün Sınıfı", ikon: "Shapes",
    src: { satis: { key: "COALESCE(NULLIF(TRIM(st.sinif), ''), '(Sınıfsız)')" }, alis: { key: "COALESCE(NULLIF(TRIM(st.sinif), ''), '(Sınıfsız)')" } },
  },
  marka: {
    ad: "Marka", ikon: "Award",
    src: { satis: { key: "COALESCE(NULLIF(TRIM(st.marka), ''), '(Markasız)')" }, alis: { key: "COALESCE(NULLIF(TRIM(st.marka), ''), '(Markasız)')" } },
  },
  tur: {
    ad: "Ürün Türü", ikon: "Layers",
    src: { satis: { key: "COALESCE(NULLIF(TRIM(st.tur), ''), '(Türsüz)')" } },
  },
  satici: {
    ad: "Satış Personeli", ikon: "UserRound",
    src: { satis: { key: "COALESCE(NULLIF(TRIM(s.personel), ''), '(Belirsiz)')" } },
  },
  kasa: { ad: "Kasa", ikon: "Wallet", src: { kasa: { key: "COALESCE(NULLIF(TRIM(k.kasa), ''), '(Tanımsız)')" } } },
  sube: { ad: "Şube", ikon: "Building2", src: { kasa: { key: "COALESCE(NULLIF(TRIM(k.sube), ''), '(Şubesiz)')" } } },
  hesap: {
    ad: "Banka Hesabı", ikon: "Landmark",
    src: { banka: { key: "b.firma || ':' || b.banka_id", label: "COALESCE(NULLIF(ba.ad, ''), '#' || b.banka_id)" } },
  },
  firma: {
    ad: "Firma", ikon: "Building",
    src: Object.fromEntries(Object.entries(SOURCES).map(([s, def]) => [s, { key: `${def.alias}.firma`, map: "firma" }])),
  },
  haftagunu: {
    ad: "Haftanın Günü", ikon: "CalendarDays", sirali: true,
    src: Object.fromEntries(Object.entries(SOURCES).map(([s, def]) => [s, { key: `((CAST(strftime('%w', ${def.alias}.tarih) AS INTEGER) + 6) % 7)`, map: "gun" }])),
  },
  ayadi: {
    ad: "Ay", ikon: "CalendarRange", sirali: true,
    src: Object.fromEntries(Object.entries(SOURCES).map(([s, def]) => [s, { key: `CAST(substr(${def.alias}.tarih, 6, 2) AS INTEGER)`, map: "ay" }])),
  },
  saat: {
    ad: "Saat", ikon: "Clock", sirali: true,
    src: { cari: { key: "h.saat", map: "saat" } },
  },
};

// Bir ölçünün desteklediği boyutlar
function dimsForMeasure(mid) {
  const m = MEASURES[mid];
  if (!m) return [];
  if (m.combo) {
    const lists = m.combo.map(([id]) => dimsForMeasure(id));
    return lists[0].filter((d) => lists.every((l) => l.includes(d)));
  }
  return Object.keys(DIMENSIONS).filter((d) => DIMENSIONS[d].src[m.src]);
}

module.exports = { SOURCES, MEASURES, DIMENSIONS, dimsForMeasure, fx, sgn, kurx, TL_SET };
