// /api/yonetim — sistem yöneticisi (VPS sahibi): firmalar (kiracılar), izleme, demo

const express = require("express");
const { requireSuper, HttpError } = require("../auth");
const { wrap } = require("./common");
const { bridgeState } = require("./data");
const { loadDemo } = require("../demo/load");
const P = require("../engine/period");

module.exports = function superRoutes(deps) {
  const { registry, tenants, config } = deps;
  const r = express.Router();
  r.use(requireSuper);

  const view = (t) => {
    const store = tenants.get(t);
    const users = registry.users(t.id);
    return {
      id: t.id, kod: t.slug, ad: t.ad, aktif: t.aktif, olusturma: t.created_at,
      kopru: bridgeState(registry, t, store), kullaniciSayisi: users.length,
      veriSurumu: store.dataVersion(), satir: store.db.value("SELECT COUNT(*) FROM cari_hareket"), demo: !!store.getMeta("demo", false),
    };
  };

  r.get("/firmalar", wrap((req, res) => res.json({ firmalar: registry.tenants().map(view) })));

  r.post("/firmalar", wrap((req, res) => {
    const b = req.body || {};
    const settings = {};
    if (config.varsayilanEnflasyon !== null && Number.isFinite(config.varsayilanEnflasyon)) settings.enflasyon = config.varsayilanEnflasyon;
    const t = registry.createTenant({ slug: b.kod, ad: b.ad, settings });
    let admin = null;
    try {
      if (b.yoneticiKullanici) admin = registry.createUser({ username: b.yoneticiKullanici, password: b.yoneticiSifre, rol: "admin", tenantId: t.id, ad: b.yoneticiAd || "" });
    } catch (e) {
      registry.deleteTenant(t.id);
      throw e;
    }
    const anahtar = registry.createBridgeToken(t.id, "ilk kurulum");
    if (b.demo) {
      if (!config.demoIzinli) throw new HttpError(403, "Demo verisi bu sunucuda kapalı.");
      const store = tenants.get(t);
      loadDemo(store, { today: P.todayTR() });
      store.setMeta("demo", true);
    }
    registry.audit(req.user.id, t.id, "firma_ekle", { kod: t.slug });
    res.status(201).json({ firma: view(t), yonetici: admin ? { kullanici: admin.username } : null, kopruAnahtari: anahtar });
  }));

  r.put("/firmalar/:id", wrap((req, res) => {
    const t = registry.updateTenant(Number(req.params.id), { ad: req.body && req.body.ad, aktif: req.body && req.body.aktif });
    if (!t) throw new HttpError(404, "Firma bulunamadı.");
    res.json({ firma: view(t) });
  }));

  r.delete("/firmalar/:id", wrap((req, res) => {
    const t = registry.tenant(Number(req.params.id));
    if (!t) throw new HttpError(404, "Firma bulunamadı.");
    if (!req.body || req.body.onay !== t.slug) throw new HttpError(400, `Silmeyi onaylamak için firma kodunu yazın: ${t.slug}`);
    tenants.remove(t);
    registry.deleteTenant(t.id);
    registry.audit(req.user.id, null, "firma_sil", { kod: t.slug });
    res.json({ tamam: true });
  }));

  // Demo verisini yeniden yükle (yalnız demo işaretli firmalarda)
  r.post("/firmalar/:id/demo", wrap((req, res) => {
    if (!config.demoIzinli) throw new HttpError(403, "Demo verisi bu sunucuda kapalı.");
    const t = registry.tenant(Number(req.params.id));
    if (!t) throw new HttpError(404, "Firma bulunamadı.");
    const store = tenants.get(t);
    if (store.dataVersion() > 0 && !store.getMeta("demo", false)) throw new HttpError(400, "Bu firmada gerçek veri var; demo yüklenemez.");
    store.wipe();
    const out = loadDemo(store, { today: P.todayTR() });
    store.setMeta("demo", true);
    tenants.invalidate(t.id);
    res.json({ tamam: true, ...out });
  }));

  // Firmanın gözünden bak (sistem yöneticisi oturumu o firmaya geçer)
  r.post("/gorunum", wrap((req, res) => {
    const id = req.body && req.body.firmaId ? Number(req.body.firmaId) : null;
    if (id && !registry.tenant(id)) throw new HttpError(404, "Firma bulunamadı.");
    registry.setSessionViewTenant(req.sessionToken, id);
    res.json({ tamam: true });
  }));

  // Tüm firmalar + kullanıcılar
  r.get("/kullanicilar", wrap((req, res) => res.json({ kullanicilar: registry.users().map((u) => ({ id: u.id, kullanici: u.username, ad: u.ad, rol: u.rol, firmaId: u.tenantId, aktif: u.aktif, sonGiris: u.last_login })) })));
  r.post("/kullanicilar", wrap((req, res) => {
    const b = req.body || {};
    const u = registry.createUser({ username: b.kullanici, password: b.sifre, rol: b.rol, tenantId: b.firmaId || null, ad: b.ad });
    res.status(201).json({ kullanici: { id: u.id, kullanici: u.username, rol: u.rol } });
  }));

  return r;
};
