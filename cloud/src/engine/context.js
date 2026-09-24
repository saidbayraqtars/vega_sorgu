// İstek bağlamı: kiracı deposu + ayarlar + seçili firmalar + "bugün".
// SQL'e gömülen her değer (firma kodu, izahat kodu) burada beyaz listeden geçer.

const { resolveSettings } = require("./settings");
const { todayTR } = require("./period");

class Context {
  constructor(store, rawSettings = {}, { firmalar = null, today = null } = {}) {
    this.store = store;
    this.db = store.db;
    this.s = resolveSettings(rawSettings);
    this.today = today || todayTR();
    this.memo = new Map();
    const all = this.allFirmalar();
    let sel = all;
    const allowed = this.s.firmalar ? all.filter((f) => this.s.firmalar.includes(f.firma)) : all;
    sel = allowed;
    if (firmalar && firmalar.length) {
      const want = new Set(firmalar.filter((f) => /^\d{4}$/.test(f)));
      sel = allowed.filter((f) => want.has(f.firma));
    }
    this.firmaList = sel;
    this.firmalar = sel.map((f) => f.firma);
  }

  // Aynı istek içinde tekrar eden hesaplar için önbellek
  cached(key, fn) {
    if (this.memo.has(key)) return this.memo.get(key);
    const v = fn();
    this.memo.set(key, v);
    return v;
  }

  allFirmalar() {
    const rows = this.db.all("SELECT firma, ad, unvan FROM firma ORDER BY firma");
    if (rows.length) return rows.filter((r) => /^\d{4}$/.test(r.firma));
    // firma listesi gelmemişse hareketlerden çıkar
    return this.db.all("SELECT DISTINCT firma, firma AS ad, NULL AS unvan FROM cari_hareket WHERE firma IS NOT NULL ORDER BY firma")
      .filter((r) => /^\d{4}$/.test(r.firma));
  }

  firmaAd(kod) {
    const f = this.firmaList.find((x) => x.firma === kod) || this.allFirmalar().find((x) => x.firma === kod);
    return f ? (f.ad || f.unvan || kod) : kod;
  }

  firmaIn(alias) {
    if (!this.firmalar.length) return "0";
    return `${alias}.firma IN (${this.firmalar.map((f) => `'${f}'`).join(",")})`;
  }

  // İzahat kategorisinin SQL listesi (boşsa hiçbir satırla eşleşmeyen NULL)
  iz(...cats) {
    const codes = new Set();
    for (const c of cats) for (const x of this.s.izahat[c] || []) codes.add(Number(x));
    const list = [...codes].filter(Number.isInteger);
    return list.length ? list.join(",") : "NULL";
  }

  personel(c) {
    const tips = this.s.personelTipleri.filter(Number.isInteger);
    const tipSql = tips.length ? ` OR IFNULL(${c}.tip, -1) IN (${tips.join(",")})` : "";
    return `(IFNULL(${c}.ozelkod5, '') = 'PERSONELCARI'${tipSql})`;
  }

  // Firma başına dönem listesi (yıla göre sıralı)
  donemler(firma) {
    return this.cached(`donemler:${firma}`, () => {
      const rows = this.db.all("SELECT donem, yil FROM donem WHERE firma = ? ORDER BY yil, donem", firma);
      if (rows.length) return rows;
      // dönem listesi yoksa hareket tablolarından türet (yıl = en sık görülen yıl)
      return this.db.all(`SELECT donem, CAST(substr(MAX(tarih), 1, 4) AS INTEGER) AS yil FROM cari_hareket
        WHERE firma = ? GROUP BY donem ORDER BY yil`, firma);
    });
  }

  // "Bugün"ü kapsayan aktif dönem: başlangıcı (yıl-1)-12-25 ≤ bugün olan en büyük yıl.
  activeDonem(firma) {
    return this.cached(`aktif:${firma}`, () => {
      const list = this.donemler(firma);
      if (!list.length) return null;
      let best = null;
      for (const d of list) {
        const start = `${Number(d.yil) - 1}-12-25`;
        if (start <= this.today && (!best || Number(d.yil) > Number(best.yil))) best = d;
      }
      return (best || list[list.length - 1]).donem;
    });
  }

  // En eski hareket tarihi (seçili firmalar) — "tüm zamanlar" dönemi ve veri kapsamı için
  firstDate() {
    return this.cached("firstDate", () => {
      const r = this.db.get(`SELECT MIN(tarih) AS t FROM cari_hareket h WHERE ${this.firmaIn("h")} AND tarih >= '1990-01-01'
        AND h.izahat NOT IN (${this.iz("DEVIR")})`);
      return r && r.t ? r.t : null;
    });
  }

  lastDate() {
    return this.cached("lastDate", () => {
      const r = this.db.get(`SELECT MAX(tarih) AS t FROM cari_hareket h WHERE ${this.firmaIn("h")} AND tarih <= ?`, this.today);
      return r && r.t ? r.t : null;
    });
  }
}

module.exports = { Context };
