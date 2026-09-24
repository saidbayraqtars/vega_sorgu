// Yollar arasında paylaşılan yardımcılar.

const { Context } = require("../engine/context");
const P = require("../engine/period");
const { HttpError } = require("../auth");

// Etkin firmalar: son 400 günde hareketi olanlar (kapanmış/eski firmalar varsayılan seçime girmez)
function activeFirmas(store, today) {
  const since = P.addDays(today, -400);
  return store.db.all("SELECT DISTINCT firma FROM cari_hareket WHERE tarih >= ? AND tarih <= ?", since, today).map((r) => r.firma);
}

// Aktif firmalar sorgusu büyük firmalarda pahalı olabilir: veri sürümü + gün başına bir kez
function cachedActiveFirmas(deps, tenant, store, today) {
  return deps.tenants.cached(tenant.id, store.dataVersion(), `aktifFirmalar|${today}`, () => activeFirmas(store, today));
}

// /uyarilar ve /surum'un paylaştığı önbellek anahtarı (ısıtma da aynısını kullanır)
function alertKey(firma, today) { return `uyarilar|firma=${firma || ""}|${today}`; }

function parseFirmaParam(v) {
  if (!v) return null;
  const list = String(v).split(",").map((s) => s.trim()).filter((s) => /^\d{4}$/.test(s));
  return list.length ? list : null;
}

// İstek için motor bağlamı
function contextFor(deps, req) {
  const { tenants, fx } = deps;
  const store = tenants.get(req.tenant);
  const today = P.todayTR();
  let firmalar = parseFirmaParam(req.query.firma);
  if (!firmalar && req.query.firma !== "hepsi") {
    const act = cachedActiveFirmas(deps, req.tenant, store, today);
    firmalar = act.length ? act : null;
  }
  const ctx = new Context(store, req.tenant.settings, { firmalar, today });
  const k = fx && fx.current();
  ctx.kurlar = k ? k.kurlar : null;
  return { ctx, store, today };
}

function cacheKey(req, extra = "") {
  const q = Object.keys(req.query).sort().map((k) => `${k}=${req.query[k]}`).join("&");
  return `${req.path}?${q}${extra}`;
}

function lastSyncOf(deps, tenant, store) {
  const log = deps.registry.lastSync(tenant.id);
  return log ? log.finished_at : store.getMeta("lastSync", null);
}

function wrap(fn) {
  return (req, res, next) => {
    try {
      const out = fn(req, res, next);
      if (out && typeof out.then === "function") out.catch(next);
    } catch (e) { next(e); }
  };
}

function bad(msg) { return new HttpError(400, msg); }

module.exports = { contextFor, cacheKey, lastSyncOf, wrap, bad, activeFirmas, cachedActiveFirmas, alertKey, parseFirmaParam };
