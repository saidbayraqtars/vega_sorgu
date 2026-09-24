// node:sqlite (Node ≥ 22.13) ince sarmalayıcı: pragmalar, hazır ifade önbelleği,
// işlem (transaction) yardımcısı. Yerel derleme gerektirmez — VPS kurulumu sade kalır.

// "SQLite is an experimental feature" uyarısını sustur (davranışı etkilemez).
const origEmitWarning = process.emitWarning;
process.emitWarning = function (warning, ...args) {
  const type = typeof args[0] === "string" ? args[0] : args[0] && args[0].type;
  if (type === "ExperimentalWarning" && String(warning).includes("SQLite")) return;
  return origEmitWarning.call(this, warning, ...args);
};

const { DatabaseSync } = require("node:sqlite");

class Db {
  constructor(file, { readOnly = false } = {}) {
    this.file = file;
    this.raw = new DatabaseSync(file, { readOnly });
    this.cache = new Map();
    if (!readOnly && file !== ":memory:") {
      this.raw.exec("PRAGMA journal_mode = WAL");
      this.raw.exec("PRAGMA synchronous = NORMAL");
    }
    this.raw.exec("PRAGMA foreign_keys = ON");
    this.raw.exec("PRAGMA busy_timeout = 5000");
    this.raw.exec("PRAGMA temp_store = MEMORY");
    this.raw.exec("PRAGMA cache_size = -32000"); // ~32 MB
    this.txDepth = 0;
  }

  prepare(sql) {
    let st = this.cache.get(sql);
    if (!st) {
      st = this.raw.prepare(sql);
      this.cache.set(sql, st);
      if (this.cache.size > 500) this.cache.delete(this.cache.keys().next().value);
    }
    return st;
  }

  exec(sql) { this.raw.exec(sql); }
  all(sql, ...params) { return this.prepare(sql).all(...params); }
  get(sql, ...params) { return this.prepare(sql).get(...params); }
  run(sql, ...params) { return this.prepare(sql).run(...params); }
  value(sql, ...params) {
    const row = this.get(sql, ...params);
    if (!row) return undefined;
    const k = Object.keys(row)[0];
    return row[k];
  }

  // İç içe çağrılabilir işlem: en dıştaki BEGIN/COMMIT yapar, içteki SAVEPOINT.
  tx(fn) {
    const depth = this.txDepth++;
    const sp = `sp${depth}`;
    this.raw.exec(depth === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${sp}`);
    try {
      const out = fn();
      this.raw.exec(depth === 0 ? "COMMIT" : `RELEASE ${sp}`);
      return out;
    } catch (err) {
      try { this.raw.exec(depth === 0 ? "ROLLBACK" : `ROLLBACK TO ${sp}; RELEASE ${sp}`); } catch { /* yut */ }
      throw err;
    } finally {
      this.txDepth--;
    }
  }

  close() {
    this.cache.clear();
    try { this.raw.close(); } catch { /* zaten kapalı */ }
  }
}

module.exports = { Db };
