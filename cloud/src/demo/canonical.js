// Ham Arctos tablolarını (generator çıktısı) kanonik veri kümelerine çevirir.
// Köprünün SQL sorgularının JS karşılığıdır → uçtan uca testte "beklenen" sonuçtur.

const { DATASETS, chunkKey } = require("../../../shared/datasets");

const pad4 = (n) => String(n).padStart(4, "0");
const trim = (s) => (s === null || s === undefined ? null : String(s).trim());
const nz = (x) => (x === null || x === undefined || x === "" ? null : x);
const num = (x) => (x === null || x === undefined || x === "" ? 0 : Number(x));
const kur = (x) => (Number(x) ? Number(x) : 1);
const day = (s) => (s ? String(s).slice(0, 10) : null);
const hour = (s) => (s && String(s).length >= 13 ? Number(String(s).slice(11, 13)) : null);
function izahat(v) {
  const s = String(v ?? "").trim();
  return /^\d{1,9}$/.test(s) ? Number(s) : -1;
}
function firstOf(obj, names) {
  for (const n of names) if (obj[n] !== undefined) return obj[n];
  return null;
}

function cariAd(c) {
  return nz(trim(c.FIRMAADI)) || nz(trim(c.UNVAN)) || nz(trim(c.FIRMAKODU)) || `#${c.IND}`;
}

function rawToCanonical(raw) {
  const out = new Map(); // key → rows
  const push = (ds, firma, donem, part, row) => {
    const key = chunkKey(ds, firma, donem, part);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(row);
  };
  const monthPart = (t) => (t ? t.slice(0, 7) : "0000-00");
  const bucket = (id, ds) => `b${Math.floor(Number(id) / DATASETS[ds].bucketSize)}`;

  for (const f of raw.TBLFIRMA) push("firma", "", "", "", [pad4(f.IND), f.KISAAD ?? null, f.AD1 ?? null]);
  for (const d of raw.TBLDONEM) push("donem", "", "", "", [pad4(d.FIND), pad4(d.IND), Number(d.DONEM)]);

  for (const [firma, F] of Object.entries(raw.F)) {
    for (const c of F.TBLCARI) {
      if (Number(c.IND) < 100 || Number(c.DELETED || 0) !== 0) continue;
      push("cari", firma, "", bucket(c.IND, "cari"), [
        c.IND, c.FIRMAKODU ?? null, cariAd(c), c.FIRMATIPI ?? null, Number(c.STATUS ?? 1) === 2 ? 0 : 1,
        trim(firstOf(c, ["SEHIR", "IL", "ILADI"])), trim(c.ILCE ?? null), trim(firstOf(c, ["GRUP", "GRUBU", "CARIGRUBU", "CARIGRUP"])),
        trim(firstOf(c, ["CARIKARTPERSONELI", "TEMSILCI", "PERSONEL", "SATISTEMSILCISI"])),
        c.OPSIYON ?? null, c.KREDILIMITI ?? null, c.RISKLIMITI ?? null, c.OZELKOD5 ?? null,
      ]);
    }
    const birim = new Map((F.TBLBIRIMLEREX || []).map((b) => [b.IND, b.BIRIMADI]));
    for (const s of F.TBLSTOKLAR) {
      if (Number(s.DELETED || 0) !== 0) continue;
      push("stok", firma, "", bucket(s.IND, "stok"), [
        s.IND, s.STOKKODU ?? null, s.MALINCINSI ?? null, s.STOKTIPI ?? null, s.KOD1 ?? null, s.KOD2 ?? null, s.KOD7 ?? null,
        trim(s.KOD8 || "") === "PASİF" ? 1 : 0, s.BIRIMEX ? birim.get(s.BIRIMEX) ?? null : null,
        s.MALIYET ?? null, s.ALISFIYATI ?? null, s.KRITIKSEVIYE ?? null,
      ]);
    }
    for (const b of F.TBLBANKALAR) {
      push("banka", firma, "", "", [b.IND, b.ADI ?? null, b.KOD ?? null, nz(b.SUBEADI) ?? b.SUBE ?? null, b.PARABIRIMI ?? null,
        Number(b.MUSBANKA || 0), Number(b.STATUS ?? 1)]);
    }

    for (const [donem, D] of Object.entries(F.D)) {
      for (const h of D.TBLCARIHAREKETLERI || []) {
        const t = day(h.TARIH);
        push("cari_hareket", firma, donem, monthPart(t), [
          h.IND, t, h.FIRMANO, izahat(h.IZAHAT), num(h.BORC), num(h.ALACAK), kur(h.KUR), h.PARABIRIMI ?? null, day(h.ODEMETARIHI),
          h.OZELKOD ?? null, Number(h.IADE || 0), h.EVRAKNO ?? null, hour(h.ISLEMTARIHI),
        ]);
      }
      const tb = new Map((D.TBLTAHSILBASLIK || []).map((x) => [x.IND, x]));
      for (const k of D.TBLKASA || []) {
        const t = day(k.TARIH);
        const link = tb.get(k.BELGELINK);
        const kk = Number(k.BELGEIZAHAT) === 15 && link && Number(link.BELGETIPI) === 15 && trim(link.OZELKOD3 || "") === "KREDIKASA" ? 1 : 0;
        push("kasa_hareket", firma, donem, monthPart(t), [
          k.IND, t, trim(k.KASAADI), trim(k.SUBEADI), num(k.GELIR), num(k.GIDER), kur(k.KUR), k.PARABIRIMI ?? null,
          Number(k.ISLEMTIPI ?? 0), kk, k.BELGEIZAHAT ?? null, k.ACIKLAMA === null || k.ACIKLAMA === undefined ? null : String(k.ACIKLAMA).slice(0, 60),
        ]);
      }
      for (const b of D.TBLBANKAHAREKETLERI || []) {
        const t = day(b.TARIH);
        push("banka_hareket", firma, donem, monthPart(t), [
          b.IND, t, b.BANKANO, izahat(b.IZAHAT), num(b.BORC), num(b.ALACAK), kur(b.KUR), b.PARABIRIMI ?? null,
          b.ACIKLAMA === null || b.ACIKLAMA === undefined ? null : String(b.ACIKLAMA).slice(0, 60),
        ]);
      }
      const sfb = new Map((D.TBLSATFATBASLIK || []).map((x) => [x.IND, x]));
      for (const h of D.TBLSATFATHAREKET || []) {
        const b = sfb.get(h.EVRAKNO) || {};
        const t = day(h.TARIH ?? b.TARIH);
        push("satis", firma, donem, monthPart(t), [
          h.IND, t, h.EVRAKNO, h.FIRMANO ?? b.FIRMANO ?? null, h.STOKNO, num(h.MIKTAR), num(h.GERCEKTOPLAM), num(h.AFIYATI), num(h.MASRAF),
          Number(h.STOKTIPI || 0), Number(h.DETAY || 0), num(h.KDV), kur(h.KUR), h.PARABIRIMI ?? null,
          h.PERSONEL === null || h.PERSONEL === undefined ? null : String(h.PERSONEL), h.DEPO ?? null, Number(b.IPTAL || 0), Number(b.IADE || 0),
        ]);
      }
      const afb = new Map((D.TBLALFATBASLIK || []).map((x) => [x.IND, x]));
      for (const h of D.TBLALFATHAREKET || []) {
        const b = afb.get(h.EVRAKNO) || {};
        const t = day(h.TARIH ?? b.TARIH);
        push("alis", firma, donem, monthPart(t), [
          h.IND, t, h.EVRAKNO, h.FIRMANO ?? b.FIRMANO ?? null, h.STOKNO, num(h.MIKTAR),
          h.GERCEKTOPLAM !== undefined && h.GERCEKTOPLAM !== null ? num(h.GERCEKTOPLAM) : num(h.MIKTAR) * num(h.FIYATI),
          num(h.FIYATI), Number(h.STOKTIPI || 0), num(h.KDV), kur(h.KUR), h.PARABIRIMI ?? null, Number(b.IPTAL || 0), Number(b.IADE || 0),
        ]);
      }
      for (const s of D.TBLALSIPBASLIK || []) {
        const t = day(s.TARIH);
        push("siparis", firma, donem, monthPart(t), [s.IND, t, s.FIRMANO ?? null, num(s.TUTAR), kur(s.KUR), s.PARABIRIMI ?? null, Number(s.IPTAL || 0)]);
      }
      for (const x of D.TBLWSTAKSITLISATIS || []) {
        if (Number(x.IZAHAT) !== 100) continue;
        const t = day(x.TARIH);
        push("taksit", firma, donem, monthPart(t), [x.IND, t, x.FIRMANO ?? null, num(x.TUTAR)]);
      }
      const views = [
        ["VARESALINANCEKLER", "cek", "alinan", "TAHSILDURUMU", "KESIDETARIHI"],
        ["VARESVERILENCEKLER", "cek", "verilen", "VCEKISLEM", "KESIDETARIHI"],
        ["VARESALINANSENETLER", "senet", "alinan", "TAHSILDURUMU", "TARIH"],
        ["VARESVERILENSENETLER", "senet", "verilen", "VSENETISLEM", "TARIH"],
      ];
      let hasCek = false;
      for (const [v, tur, yon, durum, tarih] of views) {
        const rows = D[v];
        if (!rows) continue;
        hasCek = true;
        for (const r of rows) {
          push("cek_senet", firma, donem, "", [
            r.IND ?? null, tur, yon, r.BELGENO ?? null, num(r.TUTAR), day(r.VADE), day(r[tarih]), r[durum] ?? null,
            r.FIRMAADI ?? null, r.FIRMAKODU ?? null, r.BANKAADI ?? null, r.PARABIRIMI ?? null, kur(r.KUR),
          ]);
        }
      }
      if (hasCek && !out.has(chunkKey("cek_senet", firma, donem, ""))) out.set(chunkKey("cek_senet", firma, donem, ""), []);
      const env = new Map();
      for (const e of D.TBLDEPOENVANTER || []) {
        if (Number(e.BELGETIPI || 0) === 67) continue;
        const k = `${e.STOKNO}|${e.DEPO}`;
        env.set(k, (env.get(k) || 0) + num(e.ENVANTER));
      }
      for (const [k, m] of env) {
        if (Math.abs(m) < 1e-9) continue;
        const [stokno, depo] = k.split("|").map(Number);
        push("stok_durum", firma, donem, bucket(stokno, "stok_durum"), [stokno, depo, m]);
      }
    }
  }
  return [...out.entries()].map(([key, rows]) => ({ key, cols: DATASETS[key.split("|")[0]].cols.map((c) => c[0]), rows }));
}

module.exports = { rawToCanonical, izahat, cariAd };
