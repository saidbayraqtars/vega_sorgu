// SQL Server bağlantısı ve şema keşfi (SQL Server 2008+ uyumlu; Kılavuz §4, §31).
// Bu modül YALNIZ SELECT çalıştırır. Önerilen kullanıcı: db_datareader (bridge/sql/salt-okunur-kullanici.sql).

let mssql = null;
function driver() {
  if (!mssql) mssql = require("mssql");
  return mssql;
}

// tedious "(local)", "." gibi takma adları anlamaz (Kılavuz §4.2)
function resolveServer(raw) {
  const text = String(raw || "").trim();
  const [machine, ...rest] = text.split("\\");
  let m = (machine || "").trim();
  if (["", ".", "(local)", "local", "(localhost)"].includes(m.toLowerCase())) m = "localhost";
  return { machine: m, instance: rest.join("\\").trim() };
}

const pad4 = (n) => String(n).padStart(4, "0");

class Sql {
  constructor(cfg) {
    this.cfg = cfg;
    this.pool = null;
    this.colCache = new Map();
  }

  async connect() {
    if (this.pool && this.pool.connected) return this.pool;
    const { machine, instance } = resolveServer(this.cfg.server);
    const inst = this.cfg.instance || instance;
    const config = {
      server: machine, database: this.cfg.database || "VEGADB", user: this.cfg.user, password: this.cfg.password,
      options: { encrypt: !!this.cfg.encrypt, trustServerCertificate: true, enableArithAbort: true, appName: "Vega Kopru", ...(inst ? { instanceName: inst } : {}) },
      connectionTimeout: 20000, requestTimeout: 180000,
      pool: { max: 2, min: 0, idleTimeoutMillis: 60000 },
    };
    if (!inst) config.port = Number(this.cfg.port) || 1433; // adlandırılmış örnekte port verilmez (§4.3)
    this.pool = await new (driver().ConnectionPool)(config).connect();
    if (this.cfg.kirliOkuma) await this.pool.request().batch("SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED");
    return this.pool;
  }

  async close() {
    if (this.pool) { try { await this.pool.close(); } catch { /* yut */ } this.pool = null; }
  }

  // params: { ad: sayı | metin | { tarih: 'YYYY-MM-DD' } }
  // Tarihler DAİMA tipli parametre gider: Türkçe oturumda DATEFORMAT dmy olduğundan
  // 'YYYY-MM-DD' metni DATETIME'a yıl-gün-ay diye çevrilebilir (dil bağımsız değildir).
  async query(sql, params = {}) {
    const pool = await this.connect();
    const req = pool.request();
    for (const [k, v] of Object.entries(params)) {
      if (v && typeof v === "object" && v.tarih) req.input(k, driver().DateTime, new Date(`${v.tarih}T00:00:00Z`));
      else if (typeof v === "number" && Number.isInteger(v)) req.input(k, driver().Int, v);
      else req.input(k, driver().NVarChar, v === null || v === undefined ? null : String(v));
    }
    const r = await req.query(sql);
    return r.recordset || [];
  }

  async info() {
    const r = await this.query(`SELECT CAST(@@VERSION AS NVARCHAR(400)) AS surum, DB_NAME() AS veritabani, CAST(SERVERPROPERTY('MachineName') AS NVARCHAR(200)) AS makine,
      SUSER_SNAME() AS kim, IS_SRVROLEMEMBER('sysadmin') AS sysadmin`);
    const row = r[0] || {};
    return { surum: String(row.surum || "").split("\n")[0].trim(), veritabani: row.veritabani, makine: row.makine, kim: row.kim, sysadmin: !!row.sysadmin };
  }

  // Tablo/görünüm sütunları (büyük harfe normalize); tek sorguda çok tablo
  async columnsFor(names) {
    const todo = names.filter((n) => !this.colCache.has(n));
    if (todo.length) {
      for (let i = 0; i < todo.length; i += 400) {
        const part = todo.slice(i, i + 400);
        const list = part.map((n) => `N'${n.replace(/'/g, "''")}'`).join(",");
        const rows = await this.query(`SELECT o.name AS t, c.name AS c FROM sys.columns c JOIN sys.objects o ON o.object_id = c.object_id
          WHERE o.type IN ('U','V') AND o.name IN (${list})`);
        const map = new Map(part.map((n) => [n, null]));
        for (const r of rows) {
          if (!map.get(r.t)) map.set(r.t, new Set());
          map.get(r.t).add(String(r.c).toUpperCase());
        }
        for (const [n, set] of map) this.colCache.set(n, set); // null = tablo yok
      }
    }
    const out = new Map();
    for (const n of names) out.set(n, this.colCache.get(n));
    return out;
  }

  forgetColumns() { this.colCache.clear(); }
}

// ─── Firma / dönem keşfi (Kılavuz §3) ───────────────────────────────────────
async function discover(sql) {
  const cols = await sql.columnsFor(["TBLFIRMA", "TBLDONEM"]);
  const fc = cols.get("TBLFIRMA");
  if (!fc) throw new Error("TBLFIRMA bulunamadı — bu bir Vega/Arctos veritabanı mı?");
  const pick = (set, list) => list.find((c) => set.has(c));
  const kisa = pick(fc, ["KISAAD", "FIRMAADI", "AD"]) || "IND";
  const unvan = pick(fc, ["AD1", "UNVAN", "FIRMAUNVANI"]);
  const firmalar = (await sql.query(`SELECT IND, ${kisa} AS KISAAD, ${unvan ? unvan : "NULL"} AS AD1 FROM TBLFIRMA ORDER BY IND`))
    .map((f) => ({ ind: f.IND, firma: pad4(f.IND), ad: f.KISAAD === null ? null : String(f.KISAAD), unvan: f.AD1 === null ? null : String(f.AD1) }));
  const donemler = cols.get("TBLDONEM")
    ? (await sql.query("SELECT FIND, IND, DONEM FROM TBLDONEM ORDER BY FIND, IND")).map((d) => ({ firma: pad4(d.FIND), donem: pad4(d.IND), yil: Number(d.DONEM) || null }))
    : [];
  return { firmalar, donemler };
}

module.exports = { Sql, discover, resolveServer, pad4, driver };
