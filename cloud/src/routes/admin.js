// /api — firma yöneticisi işlemleri: ayarlar, kullanıcılar, köprü anahtarları, eşitleme izleme

const express = require("express");
const { requireTenant, requireAdmin, HttpError } = require("../auth");
const { wrap } = require("./common");
const { resolveSettings, sanitizeSettingsPatch, SEKTORLER, DEFAULTS } = require("../engine/settings");
const { bridgeState } = require("./data");

module.exports = function adminRoutes(deps) {
  const { registry, tenants } = deps;
  const r = express.Router();
  // Yalnız bu yönlendiricinin yollarında ("/api" altındaki diğer uçlara karışmasın)
  r.use(["/ayarlar", "/kullanicilar", "/kopru"], requireTenant, requireAdmin);

  r.get("/ayarlar", wrap((req, res) => {
    res.json({ ayarlar: resolveSettings(req.tenant.settings), varsayilan: DEFAULTS,
      sektorler: Object.entries(SEKTORLER).map(([kod, v]) => ({ kod, ad: v.ad })) });
  }));

  r.put("/ayarlar", wrap((req, res) => {
    const patch = sanitizeSettingsPatch(req.body || {});
    const t = registry.updateTenant(req.tenant.id, { settings: patch });
    tenants.invalidate(req.tenant.id);
    registry.audit(req.user.id, req.tenant.id, "ayar", patch);
    res.json({ ayarlar: resolveSettings(t.settings) });
  }));

  // ── Kullanıcılar ──
  const view = (u) => ({ id: u.id, kullanici: u.username, ad: u.ad, rol: u.rol, aktif: u.aktif, sonGiris: u.last_login, olusturma: u.created_at });
  r.get("/kullanicilar", wrap((req, res) => res.json({ kullanicilar: registry.users(req.tenant.id).map(view) })));
  r.post("/kullanicilar", wrap((req, res) => {
    const b = req.body || {};
    const u = registry.createUser({ username: b.kullanici, password: b.sifre, rol: b.rol === "admin" ? "admin" : "user", tenantId: req.tenant.id, ad: b.ad });
    registry.audit(req.user.id, req.tenant.id, "kullanici_ekle", { kullanici: u.username });
    res.status(201).json({ kullanici: view(u) });
  }));
  r.put("/kullanicilar/:id", wrap((req, res) => {
    const u = registry.user(Number(req.params.id));
    if (!u || u.tenantId !== req.tenant.id) throw new HttpError(404, "Kullanıcı bulunamadı.");
    const b = req.body || {};
    if (u.id === req.user.id && (b.aktif === false || (b.rol && b.rol !== u.rol))) throw new HttpError(400, "Kendi rolünüzü veya durumunuzu değiştiremezsiniz.");
    const out = registry.updateUser(u.id, { ad: b.ad, rol: b.rol, aktif: b.aktif, password: b.sifre || undefined });
    res.json({ kullanici: view(out) });
  }));
  r.delete("/kullanicilar/:id", wrap((req, res) => {
    const u = registry.user(Number(req.params.id));
    if (!u || u.tenantId !== req.tenant.id) throw new HttpError(404, "Kullanıcı bulunamadı.");
    if (u.id === req.user.id) throw new HttpError(400, "Kendinizi silemezsiniz.");
    registry.deleteUser(u.id);
    res.json({ tamam: true });
  }));

  // ── Köprü ──
  r.get("/kopru", wrap((req, res) => {
    const store = tenants.get(req.tenant);
    res.json({
      durum: bridgeState(registry, req.tenant, store),
      anahtarlar: registry.bridgeTokens(req.tenant.id),
      esitlemeler: registry.syncLogs(req.tenant.id, 30),
      olaylar: registry.agentEvents(req.tenant.id, 50),
      veri: store.stats(),
      sunucu: deps.config.publicUrl || `${req.protocol}://${req.get("host")}`,
    });
  }));
  r.post("/kopru/anahtar", wrap((req, res) => {
    const token = registry.createBridgeToken(req.tenant.id, (req.body && req.body.etiket) || "");
    registry.audit(req.user.id, req.tenant.id, "kopru_anahtar", {});
    res.status(201).json({ anahtar: token, uyari: "Bu anahtar yalnız bir kez gösterilir. Köprü programına yapıştırın." });
  }));
  r.delete("/kopru/anahtar/:id", wrap((req, res) => {
    registry.revokeBridgeToken(req.tenant.id, Number(req.params.id));
    res.json({ tamam: true });
  }));
  r.post("/kopru/tam-esitleme", wrap((req, res) => {
    registry.requestSync(req.tenant.id, true);
    res.json({ tamam: true, mesaj: "Tam eşitleme istendi; köprü bir sonraki yoklamada tüm veriyi yeniden gönderecek." });
  }));

  return r;
};
