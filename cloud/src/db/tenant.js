// Kiracı (müşteri firma grubu) veritabanı: köprüden gelen kanonik satırlar +
// chunk durumu + meta + önbelleklenmiş anlık görüntüler. Her kiracı ayrı SQLite
// dosyasıdır → kiracılar arası veri sızıntısı yapısal olarak imkânsız.

const { Db } = require("./sqlite");
const { DATASETS, DATASET_NAMES, parseChunkKey, scopeKey, validateDatasetRow } = require("../../../shared/datasets");
const { detectDoviz } = require("../../../shared/doviz");

const SQL_TYPE = { i: "INTEGER", r: "REAL", t: "TEXT", d: "TEXT" };

// Veri kümesi başına ekstra (ingest anında türetilen) kolonlar
const ENRICH = {
  kasa_hareket: [["dv", "t"], ["devir", "i"]],
  banka_hareket: [["devir", "i"]],
  banka: [["dv", "t"]],
};

const INDEXES = {
  cari: ["firma, id"],
  stok: ["firma, id"],
  banka: ["firma, id"],
  cari_hareket: ["firma, tarih", "firma, cari_id, tarih", "firma, izahat, tarih", "firma, donem"],
  kasa_hareket: ["firma, donem, tarih", "firma, tarih"],
  banka_hareket: ["firma, donem, banka_id, tarih", "firma, tarih"],
  satis: ["firma, tarih", "firma, stok_id, tarih", "firma, cari_id, tarih"],
  alis: ["firma, tarih", "firma, stok_id"],
  siparis: ["firma, tarih"],
  taksit: ["firma, tarih"],
  cek_senet: ["firma, donem"],
  stok_durum: ["firma, donem, stok_id"],
};

const DEVIR_RE = /DEVR|DEV[İI]R/;
function isDevirText(s) {
  return DEVIR_RE.test(String(s || "").toLocaleUpperCase("tr-TR"));
}

function tableCols(ds) {
  const def = DATASETS[ds];
  const pre = def.scope === "global" ? [] : def.scope === "firma" ? [["firma", "t"]] : [["firma", "t"], ["donem", "t"]];
  return [["_k", "t"], ...pre, ...def.cols, ...(ENRICH[ds] || [])];
}

class TenantStore {
  constructor(file) {
    this.file = file;
    this.db = new Db(file);
    this.migrate();
    this.insertStmts = new Map();
  }

  migrate() {
    const db = this.db;
    db.exec(`
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS chunk_state (
        key TEXT PRIMARY KEY, ds TEXT NOT NULL, scope TEXT NOT NULL,
        n INTEGER, ck TEXT, sm REAL, rows INTEGER, updated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS ix_chunk_scope ON chunk_state(scope);
      CREATE TABLE IF NOT EXISTS stage (
        sync_id TEXT NOT NULL, key TEXT NOT NULL, seq INTEGER NOT NULL, payload TEXT NOT NULL,
        at TEXT NOT NULL, PRIMARY KEY (sync_id, key, seq)
      );
      CREATE TABLE IF NOT EXISTS snapshot (k TEXT PRIMARY KEY, v TEXT, at TEXT);
      CREATE TABLE IF NOT EXISTS sync_manifest (sync_id TEXT PRIMARY KEY, drop_keys TEXT, at TEXT);
    `);
    for (const ds of DATASET_NAMES) {
      const cols = tableCols(ds);
      db.exec(`CREATE TABLE IF NOT EXISTS ${ds} (${cols.map(([n, t]) => `${n} ${SQL_TYPE[t]}`).join(", ")})`);
      // Sonradan eklenen kolonlar için ileriye dönük göç
      const have = new Set(db.all(`PRAGMA table_info(${ds})`).map((r) => r.name));
      for (const [n, t] of cols) if (!have.has(n)) db.exec(`ALTER TABLE ${ds} ADD COLUMN ${n} ${SQL_TYPE[t]}`);
      db.exec(`CREATE INDEX IF NOT EXISTS ix_${ds}_k ON ${ds}(_k)`);
      (INDEXES[ds] || []).forEach((cols, i) => db.exec(`CREATE INDEX IF NOT EXISTS ix_${ds}_${i} ON ${ds}(${cols})`));
    }
  }

  // ─── Meta ──────────────────────────────────────────────────────────────
  getMeta(k, def = null) {
    const r = this.db.get("SELECT v FROM meta WHERE k = ?", k);
    if (!r) return def;
    try { return JSON.parse(r.v); } catch { return r.v; }
  }
  setMeta(k, v) {
    this.db.run("INSERT INTO meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", k, JSON.stringify(v));
  }
  dataVersion() { return Number(this.getMeta("dataVersion", 0)) || 0; }
  bumpVersion() {
    const v = this.dataVersion() + 1;
    this.setMeta("dataVersion", v);
    return v;
  }

  // ─── Köprü protokolü: manifest farkı ───────────────────────────────────
  // chunks: [{key, n, ck, sm}], scopes: ['ds|firma|donem', ...]
  diffManifest(syncId, chunks, scopes) {
    const need = [];
    const seen = new Set();
    const get = this.db.prepare("SELECT n, ck, sm FROM chunk_state WHERE key = ?");
    for (const c of chunks) {
      const { ds } = parseChunkKey(c.key);
      if (!DATASETS[ds]) throw Object.assign(new Error(`Bilinmeyen veri kümesi: ${ds}`), { status: 400 });
      seen.add(c.key);
      const s = get.get(c.key);
      const same = s && s.n === Number(c.n) && String(s.ck) === String(c.ck) &&
        Math.abs((Number(s.sm) || 0) - (Number(c.sm) || 0)) < 0.005;
      if (!same) need.push(c.key);
    }
    const drop = [];
    if (scopes && scopes.length) {
      const byScope = this.db.prepare("SELECT key FROM chunk_state WHERE scope = ?");
      for (const sc of new Set(scopes)) {
        for (const r of byScope.all(sc)) if (!seen.has(r.key)) drop.push(r.key);
      }
    }
    this.db.run(
      "INSERT INTO sync_manifest(sync_id, drop_keys, at) VALUES(?, ?, ?) ON CONFLICT(sync_id) DO UPDATE SET drop_keys = excluded.drop_keys, at = excluded.at",
      syncId, JSON.stringify(drop), new Date().toISOString(),
    );
    return { need, drop };
  }

  // ─── Köprü protokolü: chunk alımı (çok parçalı → staging → atomik değişim) ──
  receiveChunk({ syncId, key, n, ck, sm, cols, rows, seq = 0, last = true }) {
    const { ds, firma, donem } = parseChunkKey(key);
    const def = DATASETS[ds];
    if (!def) throw Object.assign(new Error(`Bilinmeyen veri kümesi: ${ds}`), { status: 400 });
    validateDatasetRow(ds, cols);
    if (!Array.isArray(rows)) throw Object.assign(new Error("rows dizi olmalı"), { status: 400 });
    if (!last) {
      this.db.run(
        "INSERT OR REPLACE INTO stage(sync_id, key, seq, payload, at) VALUES(?, ?, ?, ?, ?)",
        syncId, key, seq, JSON.stringify(rows), new Date().toISOString(),
      );
      return { staged: rows.length };
    }
    let total = 0;
    this.db.tx(() => {
      const parts = this.db.all("SELECT payload FROM stage WHERE sync_id = ? AND key = ? ORDER BY seq", syncId, key);
      this.db.run(`DELETE FROM ${ds} WHERE _k = ?`, key);
      const ins = this.insertStmt(ds);
      const put = (list) => {
        for (const r of list) {
          ins.run(...this.toParams(ds, key, firma, donem, r));
          total++;
        }
      };
      for (const p of parts) put(JSON.parse(p.payload));
      put(rows);
      this.db.run("DELETE FROM stage WHERE sync_id = ? AND key = ?", syncId, key);
      this.db.run(
        `INSERT INTO chunk_state(key, ds, scope, n, ck, sm, rows, updated_at) VALUES(?,?,?,?,?,?,?,?)
         ON CONFLICT(key) DO UPDATE SET n=excluded.n, ck=excluded.ck, sm=excluded.sm, rows=excluded.rows, updated_at=excluded.updated_at`,
        key, ds, scopeKey(ds, firma, donem), Number(n) || 0, String(ck ?? ""), Number(sm) || 0, total, new Date().toISOString(),
      );
    });
    return { stored: total };
  }

  insertStmt(ds) {
    let st = this.insertStmts.get(ds);
    if (!st) {
      const cols = tableCols(ds).map((c) => c[0]);
      st = this.db.raw.prepare(`INSERT INTO ${ds} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`);
      this.insertStmts.set(ds, st);
    }
    return st;
  }

  toParams(ds, key, firma, donem, r) {
    const def = DATASETS[ds];
    if (!Array.isArray(r) || r.length !== def.cols.length) {
      throw Object.assign(new Error(`${ds}: satır uzunluğu ${def.cols.length} olmalı`), { status: 400 });
    }
    const vals = def.cols.map(([, t], i) => normVal(r[i], t));
    const pre = def.scope === "global" ? [] : def.scope === "firma" ? [firma] : [firma, donem];
    const extra = [];
    if (ds === "kasa_hareket") {
      const o = rowObj(def, vals);
      extra.push(detectDoviz(o.kasa, o.pb), isDevirText(o.aciklama) ? 1 : 0);
    } else if (ds === "banka_hareket") {
      const o = rowObj(def, vals);
      extra.push(o.izahat === 113 || o.izahat === 114 || isDevirText(o.aciklama) ? 1 : 0);
    } else if (ds === "banka") {
      const o = rowObj(def, vals);
      extra.push(detectDoviz(o.ad, o.pb));
    }
    return [key, ...pre, ...vals, ...extra];
  }

  commit(syncId) {
    const m = this.db.get("SELECT drop_keys FROM sync_manifest WHERE sync_id = ?", syncId);
    const drop = m ? JSON.parse(m.drop_keys || "[]") : [];
    let dropped = 0;
    this.db.tx(() => {
      for (const key of drop) {
        const { ds } = parseChunkKey(key);
        if (!DATASETS[ds]) continue;
        this.db.run(`DELETE FROM ${ds} WHERE _k = ?`, key);
        this.db.run("DELETE FROM chunk_state WHERE key = ?", key);
        dropped++;
      }
      this.db.run("DELETE FROM sync_manifest WHERE sync_id = ?", syncId);
      // Yarım kalmış eski staging kayıtlarını temizle (1 günden eski)
      this.db.run("DELETE FROM stage WHERE at < ?", new Date(Date.now() - 86400000).toISOString());
      this.db.run("DELETE FROM sync_manifest WHERE at < ?", new Date(Date.now() - 86400000).toISOString());
    });
    const version = this.bumpVersion();
    this.setMeta("lastSync", new Date().toISOString());
    return { dropped, dataVersion: version };
  }

  // Tüm veriyi sil (tam yeniden eşitleme / demo sıfırlama)
  wipe() {
    this.db.tx(() => {
      for (const ds of DATASET_NAMES) this.db.run(`DELETE FROM ${ds}`);
      this.db.run("DELETE FROM chunk_state");
      this.db.run("DELETE FROM stage");
      this.db.run("DELETE FROM snapshot");
    });
    this.bumpVersion();
  }

  stats() {
    const out = {};
    for (const ds of DATASET_NAMES) out[ds] = this.db.value(`SELECT COUNT(*) FROM ${ds}`);
    out.chunks = this.db.value("SELECT COUNT(*) FROM chunk_state");
    return out;
  }

  close() { this.db.close(); }
}

function normVal(v, t) {
  if (v === undefined || v === null) return null;
  if (v === "") return t === "t" ? "" : null;
  if (t === "i") { const n = Math.trunc(Number(v)); return Number.isFinite(n) ? n : null; }
  if (t === "r") { const n = Number(v); return Number.isFinite(n) ? n : null; }
  if (t === "d") { const s = String(v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; }
  return String(v);
}

function rowObj(def, vals) {
  const o = {};
  def.cols.forEach(([n], i) => { o[n] = vals[i]; });
  return o;
}

module.exports = { TenantStore, tableCols, isDevirText };
