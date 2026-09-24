// Test yardımcısı: demo üretecinin ham Arctos tablolarını gerçek SQL Server'a yükler.
// VEGADB'nin tuzaklarını da kurar: Turkish_CI_AS harmanlama, IZAHAT nvarchar(12), BIT alanlar,
// NTEXT açıklama, VARES* nesneleri VIEW, Türkçe dilli (DATEFORMAT dmy) salt-okunur kullanıcı.

const sql = require("mssql");

const BIT = new Set(["IADE", "IPTAL", "DELETED", "MUSBANKA", "VARSAYILAN"]);

function sqlType(table, colName, values) {
  const up = colName.toUpperCase();
  if (up === "IZAHAT" && /TBLCARIHAREKETLERI$/.test(table)) return { t: sql.NVarChar(12), ddl: "NVARCHAR(12)" };
  if (BIT.has(up) || (up === "KDV" && /(SATFAT|ALFAT)BASLIK$/.test(table))) return { t: sql.Bit, ddl: "BIT" };
  if (up === "ACIKLAMA" && /TBLKASA$/.test(table)) return { t: sql.NText, ddl: "NTEXT" };
  const vals = values.filter((v) => v !== null && v !== undefined);
  if (!vals.length) {
    // Boş tablolar: Arctos'taki gerçek tiplere göre ipucu
    if (/^(TARIH|VADE|ODEMETARIHI|ISLEMTARIHI|KESIDETARIHI|SIRALAMATARIHI|CREDATE)$/.test(up)) return { t: sql.DateTime, ddl: "DATETIME" };
    if (/^(IND|FIRMANO|STOKNO|BANKANO|DEPO|STOKTIPI|DETAY|BELGETIPI|BELGEIZAHAT|BELGELINK|ISLEMTIPI|SATIRNO|IZAHAT)$/.test(up) || (up === "EVRAKNO" && !/TBLCARIHAREKETLERI$/.test(table))) return { t: sql.Int, ddl: "INT" };
    if (/^(BORC|ALACAK|GELIR|GIDER|TUTAR|MIKTAR|FIYATI|AFIYATI|GERCEKTOPLAM|MASRAF|KDV|ENVANTER)$/.test(up)) return { t: sql.Decimal(19, 4), ddl: "DECIMAL(19,4)" };
    if (up === "KUR") return { t: sql.Decimal(18, 6), ddl: "DECIMAL(18,6)" };
    return { t: sql.NVarChar(60), ddl: "NVARCHAR(60)" };
  }
  if (vals.every((v) => typeof v === "number")) {
    if (vals.every((v) => Number.isInteger(v) && Math.abs(v) < 2 ** 31)) return { t: sql.Int, ddl: "INT" };
    if (up === "KUR") return { t: sql.Decimal(18, 6), ddl: "DECIMAL(18,6)" };
    return { t: sql.Decimal(19, 4), ddl: "DECIMAL(19,4)" };
  }
  if (vals.every((v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/.test(v))) return { t: sql.DateTime, ddl: "DATETIME" };
  const max = Math.max(...vals.map((v) => String(v).length));
  const n = max <= 12 ? 20 : max <= 60 ? 80 : max <= 250 ? 300 : 4000;
  return { t: sql.NVarChar(n), ddl: `NVARCHAR(${n})` };
}

function toSqlVal(v, ddl) {
  if (v === null || v === undefined) return null;
  if (ddl === "DATETIME") return new Date(String(v).length === 10 ? `${v}T00:00:00Z` : `${String(v).replace(" ", "T")}Z`);
  if (ddl === "BIT") return !!Number(v);
  return v;
}

async function createTable(pool, name, rows, { forceCols = [] } = {}) {
  const cols = [...new Set([...forceCols, ...rows.flatMap((r) => Object.keys(r))])].filter((c) => !c.startsWith("_"));
  if (!cols.length) cols.push("IND");
  const types = cols.map((c) => ({ c, ...sqlType(name, c, rows.map((r) => r[c])) }));
  await pool.request().batch(`CREATE TABLE [${name}] (${types.map((x) => `[${x.c}] ${x.ddl} NULL`).join(", ")})`);
  if (!rows.length) return 0;
  // NTEXT toplu yüklemede desteklenmez → INSERT ile
  if (types.some((x) => x.ddl === "NTEXT")) {
    const alt = types.map((x) => (x.ddl === "NTEXT" ? { ...x, t: sql.NVarChar(4000), ddl2: "NVARCHAR(4000)" } : x));
    const tmp = `${name}__yukle`;
    await pool.request().batch(`CREATE TABLE [${tmp}] (${alt.map((x) => `[${x.c}] ${x.ddl2 || x.ddl} NULL`).join(", ")})`);
    await bulk(pool, tmp, alt, rows);
    await pool.request().batch(`INSERT INTO [${name}] SELECT * FROM [${tmp}]; DROP TABLE [${tmp}]`);
    return rows.length;
  }
  await bulk(pool, name, types, rows);
  return rows.length;
}

async function bulk(pool, name, types, rows) {
  for (let i = 0; i < rows.length; i += 20000) {
    const t = new sql.Table(name);
    t.create = false;
    for (const x of types) t.columns.add(x.c, x.t, { nullable: true });
    for (const r of rows.slice(i, i + 20000)) t.rows.add(...types.map((x) => toSqlVal(r[x.c], x.ddl2 || x.ddl)));
    await pool.request().bulk(t);
  }
}

const DONEM_TABLES = ["TBLCARIHAREKETLERI", "TBLKASA", "TBLTAHSILBASLIK", "TBLBANKAHAREKETLERI", "TBLSATFATBASLIK", "TBLSATFATHAREKET",
  "TBLALFATBASLIK", "TBLALFATHAREKET", "TBLALSIPBASLIK", "TBLWSTAKSITLISATIS", "TBLDEPOENVANTER"];
const VIEWS = ["VARESALINANCEKLER", "VARESVERILENCEKLER", "VARESALINANSENETLER", "VARESVERILENSENETLER"];
// Boş tabloların da doğru kolonlarla oluşması için asgari kolonlar
const MIN_COLS = {
  TBLCARIHAREKETLERI: ["IND", "FIRMANO", "TARIH", "IZAHAT", "EVRAKNO", "BORC", "ALACAK", "KUR", "PARABIRIMI", "ODEMETARIHI", "ISLEMTARIHI", "OZELKOD", "IADE"],
  TBLKASA: ["IND", "TARIH", "GELIR", "GIDER", "KUR", "PARABIRIMI", "ISLEMTIPI", "BELGEIZAHAT", "BELGELINK", "KASAADI", "SUBEADI", "ACIKLAMA"],
  TBLTAHSILBASLIK: ["IND", "BELGETIPI", "OZELKOD3"],
  TBLBANKAHAREKETLERI: ["IND", "BANKANO", "TARIH", "IZAHAT", "BORC", "ALACAK", "KUR", "PARABIRIMI", "ACIKLAMA"],
  TBLSATFATBASLIK: ["IND", "BELGENO", "TARIH", "FIRMANO", "TUTAR", "IPTAL", "IADE"],
  TBLSATFATHAREKET: ["IND", "EVRAKNO", "TARIH", "FIRMANO", "STOKNO", "MIKTAR", "GERCEKTOPLAM", "AFIYATI", "MASRAF", "STOKTIPI", "DETAY", "KDV", "KUR", "PARABIRIMI", "PERSONEL", "DEPO"],
  TBLALFATBASLIK: ["IND", "TARIH", "FIRMANO", "IPTAL", "IADE"],
  TBLALFATHAREKET: ["IND", "EVRAKNO", "TARIH", "FIRMANO", "STOKNO", "MIKTAR", "FIYATI", "GERCEKTOPLAM", "KDV", "KUR", "PARABIRIMI", "STOKTIPI"],
  TBLALSIPBASLIK: ["IND", "TARIH", "FIRMANO", "TUTAR", "IPTAL", "KUR", "PARABIRIMI"],
  TBLWSTAKSITLISATIS: ["IND", "IZAHAT", "TARIH", "TUTAR", "FIRMANO"],
  TBLDEPOENVANTER: ["IND", "TARIH", "STOKNO", "DEPO", "ENVANTER", "BELGETIPI"],
  VARESALINANCEKLER: ["IND", "BELGENO", "TUTAR", "VADE", "TAHSILDURUMU", "FIRMAADI", "FIRMAKODU", "BANKAADI", "PARABIRIMI", "KUR", "KESIDEEDEN", "KESIDETARIHI"],
  VARESVERILENCEKLER: ["IND", "BELGENO", "TUTAR", "VADE", "VCEKISLEM", "FIRMAADI", "FIRMAKODU", "BANKAADI", "PARABIRIMI", "KUR", "KESIDEEDENFIRMAADI", "KESIDETARIHI"],
  VARESALINANSENETLER: ["IND", "BELGENO", "TUTAR", "VADE", "TAHSILDURUMU", "FIRMAADI", "FIRMAKODU", "BANKAADI", "PARABIRIMI", "KUR", "KESIDEEDEN", "TARIH"],
  VARESVERILENSENETLER: ["IND", "BELGENO", "TUTAR", "VADE", "VSENETISLEM", "FIRMAADI", "FIRMAKODU", "BANKAADI", "PARABIRIMI", "KUR", "SENETVRENEFIRMAADI", "TARIH"],
};

async function loadRawToMssql(raw, { server = "127.0.0.1", port = 1433, saPassword, db = "VEGADB", roUser = "vega_okuma", roPassword = "Okuma_2026!" }) {
  const master = await new sql.ConnectionPool({ server, port, user: "sa", password: saPassword, database: "master",
    options: { encrypt: false, trustServerCertificate: true }, requestTimeout: 300000 }).connect();
  await master.request().batch(`IF DB_ID('${db}') IS NOT NULL BEGIN ALTER DATABASE [${db}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${db}]; END`);
  await master.request().batch(`CREATE DATABASE [${db}] COLLATE Turkish_CI_AS`);
  await master.request().batch(`ALTER DATABASE [${db}] SET COMPATIBILITY_LEVEL = 100`); // SQL Server 2008 davranışı
  await master.request().batch(`IF EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'${roUser}') DROP LOGIN [${roUser}]`);
  await master.request().batch(`CREATE LOGIN [${roUser}] WITH PASSWORD = N'${roPassword}', CHECK_POLICY = OFF, DEFAULT_DATABASE = [${db}], DEFAULT_LANGUAGE = [Turkish]`);
  await master.close();

  const pool = await new sql.ConnectionPool({ server, port, user: "sa", password: saPassword, database: db,
    options: { encrypt: false, trustServerCertificate: true }, requestTimeout: 300000 }).connect();
  let total = 0;
  total += await createTable(pool, "TBLFIRMA", raw.TBLFIRMA);
  total += await createTable(pool, "TBLDONEM", raw.TBLDONEM);
  total += await createTable(pool, "TBLCALISMADONEMI", [], { forceCols: ["IND"] });
  for (const [firma, F] of Object.entries(raw.F)) {
    for (const t of ["TBLCARI", "TBLSTOKLAR", "TBLBANKALAR", "TBLBIRIMLEREX"]) total += await createTable(pool, `F${firma}${t}`, F[t] || []);
    for (const [donem, D] of Object.entries(F.D)) {
      for (const t of DONEM_TABLES) total += await createTable(pool, `F${firma}D${donem}${t}`, D[t] || [], { forceCols: MIN_COLS[t] });
      for (const v of VIEWS) {
        const data = `F${firma}D${donem}${v}_VERI`;
        total += await createTable(pool, data, D[v] || [], { forceCols: MIN_COLS[v] });
        await pool.request().batch(`CREATE VIEW [F${firma}D${donem}${v}] AS SELECT * FROM [${data}]`);
      }
    }
  }
  await pool.request().batch(`CREATE USER [${roUser}] FOR LOGIN [${roUser}]; EXEC sp_addrolemember 'db_datareader', '${roUser}';`);
  await pool.close();
  return { rows: total, roUser, roPassword, db };
}

module.exports = { loadRawToMssql };
