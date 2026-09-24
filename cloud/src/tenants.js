// Kiracı deposu yöneticisi: kiracı başına SQLite dosyası (data/tenants/<slug>.db),
// açık bağlantı önbelleği ve veri sürümüne bağlı sonuç önbelleği.

const fs = require("fs");
const path = require("path");
const { TenantStore } = require("./db/tenant");

class TenantManager {
  constructor(dataDir) {
    this.dir = path.join(dataDir, "tenants");
    fs.mkdirSync(this.dir, { recursive: true });
    this.stores = new Map();
    this.results = new Map(); // `${tenantId}|${version}|${key}` → değer
    this.busy = new Map(); // tenantId → eşitleme sürüyor mu
  }

  file(tenant) { return path.join(this.dir, `${tenant.slug}.db`); }

  get(tenant) {
    let s = this.stores.get(tenant.id);
    if (!s) {
      s = new TenantStore(this.file(tenant));
      this.stores.set(tenant.id, s);
    }
    return s;
  }

  close(tenantId) {
    const s = this.stores.get(tenantId);
    if (s) { s.close(); this.stores.delete(tenantId); }
    this.invalidate(tenantId);
  }

  remove(tenant) {
    this.close(tenant.id);
    for (const ext of ["", "-wal", "-shm"]) {
      try { fs.unlinkSync(this.file(tenant) + ext); } catch { /* yok */ }
    }
  }

  // Sonuç önbelleği (LRU benzeri, en fazla 800 kayıt)
  cached(tenantId, version, key, fn) {
    const k = `${tenantId}|${version}|${key}`;
    if (this.results.has(k)) {
      const v = this.results.get(k);
      this.results.delete(k); this.results.set(k, v); // tazele
      return v;
    }
    const v = fn();
    this.results.set(k, v);
    if (this.results.size > 800) this.results.delete(this.results.keys().next().value);
    return v;
  }

  invalidate(tenantId) {
    const pre = `${tenantId}|`;
    for (const k of [...this.results.keys()]) if (k.startsWith(pre)) this.results.delete(k);
  }

  closeAll() {
    for (const id of [...this.stores.keys()]) this.close(id);
  }
}

module.exports = { TenantManager };
