// Test yardımcıları: küçük ölçekli demo deposu (süreç başına bir kez üretilir).

const fs = require("fs");
const os = require("os");
const path = require("path");
const { TenantStore } = require("../src/db/tenant");
const { loadDemo } = require("../src/demo/load");
const { Context } = require("../src/engine/context");

const TODAY = "2026-09-24";
let cached = null;

function tmpdir(prefix = "vb-test-") { return fs.mkdtempSync(path.join(os.tmpdir(), prefix)); }

function demoStore({ olcek = 0.3 } = {}) {
  if (cached && cached.olcek === olcek) return cached.store;
  const dir = tmpdir();
  const store = new TenantStore(path.join(dir, "demo.db"));
  loadDemo(store, { today: TODAY, olcek, seed: 424242 });
  cached = { olcek, store };
  return store;
}

function ctx(store, settings = { enflasyon: 25 }, opts = {}) {
  return new Context(store, settings, { today: TODAY, ...opts });
}

// Nesnede NaN / Infinity var mı? (JSON'a null diye sessizce giderdi)
function findNonFinite(obj, pathStr = "") {
  if (typeof obj === "number") return Number.isFinite(obj) ? null : pathStr || "(kök)";
  if (Array.isArray(obj)) { for (let i = 0; i < obj.length; i++) { const r = findNonFinite(obj[i], `${pathStr}[${i}]`); if (r) return r; } return null; }
  if (obj && typeof obj === "object") { for (const [k, v] of Object.entries(obj)) { const r = findNonFinite(v, `${pathStr}.${k}`); if (r) return r; } }
  return null;
}

module.exports = { TODAY, tmpdir, demoStore, ctx, findNonFinite };
