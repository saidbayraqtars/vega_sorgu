// ═══════════════════════════════════════════════════════════════════════════
//  Veri çekme planı: VEGADB tablolarından kanonik veri kümelerine (shared/datasets.js)
//  YALNIZ SELECT. Her sorgu SQL Server 2008 uyumlu (OFFSET/IIF/TRY_CAST/CONCAT yok).
//  Kolonlar önce keşfedilir; kurulumda olmayan kolon NULL olarak gelir (Kılavuz §6.6, §44).
//  Formüller ve filtreler: Vega Kılavuzu KISIM V (Arctos'tan canlı yakalanmış sorgular).
// ═══════════════════════════════════════════════════════════════════════════

const { DATASETS, chunkKey, monthRange } = require("../../shared/datasets");

const T = (name) => `[${name}]`;

// Kolon yardımcıları — set: tablonun kolonları (büyük harf)
function has(set, c) { return !!set && set.has(c); }
function col(a, set, c, fb = "NULL") { return has(set, c) ? `${a}.[${c}]` : fb; }
function firstCol(a, set, list, fb = "NULL") { const c = list.find((x) => has(set, x)); return c ? `${a}.[${c}]` : fb; }
const d10 = (e) => (e === "NULL" ? "NULL" : `CONVERT(char(10), ${e}, 120)`);
const txt = (e, n) => (e === "NULL" ? "NULL" : `CAST(${e} AS NVARCHAR(${n}))`);
const trim = (e, n) => (e === "NULL" ? "NULL" : `LTRIM(RTRIM(CAST(${e} AS NVARCHAR(${n}))))`);
const num = (e) => (e === "NULL" ? "0" : `ISNULL(${e}, 0)`);
const int0 = (e) => (e === "NULL" ? "0" : `CAST(ISNULL(${e}, 0) AS INT)`);
const kur = (e) => (e === "NULL" ? "1" : `ISNULL(NULLIF(${e}, 0), 1)`);
// IZAHAT nvarchar(12) → int (sayı değilse -1) (Kılavuz Kural 7)
const izahat = (e) => {
  if (e === "NULL") return "-1";
  const s = `LTRIM(RTRIM(CAST(${e} AS NVARCHAR(20))))`;
  return `CASE WHEN ${s} NOT LIKE '%[^0-9]%' AND LEN(${s}) BETWEEN 1 AND 9 THEN CAST(${s} AS INT) ELSE -1 END`;
};
const notDeleted = (a, set) => (has(set, "DELETED") ? `ISNULL(${a}.[DELETED], 0) = 0` : "1=1");

// ─── Kaynak tanımları ─────────────────────────────────────────────────────
// Her fonksiyon: (firma, donem, cols: Map<tablo, Set|null>) → plan | null
const F = (f, s) => `F${f}${s}`;
const FD = (f, d, s) => `F${f}D${d}${s}`;

const PLANS = {
  cari(f, d, C) {
    const t = F(f, "TBLCARI"), s = C.get(t);
    if (!s) return null;
    const nm = (x) => (has(s, x) ? `NULLIF(LTRIM(RTRIM(CAST(C.[${x}] AS NVARCHAR(250)))), N'')` : null);
    const ad = `COALESCE(${[nm("FIRMAADI"), nm("UNVAN"), nm("FIRMAKODU")].filter(Boolean).join(", ")}${[nm("FIRMAADI"), nm("UNVAN"), nm("FIRMAKODU")].some(Boolean) ? ", " : ""}N'#' + CAST(C.IND AS NVARCHAR(20)))`;
    return {
      from: `${T(t)} C`, where: `C.IND >= 100 AND ${notDeleted("C", s)}`, id: "C.IND",
      exprs: [
        "C.IND", txt(col("C", s, "FIRMAKODU"), 60), ad, col("C", s, "FIRMATIPI"),
        has(s, "STATUS") ? "CASE WHEN ISNULL(C.[STATUS], 1) = 2 THEN 0 ELSE 1 END" : "1",
        trim(firstCol("C", s, ["SEHIR", "IL", "ILADI"]), 60), trim(col("C", s, "ILCE"), 60),
        trim(firstCol("C", s, ["GRUP", "GRUBU", "CARIGRUBU", "CARIGRUP"]), 60),
        trim(firstCol("C", s, ["CARIKARTPERSONELI", "TEMSILCI", "PERSONEL", "SATISTEMSILCISI"]), 60),
        col("C", s, "OPSIYON"), col("C", s, "KREDILIMITI"), col("C", s, "RISKLIMITI"), txt(col("C", s, "OZELKOD5"), 60),
      ],
      amount: "0",
    };
  },
  stok(f, d, C) {
    const t = F(f, "TBLSTOKLAR"), s = C.get(t);
    if (!s) return null;
    const bt = F(f, "TBLBIRIMLEREX"), bs = C.get(bt);
    let join = "", birim = "NULL";
    if (bs && has(bs, "BIRIMADI")) {
      if (has(s, "BIRIMEX") && has(bs, "IND")) { join = ` LEFT JOIN ${T(bt)} B ON B.IND = S.BIRIMEX`; birim = "B.BIRIMADI"; }
      else if (has(bs, "STOKNO") && has(bs, "VARSAYILAN")) { join = ` OUTER APPLY (SELECT TOP 1 BIRIMADI FROM ${T(bt)} WHERE STOKNO = S.IND AND VARSAYILAN = 1 ORDER BY IND) B`; birim = "B.BIRIMADI"; }
    }
    return {
      from: `${T(t)} S${join}`, where: notDeleted("S", s), id: "S.IND",
      exprs: [
        "S.IND", txt(col("S", s, "STOKKODU"), 60), txt(col("S", s, "MALINCINSI"), 250), col("S", s, "STOKTIPI"),
        txt(col("S", s, "KOD1"), 60), txt(col("S", s, "KOD2"), 60), txt(col("S", s, "KOD7"), 60),
        has(s, "KOD8") ? "CASE WHEN LTRIM(RTRIM(ISNULL(CAST(S.[KOD8] AS NVARCHAR(60)), N''))) = N'PASİF' THEN 1 ELSE 0 END" : "0",
        txt(birim, 30), col("S", s, "MALIYET"), col("S", s, "ALISFIYATI"), col("S", s, "KRITIKSEVIYE"),
      ],
      amount: "0",
    };
  },
  banka(f, d, C) {
    const t = F(f, "TBLBANKALAR"), s = C.get(t);
    if (!s) return null;
    const sube = has(s, "SUBEADI") ? `COALESCE(NULLIF(CAST(K.[SUBEADI] AS NVARCHAR(60)), N''), ${txt(col("K", s, "SUBE"), 60)})` : txt(col("K", s, "SUBE"), 60);
    return {
      from: `${T(t)} K`, where: "1=1",
      exprs: ["K.IND", txt(col("K", s, "ADI"), 120), txt(col("K", s, "KOD"), 60), sube, txt(col("K", s, "PARABIRIMI"), 10), int0(col("K", s, "MUSBANKA")),
        has(s, "STATUS") ? "CAST(ISNULL(K.[STATUS], 1) AS INT)" : "1"],
      amount: "0",
    };
  },
  cari_hareket(f, d, C) {
    const t = FD(f, d, "TBLCARIHAREKETLERI"), s = C.get(t);
    if (!s) return null;
    return {
      from: `${T(t)} H`, where: "1=1", date: "H.TARIH",
      exprs: ["H.IND", d10("H.TARIH"), col("H", s, "FIRMANO"), izahat(col("H", s, "IZAHAT")), num(col("H", s, "BORC")), num(col("H", s, "ALACAK")),
        kur(col("H", s, "KUR")), txt(col("H", s, "PARABIRIMI"), 10), d10(col("H", s, "ODEMETARIHI")), txt(col("H", s, "OZELKOD"), 60),
        int0(col("H", s, "IADE")), txt(col("H", s, "EVRAKNO"), 60), has(s, "ISLEMTARIHI") ? "DATEPART(hour, H.[ISLEMTARIHI])" : "NULL"],
      amount: `${num(col("H", s, "BORC"))} + ${num(col("H", s, "ALACAK"))}`,
    };
  },
  kasa_hareket(f, d, C) {
    const t = FD(f, d, "TBLKASA"), s = C.get(t);
    if (!s) return null;
    const tb = FD(f, d, "TBLTAHSILBASLIK"), tbs = C.get(tb);
    const canKK = tbs && has(tbs, "OZELKOD3") && has(tbs, "IND") && has(s, "BELGELINK") && has(s, "BELGEIZAHAT");
    // Kılavuz §24.1: BELGEIZAHAT=15 ve bağlı tahsilat başlığında OZELKOD3='KREDIKASA' → nakit değil
    const join = canKK ? ` LEFT JOIN ${T(tb)} TB ON TB.IND = K.BELGELINK${has(tbs, "BELGETIPI") ? " AND TB.BELGETIPI = K.BELGEIZAHAT" : ""}` : "";
    return {
      from: `${T(t)} K${join}`, where: "1=1", date: "K.TARIH",
      exprs: ["K.IND", d10("K.TARIH"), trim(col("K", s, "KASAADI"), 60), trim(col("K", s, "SUBEADI"), 60), num(col("K", s, "GELIR")), num(col("K", s, "GIDER")),
        kur(col("K", s, "KUR")), txt(col("K", s, "PARABIRIMI"), 10), int0(col("K", s, "ISLEMTIPI")),
        canKK ? "CASE WHEN K.BELGEIZAHAT = 15 AND ISNULL(CAST(TB.OZELKOD3 AS NVARCHAR(60)), N'') = N'KREDIKASA' THEN 1 ELSE 0 END" : "0",
        col("K", s, "BELGEIZAHAT"), has(s, "ACIKLAMA") ? "LEFT(CAST(K.[ACIKLAMA] AS NVARCHAR(200)), 60)" : "NULL"],
      amount: `${num(col("K", s, "GELIR"))} + ${num(col("K", s, "GIDER"))}`,
    };
  },
  banka_hareket(f, d, C) {
    const t = FD(f, d, "TBLBANKAHAREKETLERI"), s = C.get(t);
    if (!s) return null;
    return {
      from: `${T(t)} BH`, where: "1=1", date: "BH.TARIH",
      exprs: ["BH.IND", d10("BH.TARIH"), col("BH", s, "BANKANO"), izahat(col("BH", s, "IZAHAT")), num(col("BH", s, "BORC")), num(col("BH", s, "ALACAK")),
        kur(col("BH", s, "KUR")), txt(col("BH", s, "PARABIRIMI"), 10), has(s, "ACIKLAMA") ? "LEFT(CAST(BH.[ACIKLAMA] AS NVARCHAR(200)), 60)" : "NULL"],
      amount: `${num(col("BH", s, "BORC"))} + ${num(col("BH", s, "ALACAK"))}`,
    };
  },
  satis(f, d, C) {
    const t = FD(f, d, "TBLSATFATHAREKET"), s = C.get(t);
    if (!s) return null;
    const bt = FD(f, d, "TBLSATFATBASLIK"), bs = C.get(bt);
    const join = bs ? ` LEFT JOIN ${T(bt)} B ON B.IND = H.EVRAKNO` : "";
    const b = (c) => (bs && has(bs, c) ? `B.[${c}]` : "NULL");
    const date = has(s, "TARIH") ? (bs && has(bs, "TARIH") ? "ISNULL(H.TARIH, B.TARIH)" : "H.TARIH") : b("TARIH");
    const cari = has(s, "FIRMANO") ? (b("FIRMANO") !== "NULL" ? "ISNULL(H.FIRMANO, B.FIRMANO)" : "H.FIRMANO") : b("FIRMANO");
    return {
      from: `${T(t)} H${join}`, where: "1=1", date,
      exprs: ["H.IND", d10(date), col("H", s, "EVRAKNO"), cari, col("H", s, "STOKNO"), num(col("H", s, "MIKTAR")), num(col("H", s, "GERCEKTOPLAM")),
        num(col("H", s, "AFIYATI")), num(col("H", s, "MASRAF")), int0(col("H", s, "STOKTIPI")), int0(col("H", s, "DETAY")), num(col("H", s, "KDV")),
        kur(col("H", s, "KUR")), txt(col("H", s, "PARABIRIMI"), 10), txt(col("H", s, "PERSONEL"), 60), col("H", s, "DEPO"), int0(b("IPTAL")), int0(b("IADE"))],
      amount: num(col("H", s, "GERCEKTOPLAM")),
    };
  },
  alis(f, d, C) {
    const t = FD(f, d, "TBLALFATHAREKET"), s = C.get(t);
    if (!s) return null;
    const bt = FD(f, d, "TBLALFATBASLIK"), bs = C.get(bt);
    const join = bs ? ` LEFT JOIN ${T(bt)} B ON B.IND = H.EVRAKNO` : "";
    const b = (c) => (bs && has(bs, c) ? `B.[${c}]` : "NULL");
    const date = has(s, "TARIH") ? (bs && has(bs, "TARIH") ? "ISNULL(H.TARIH, B.TARIH)" : "H.TARIH") : b("TARIH");
    const cari = has(s, "FIRMANO") ? (b("FIRMANO") !== "NULL" ? "ISNULL(H.FIRMANO, B.FIRMANO)" : "H.FIRMANO") : b("FIRMANO");
    const tutar = has(s, "GERCEKTOPLAM") ? `ISNULL(H.GERCEKTOPLAM, ${num(col("H", s, "MIKTAR"))} * ${num(col("H", s, "FIYATI"))})` : `${num(col("H", s, "MIKTAR"))} * ${num(col("H", s, "FIYATI"))}`;
    return {
      from: `${T(t)} H${join}`, where: "1=1", date,
      exprs: ["H.IND", d10(date), col("H", s, "EVRAKNO"), cari, col("H", s, "STOKNO"), num(col("H", s, "MIKTAR")), tutar, num(col("H", s, "FIYATI")),
        int0(col("H", s, "STOKTIPI")), num(col("H", s, "KDV")), kur(col("H", s, "KUR")), txt(col("H", s, "PARABIRIMI"), 10), int0(b("IPTAL")), int0(b("IADE"))],
      amount: tutar,
    };
  },
  siparis(f, d, C) {
    const t = FD(f, d, "TBLALSIPBASLIK"), s = C.get(t);
    if (!s) return null;
    return {
      from: `${T(t)} O`, where: "1=1", date: "O.TARIH",
      exprs: ["O.IND", d10("O.TARIH"), col("O", s, "FIRMANO"), num(col("O", s, "TUTAR")), kur(col("O", s, "KUR")), txt(col("O", s, "PARABIRIMI"), 10), int0(col("O", s, "IPTAL"))],
      amount: num(col("O", s, "TUTAR")),
    };
  },
  taksit(f, d, C) {
    const t = FD(f, d, "TBLWSTAKSITLISATIS"), s = C.get(t);
    if (!s || !has(s, "TARIH")) return null;
    return {
      from: `${T(t)} X`, where: has(s, "IZAHAT") ? `${izahat("X.IZAHAT")} = 100` : "1=1", date: "X.TARIH",
      exprs: ["X.IND", d10("X.TARIH"), col("X", s, "FIRMANO"), num(col("X", s, "TUTAR"))],
      amount: num(col("X", s, "TUTAR")),
    };
  },
  // Çek/senet: 4 VARES görünümünün birleşimi (Kılavuz §18.2) — tek parça
  cek_senet(f, d, C) {
    const views = [
      ["VARESALINANCEKLER", "cek", "alinan", ["TAHSILDURUMU", "DURUM"], ["KESIDETARIHI", "TARIH"]],
      ["VARESVERILENCEKLER", "cek", "verilen", ["VCEKISLEM", "DURUM"], ["KESIDETARIHI", "TARIH"]],
      ["VARESALINANSENETLER", "senet", "alinan", ["TAHSILDURUMU", "DURUM"], ["TARIH", "KESIDETARIHI"]],
      ["VARESVERILENSENETLER", "senet", "verilen", ["VSENETISLEM", "DURUM"], ["TARIH", "KESIDETARIHI"]],
    ];
    const parts = [];
    for (const [v, tur, yon, durum, tarih] of views) {
      const name = FD(f, d, v), s = C.get(name);
      if (!s || !has(s, "TUTAR")) continue;
      parts.push({
        from: `${T(name)} V`,
        exprs: [col("V", s, "IND"), `N'${tur}'`, `N'${yon}'`, txt(col("V", s, "BELGENO"), 60), num("V.TUTAR"), d10(col("V", s, "VADE")), d10(firstCol("V", s, tarih)),
          txt(firstCol("V", s, durum), 60), txt(col("V", s, "FIRMAADI"), 250), txt(col("V", s, "FIRMAKODU"), 60), txt(col("V", s, "BANKAADI"), 120),
          txt(col("V", s, "PARABIRIMI"), 10), kur(col("V", s, "KUR"))],
        amount: num("V.TUTAR"),
      });
    }
    if (!parts.length) return null;
    return { union: parts };
  },
  // Depo envanteri: SUM(ENVANTER), rezerv (67) hariç (Kılavuz §15.1, §27.1)
  stok_durum(f, d, C) {
    const t = FD(f, d, "TBLDEPOENVANTER"), s = C.get(t);
    if (!s || !has(s, "STOKNO") || !has(s, "ENVANTER")) return null;
    const depo = has(s, "DEPO") ? "E.DEPO" : "0";
    const bt = has(s, "BELGETIPI") ? "ISNULL(E.BELGETIPI, 0) <> 67" : "1=1";
    return {
      grouped: { stok: "E.STOKNO", depo, sum: "SUM(E.ENVANTER)", from: `${T(t)} E`, where: bt, groupBy: `E.STOKNO, ${depo}` },
      id: "E.STOKNO",
    };
  },
};

// Keşfedilecek tablo adları
function candidateTables(firmalar, donemler) {
  const names = new Set();
  for (const f of firmalar) for (const s of ["TBLCARI", "TBLSTOKLAR", "TBLBANKALAR", "TBLBIRIMLEREX"]) names.add(F(f, s));
  for (const { firma, donem } of donemler) {
    for (const s of ["TBLCARIHAREKETLERI", "TBLKASA", "TBLTAHSILBASLIK", "TBLBANKAHAREKETLERI", "TBLSATFATHAREKET", "TBLSATFATBASLIK", "TBLALFATHAREKET",
      "TBLALFATBASLIK", "TBLALSIPBASLIK", "TBLWSTAKSITLISATIS", "TBLDEPOENVANTER", "VARESALINANCEKLER", "VARESVERILENCEKLER", "VARESALINANSENETLER", "VARESVERILENSENETLER"]) {
      names.add(FD(firma, donem, s));
    }
  }
  return [...names];
}

// ─── Manifest (parmak izi) SQL'i ──────────────────────────────────────────
function manifestSql(ds, plan) {
  const def = DATASETS[ds];
  if (plan.union) {
    const inner = plan.union.map((p) => `SELECT BINARY_CHECKSUM(${p.exprs.join(", ")}) AS cs, ${p.amount} AS am FROM ${p.from}`).join(" UNION ALL ");
    return `SELECT '' AS p, COUNT(*) AS n, CHECKSUM_AGG(x.cs) AS ck, SUM(CAST(x.am AS DECIMAL(38,4))) AS sm FROM (${inner}) x`;
  }
  if (plan.grouped) {
    const g = plan.grouped;
    return `SELECT 'b' + CAST(x.stok / ${def.bucketSize} AS VARCHAR(12)) AS p, COUNT(*) AS n, CHECKSUM_AGG(BINARY_CHECKSUM(x.stok, x.depo, x.m)) AS ck,
      SUM(CAST(x.m AS DECIMAL(38,4))) AS sm
      FROM (SELECT ${g.stok} AS stok, ${g.depo} AS depo, ${g.sum} AS m FROM ${g.from} WHERE ${g.where} GROUP BY ${g.groupBy} HAVING ${g.sum} <> 0) x
      GROUP BY x.stok / ${def.bucketSize}`;
  }
  const part = def.partition === "month" ? `CONVERT(char(7), ${plan.date}, 120)`
    : def.partition === "bucket" ? `'b' + CAST(${plan.id} / ${def.bucketSize} AS VARCHAR(12))` : "''";
  return `SELECT x.p, COUNT(*) AS n, CHECKSUM_AGG(x.cs) AS ck, SUM(CAST(x.am AS DECIMAL(38,4))) AS sm FROM (
    SELECT ${part} AS p, BINARY_CHECKSUM(${plan.exprs.join(", ")}) AS cs, ${plan.amount} AS am FROM ${plan.from} WHERE ${plan.where}) x GROUP BY x.p`;
}

// ─── Parça satırları SQL'i ────────────────────────────────────────────────
function fetchSql(ds, plan, part) {
  const def = DATASETS[ds];
  const params = {};
  if (plan.union) {
    return { sql: plan.union.map((p) => `SELECT ${aliased(p.exprs)} FROM ${p.from}`).join(" UNION ALL "), params, width: plan.union[0].exprs.length };
  }
  if (plan.grouped) {
    const g = plan.grouped;
    const b = Number(String(part).slice(1));
    params.lo = b * def.bucketSize; params.hi = (b + 1) * def.bucketSize;
    return { sql: `SELECT ${g.stok} AS c0, ${g.depo} AS c1, ${g.sum} AS c2 FROM ${g.from}
      WHERE ${g.where} AND ${g.stok} >= @lo AND ${g.stok} < @hi GROUP BY ${g.groupBy} HAVING ${g.sum} <> 0`, params, width: 3 };
  }
  let cond = "";
  if (def.partition === "month") {
    const r = monthRange(part);
    if (r) { cond = ` AND ${plan.date} >= @s AND ${plan.date} < @e`; params.s = { tarih: r[0] }; params.e = { tarih: r[1] }; }
    else cond = ` AND ${plan.date} IS NULL`;
  } else if (def.partition === "bucket") {
    const b = Number(String(part).slice(1));
    cond = ` AND ${plan.id} >= @lo AND ${plan.id} < @hi`;
    params.lo = b * def.bucketSize; params.hi = (b + 1) * def.bucketSize;
  }
  return { sql: `SELECT ${aliased(plan.exprs)} FROM ${plan.from} WHERE ${plan.where}${cond}`, params, width: plan.exprs.length };
}

// Her ifadeye konumsal ad (c0, c1…): mssql adsız/tekrarlı kolonları diziye çevirdiği için şart
function aliased(exprs) { return exprs.map((e, i) => `${e} AS c${i}`).join(", "); }

// recordset satırlarını dizi satırlara çevir (c0..cN konumsal adlar)
function rowsToArrays(recordset, width) {
  return recordset.map((r) => {
    const out = new Array(width);
    for (let i = 0; i < width; i++) out[i] = norm(r[`c${i}`]);
    return out;
  });
}
function norm(v) {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.replace(/\s+$/, "") === v ? v : v.replace(/\s+$/, ""); // char(n) dolgusunu at
  return v;
}

module.exports = { PLANS, candidateTables, manifestSql, fetchSql, rowsToArrays, izahat, chunkKey };
