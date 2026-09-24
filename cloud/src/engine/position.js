// ═══════════════════════════════════════════════════════════════════════════
//  Anlık Finansal Durum — operasyonel bilanço (aktif dönem, her firma için).
//   Varlık : kasa (TL) + banka (+) + ticari alacak + portföydeki alınan çek/senet + stok
//   Borç   : ticari borç + ödenecek verilen çek/senet + banka kredisi (eksi bakiyeler)
//  Döviz kasa/hesaplar ayrı tutulur; güncel kur varsa TL karşılığı ayrıca eklenir.
// ═══════════════════════════════════════════════════════════════════════════

const P = require("./period");
const B = require("./balances");
const { TL_SET } = require("./model");

function isOpen(yon, durum) {
  const d = String(durum || "").toLocaleLowerCase("tr-TR").trim();
  if (!d) return true;
  if (yon === "alinan") return d === "tahsilat yok" || d.includes("portföy") || d.includes("portfoy");
  return d.includes("ödenecek") || d.includes("odenecek");
}

function toTL(tutar, pb, kur) {
  const p = String(pb || "").trim().toUpperCase();
  const isTL = !p || ["TL", "TRY", "YTL", "₺"].includes(p);
  return (Number(tutar) || 0) * (isTL ? 1 : (Number(kur) > 0 ? Number(kur) : 1));
}

// Aktif dönemlerdeki çek/senet portföyü (açık olanlar)
function portfolio(ctx) {
  return ctx.cached("portfoy", () => {
    const items = [];
    for (const firma of ctx.firmalar) {
      const donem = ctx.activeDonem(firma);
      if (!donem) continue;
      const rows = ctx.db.all("SELECT * FROM cek_senet WHERE firma = ? AND donem = ?", firma, donem);
      for (const r of rows) {
        items.push({
          firma, tur: r.tur, yon: r.yon, belgeno: r.belgeno, tutar: toTL(r.tutar, r.pb, r.kur), vade: r.vade,
          tarih: r.tarih, durum: r.durum, cari: r.cari, banka: r.banka, acik: isOpen(r.yon, r.durum),
        });
      }
    }
    return items;
  });
}

function portfolioSummary(ctx) {
  const items = portfolio(ctx);
  const today = ctx.today;
  const sum = (f) => items.filter(f).reduce((s, r) => s + r.tutar, 0);
  const count = (f) => items.filter(f).length;
  const open = (tur, yon) => (r) => r.acik && r.tur === tur && r.yon === yon;
  const within = (days) => (r) => r.vade && r.vade >= today && r.vade <= P.addDays(today, days);
  const out = {};
  for (const tur of ["cek", "senet"]) {
    out[tur] = {
      alinan: sum(open(tur, "alinan")), alinanAdet: count(open(tur, "alinan")),
      verilen: sum(open(tur, "verilen")), verilenAdet: count(open(tur, "verilen")),
      alinanVadesiGecmis: sum((r) => open(tur, "alinan")(r) && r.vade && r.vade < today),
      alinanVadesiGecmisAdet: count((r) => open(tur, "alinan")(r) && r.vade && r.vade < today),
      verilenVadesiGecmis: sum((r) => open(tur, "verilen")(r) && r.vade && r.vade < today),
      alinan30: sum((r) => open(tur, "alinan")(r) && within(30)(r)),
      verilen30: sum((r) => open(tur, "verilen")(r) && within(30)(r)),
      verilen7: sum((r) => open(tur, "verilen")(r) && within(7)(r)),
    };
  }
  return out;
}

// Stok değeri: SUM(ENVANTER) (BELGETIPI<>67, köprüde) × TBLSTOKLAR.MALIYET
// Sistem kartları (IND<100), gider/sistem tipleri (3,7,9) ve pasif kartlar hariç (Kılavuz §33.6).
function stockValue(ctx) {
  return ctx.cached("stokDeger", () => {
    let deger = 0, kalem = 0, eksi = 0, maliyetsiz = 0, miktar = 0;
    for (const firma of ctx.firmalar) {
      const donem = ctx.activeDonem(firma);
      if (!donem) continue;
      const r = ctx.db.get(`
        SELECT SUM(CASE WHEN q.m > 0 THEN q.m * IFNULL(st.maliyet, 0) ELSE 0 END) AS deger,
               SUM(CASE WHEN q.m > 0 THEN 1 ELSE 0 END) AS kalem,
               SUM(CASE WHEN q.m < 0 THEN 1 ELSE 0 END) AS eksi,
               SUM(CASE WHEN q.m > 0 AND IFNULL(st.maliyet, 0) <= 0 THEN 1 ELSE 0 END) AS maliyetsiz,
               SUM(CASE WHEN q.m > 0 THEN q.m ELSE 0 END) AS miktar
        FROM (SELECT stok_id, SUM(miktar) AS m FROM stok_durum WHERE firma = ? AND donem = ? GROUP BY stok_id) q
        JOIN stok st ON st.firma = ? AND st.id = q.stok_id
        WHERE st.id >= 100 AND IFNULL(st.tip, 0) NOT IN (3, 7, 9) AND IFNULL(st.pasif, 0) = 0`, firma, donem, firma);
      if (!r) continue;
      deger += Number(r.deger) || 0; kalem += Number(r.kalem) || 0; eksi += Number(r.eksi) || 0;
      maliyetsiz += Number(r.maliyetsiz) || 0; miktar += Number(r.miktar) || 0;
    }
    const hasData = ctx.db.value(`SELECT COUNT(*) FROM stok_durum s WHERE ${ctx.firmaIn("s")}`) > 0;
    return { deger, kalem, eksi, maliyetsiz, miktar, veriVar: hasData };
  });
}

// kurlar: { USD: 41.2, EUR: 48.1, ... } (TCMB döviz satış) — yoksa döviz TL'ye çevrilmez
function position(ctx, { kurlar = ctx.kurlar || null } = {}) {
  return ctx.cached("position", () => {
    const kasa = B.currentKasa(ctx);
    const banka = B.currentBanka(ctx);
    const cari = B.currentCari(ctx);
    const pf = portfolioSummary(ctx);
    const stok = stockValue(ctx);

    const doviz = {};
    for (const [k, v] of Object.entries(kasa.doviz)) doviz[k] = (doviz[k] || 0) + v;
    for (const [k, v] of Object.entries(banka.doviz)) doviz[k] = (doviz[k] || 0) + v;
    let dovizTL = null;
    if (kurlar && Object.keys(doviz).length) {
      dovizTL = 0;
      for (const [k, v] of Object.entries(doviz)) if (kurlar[k]) dovizTL += v * kurlar[k];
    }

    const cekSenetAlinan = pf.cek.alinan + pf.senet.alinan;
    const cekSenetVerilen = pf.cek.verilen + pf.senet.verilen;
    const nakitTL = kasa.tl;
    const bankaVarlik = banka.varlik;
    const bankaKredi = -banka.kredi; // pozitif sayı

    const varliklar = {
      kasa: Math.max(nakitTL, 0),
      banka: bankaVarlik,
      doviz: dovizTL !== null ? Math.max(dovizTL, 0) : 0,
      alacak: cari.alacak,
      cekSenet: cekSenetAlinan,
      stok: stok.deger,
    };
    varliklar.toplam = Object.values(varliklar).reduce((s, v) => s + v, 0);
    const yukumlulukler = {
      borc: cari.borc,
      cekSenet: cekSenetVerilen,
      kredi: bankaKredi,
      kasaAcik: Math.max(-nakitTL, 0),
    };
    yukumlulukler.toplam = Object.values(yukumlulukler).reduce((s, v) => s + v, 0);

    const likit = varliklar.kasa + varliklar.banka + varliklar.doviz;
    const hizli = likit + varliklar.alacak + varliklar.cekSenet;
    const kv = yukumlulukler.toplam;
    return {
      tarih: ctx.today,
      kasa, banka, cari: { alacak: cari.alacak, borc: cari.borc, net: cari.net, musteri: cari.list.filter((c) => c.bakiye > 0).length, tedarikci: cari.list.filter((c) => c.bakiye < 0).length },
      portfoy: pf, stok, doviz, dovizTL, kurlar,
      varliklar, yukumlulukler,
      netIsletmeSermayesi: varliklar.toplam - yukumlulukler.toplam,
      likit, netNakit: nakitTL + banka.tl,
      oranlar: {
        cari: kv > 0 ? varliklar.toplam / kv : null,
        asitTest: kv > 0 ? hizli / kv : null,
        nakit: kv > 0 ? likit / kv : null,
      },
    };
  });
}

module.exports = { position, portfolio, portfolioSummary, stockValue, isOpen, toTL, TL_SET };
