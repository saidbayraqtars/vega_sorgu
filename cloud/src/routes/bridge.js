// /api/kopru/v1 — köprü ajanının kullandığı uçlar (Bearer anahtar ile).
// Protokol: hello → (her 60 sn) ping → manifest → chunk… → commit
// Ajan yalnız kendi yazılı sorgularının kanonik satırlarını yollar; bulut hiçbir SQL göndermez.

const express = require("express");
const { HttpError } = require("../auth");
const { wrap } = require("./common");
const { PROTOCOL_VERSION, parseChunkKey, DATASETS } = require("../../../shared/datasets");
const { resolveSettings } = require("../engine/settings");
const log = require("../log");

const SYNC_ID = /^[\w.:-]{6,80}$/;

module.exports = function bridgeRoutes(deps) {
  const { registry, tenants, config } = deps;
  const r = express.Router();
  const jsonBig = express.json({ limit: `${config.bridgeMaxMb}mb`, inflate: true });

  // Kimlik: Authorization: Bearer vk_<kod>_<rastgele>
  r.use((req, res, next) => {
    const m = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || "");
    const v = m ? registry.verifyBridgeToken(m[1]) : null;
    if (!v) return next(new HttpError(401, "Geçersiz köprü anahtarı."));
    req.bridge = v;
    req.tenant = v.tenant;
    next();
  });

  r.post("/hello", express.json({ limit: "1mb" }), wrap((req, res) => {
    const ajan = (req.body && req.body.ajan) || {};
    registry.touchBridgeToken(req.bridge.tokenId, {
      surum: String(ajan.surum || "").slice(0, 20), makine: String(ajan.makine || "").slice(0, 80),
      sql: ajan.sql ? { surum: String(ajan.sql.surum || "").slice(0, 120), veritabani: String(ajan.sql.veritabani || "").slice(0, 80) } : null,
    });
    const s = resolveSettings(req.tenant.settings);
    res.json({ protokol: PROTOCOL_VERSION, firma: { kod: req.tenant.slug, ad: req.tenant.ad }, aralikDk: s.syncDakika, sunucuZamani: new Date().toISOString(),
      veriKumeleri: Object.keys(DATASETS) });
  }));

  r.get("/ping", wrap((req, res) => {
    registry.touchBridgeToken(req.bridge.tokenId, null);
    const q = registry.takeSyncRequest(req.tenant.id);
    const s = resolveSettings(req.tenant.settings);
    res.json({ simdiEsitle: q.syncNow, tamEsitleme: q.fullResync, aralikDk: s.syncDakika });
  }));

  r.post("/manifest", jsonBig, wrap((req, res) => {
    const { syncId, chunks, scopes, tam } = req.body || {};
    if (!SYNC_ID.test(String(syncId || ""))) throw new HttpError(400, "Geçersiz syncId.");
    if (!Array.isArray(chunks)) throw new HttpError(400, "chunks dizi olmalı.");
    for (const c of chunks) {
      if (!c || typeof c.key !== "string" || !DATASETS[parseChunkKey(c.key).ds]) throw new HttpError(400, `Geçersiz chunk: ${c && c.key}`);
    }
    const store = tenants.get(req.tenant);
    registry.syncStart(req.tenant.id, syncId);
    tenants.busy.set(req.tenant.id, Date.now());
    const d = store.diffManifest(syncId, chunks, Array.isArray(scopes) ? scopes : []);
    const need = tam ? chunks.map((c) => c.key) : d.need;
    res.json({ need, drop: d.drop });
  }));

  r.post("/chunk", jsonBig, wrap((req, res) => {
    const b = req.body || {};
    if (!SYNC_ID.test(String(b.syncId || ""))) throw new HttpError(400, "Geçersiz syncId.");
    const store = tenants.get(req.tenant);
    const out = store.receiveChunk({ syncId: b.syncId, key: b.key, n: b.n, ck: b.ck, sm: b.sm, cols: b.cols, rows: b.rows, seq: Number(b.seq) || 0, last: b.last !== false });
    registry.syncProgress(req.tenant.id, b.syncId, { chunks: b.last !== false ? 1 : 0, rows: (b.rows || []).length, bytes: Number(req.headers["content-length"]) || 0 });
    tenants.busy.set(req.tenant.id, Date.now());
    res.json({ tamam: true, ...out });
  }));

  r.post("/commit", express.json({ limit: "1mb" }), wrap((req, res) => {
    const { syncId, istatistik } = req.body || {};
    if (!SYNC_ID.test(String(syncId || ""))) throw new HttpError(400, "Geçersiz syncId.");
    const store = tenants.get(req.tenant);
    const out = store.commit(syncId);
    store.setMeta("demo", false);
    registry.syncFinish(req.tenant.id, syncId, "tamam", istatistik ? JSON.stringify(istatistik).slice(0, 1000) : null);
    tenants.busy.delete(req.tenant.id);
    tenants.invalidate(req.tenant.id);
    log.info("eşitleme tamam", { firma: req.tenant.slug, syncId, ...out });
    res.json({ tamam: true, veriSurumu: out.dataVersion, silinen: out.dropped, degisti: out.changed });
    // Durum ekranını arka planda ısıt (ilk kullanıcı beklemesin)
    if (deps.warm) setImmediate(() => { try { deps.warm(req.tenant); } catch (e) { log.warn("ısıtma hatası", { hata: e.message }); } });
  }));

  r.post("/olay", express.json({ limit: "64kb" }), wrap((req, res) => {
    const { seviye, mesaj, syncId } = req.body || {};
    registry.agentEvent(req.tenant.id, ["bilgi", "uyari", "hata"].includes(seviye) ? seviye : "bilgi", String(mesaj || "").slice(0, 2000));
    if (seviye === "hata" && syncId && SYNC_ID.test(String(syncId))) {
      registry.syncFinish(req.tenant.id, syncId, "hata", String(mesaj || "").slice(0, 500));
      tenants.busy.delete(req.tenant.id);
    }
    res.json({ tamam: true });
  }));

  return r;
};
