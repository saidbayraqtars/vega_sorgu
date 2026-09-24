// /api — kiracı verisi: meta, durum, raporlar, uyarılar, cari detayı

const express = require("express");
const { requireTenant, HttpError } = require("../auth");
const { contextFor, cacheKey, lastSyncOf, wrap, cachedActiveFirmas, alertKey } = require("./common");
const P = require("../engine/period");
const Q = require("../engine/query");
const { overview } = require("../engine/overview");
const { alerts, withStale } = require("../engine/alerts");
const CAT = require("../engine/catalog");
const { SEKTORLER } = require("../engine/settings");
const { IZAHAT_AD } = require("../engine/special");

function bridgeState(registry, tenant, store) {
  const tokens = registry.bridgeTokens(tenant.id).filter((t) => !t.revoked);
  const seen = tokens.map((t) => t.last_seen).filter(Boolean).sort().pop() || null;
  const last = registry.lastSync(tenant.id);
  const son = last ? last.finished_at : store.getMeta("lastSync", null);
  const dk = son ? (Date.now() - new Date(son).getTime()) / 60000 : null;
  const aralik = (tenant.settings && tenant.settings.syncDakika) || 15;
  let durum = "yok";
  if (store.getMeta("demo", false)) durum = "demo";
  else if (son) durum = dk <= aralik * 2 + 5 ? "guncel" : dk <= 180 ? "gecikmeli" : "kopuk";
  else if (tokens.length) durum = "bekleniyor";
  return { durum, sonEsitleme: son, sonGorulme: seen, dakika: dk === null ? null : Math.round(dk), aralikDk: aralik, anahtarSayisi: tokens.length };
}

module.exports = function dataRoutes(deps) {
  const { registry, tenants } = deps;
  const r = express.Router();
  r.use(requireTenant);

  // Arayüzün açılışta ihtiyaç duyduğu her şey
  r.get("/meta", wrap((req, res) => {
    const store = tenants.get(req.tenant);
    const today = P.todayTR();
    const aktif = new Set(cachedActiveFirmas(deps, req.tenant, store, today));
    const firmalar = store.db.all("SELECT firma, ad, unvan FROM firma ORDER BY firma").map((f) => ({ kod: f.firma, ad: f.ad || f.unvan || f.firma, unvan: f.unvan, aktif: aktif.has(f.firma) }));
    res.json({
      firma: { id: req.tenant.id, kod: req.tenant.slug, ad: req.tenant.ad },
      bugun: today,
      firmalar,
      donemler: Object.entries(P.PRESETS).map(([kod, v]) => ({ kod, ad: v.ad, ikon: v.ikon })).concat([{ kod: "ozel", ad: "Tarih aralığı", ikon: "CalendarSearch" }]),
      kirilimlar: Object.entries(P.GRANS).map(([kod, ad]) => ({ kod, ad })),
      kategoriler: CAT.KATEGORILER,
      raporSayisi: CAT.catalog().length,
      veriSurumu: store.dataVersion(),
      kopru: bridgeState(registry, req.tenant, store),
      ayarlar: { enflasyon: req.tenant.settings.enflasyon ?? null, sektor: req.tenant.settings.sektor || "genel", syncDakika: req.tenant.settings.syncDakika || 15 },
      rol: req.user.rol,
    });
  }));

  // Uyarı listesi — /uyarilar ve /surum aynı önbellek kaydını paylaşır (firma seçimine göre)
  const alertList = (req) => {
    const { ctx, store, today } = contextFor(deps, req);
    const sonEsitleme = lastSyncOf(deps, req.tenant, store);
    return tenants.cached(req.tenant.id, store.dataVersion(), alertKey(req.query.firma, today), () => alerts(ctx, { kurlar: ctx.kurlar, sonEsitleme }));
  };
  // Demo firmalarda köprü yok: "veri eski" uyarısı anlamsız
  const sonEsitlemeUyari = (req, store) => (store.getMeta("demo", false) ? null : lastSyncOf(deps, req.tenant, store));
  const guncelUyarilar = (req) => withStale(alertList(req), sonEsitlemeUyari(req, tenants.get(req.tenant)));
  const ozetle = (list) => ({
    kritik: list.filter((a) => a.seviye === "kritik").length, uyari: list.filter((a) => a.seviye === "uyari").length, bilgi: list.filter((a) => a.seviye === "bilgi").length,
  });

  // Hafif yoklama (arayüz 60 sn'de bir çağırır; sürüm değişince yeniden yükler). Uyarı sayıları önbellekten gelir.
  r.get("/surum", wrap((req, res) => {
    const store = tenants.get(req.tenant);
    res.json({
      veriSurumu: store.dataVersion(),
      esitleniyor: !!tenants.busy.get(req.tenant.id),
      bekleyenIstek: registry.pendingSyncRequest(req.tenant.id),
      kopru: bridgeState(registry, req.tenant, store),
      uyariOzet: ozetle(guncelUyarilar(req)),
    });
  }));

  // "Şimdi güncelle": köprü bir sonraki yoklamasında (≤ 60 sn) eşitlemeye başlar
  r.post("/guncelle", wrap((req, res) => {
    registry.requestSync(req.tenant.id, false);
    res.json({ tamam: true, mesaj: "Güncelleme istendi. Köprü en geç 1 dakika içinde eşitlemeye başlar." });
  }));

  r.get("/durum", wrap((req, res) => {
    const { ctx, store, today } = contextFor(deps, req);
    const sonEsitleme = lastSyncOf(deps, req.tenant, store);
    const out = tenants.cached(req.tenant.id, store.dataVersion(), cacheKey(req, `|${today}`), () => overview(ctx, { kurlar: ctx.kurlar, sonEsitleme }));
    const uyarilar = withStale(out.uyarilar, sonEsitlemeUyari(req, store));
    res.json({ ...out, uyarilar, uyariOzet: ozetle(uyarilar), kopru: bridgeState(registry, req.tenant, store), veriSurumu: store.dataVersion(), kurlar: deps.fx && deps.fx.current() });
  }));

  r.get("/uyarilar", wrap((req, res) => {
    const list = guncelUyarilar(req);
    res.json({ uyarilar: list, ozet: ozetle(list) });
  }));

  // Katalog (arama/filtre istemcide yapılır — ~1000 kayıt, ~200 KB)
  r.get("/raporlar", wrap((req, res) => {
    const list = CAT.catalog().map((x) => ({
      id: x.id, ad: x.ad, kisa: x.kisa, ikon: x.ikon, kategori: x.kategori, tur: x.tur, grafik: x.grafik, grafikler: x.grafikler,
      donem: x.donem, birim: x.birim, iyi: x.iyi || "notr", aciklama: x.aciklama, olcu: x.olcu || null, boyut: x.boyut || null, gorunum: x.gorunum || "ozel",
      parametreler: x.parametreler,
    }));
    res.set("Cache-Control", "private, max-age=300");
    res.json({ kategoriler: CAT.KATEGORILER, raporlar: list });
  }));

  r.get("/rapor/:id", wrap((req, res) => {
    const id = req.params.id;
    if (!CAT.getReport(id)) throw new HttpError(404, "Rapor bulunamadı.");
    const { ctx, store, today } = contextFor(deps, req);
    const out = tenants.cached(req.tenant.id, store.dataVersion(), cacheKey(req, `|${today}`), () => CAT.run(ctx, id, req.query));
    res.json({ ...out, veriSurumu: store.dataVersion() });
  }));

  // Cari detayı (rapor satırından tıklama): anahtar "firma:id"
  r.get("/cari/:anahtar", wrap((req, res) => {
    const m = /^(\d{4}):(\d{1,9})$/.exec(req.params.anahtar);
    if (!m) throw new HttpError(400, "Geçersiz cari anahtarı.");
    const [, firma, id] = m;
    const { ctx, store } = contextFor(deps, { ...req, query: { firma } });
    const kart = store.db.get("SELECT * FROM cari WHERE firma = ? AND id = ?", firma, Number(id));
    if (!kart) throw new HttpError(404, "Cari bulunamadı.");
    const donem = ctx.activeDonem(firma);
    const bakiye = store.db.get(`SELECT SUM(borc - alacak) AS b, MAX(tarih) AS son FROM cari_hareket WHERE firma = ? AND donem = ? AND cari_id = ? AND IFNULL(ozelkod,'') <> 'KREDIHESABI'`, firma, donem, Number(id));
    const hareketler = store.db.all(`SELECT tarih, izahat, evrak, borc, alacak, vade FROM cari_hareket WHERE firma = ? AND donem = ? AND cari_id = ?
      ORDER BY tarih DESC, id DESC LIMIT 100`, firma, donem, Number(id)).map((h) => ({ ...h, islem: IZAHAT_AD[h.izahat] || `İşlem ${h.izahat}` }));
    const t = ctx.today;
    const aylik = store.db.all(`SELECT substr(tarih,1,7) AS ay, SUM(CASE WHEN izahat IN (${ctx.iz("SATIS")}) THEN borc - alacak ELSE 0 END) AS satis,
      SUM(CASE WHEN izahat IN (${ctx.iz("TAHSILAT")}) THEN alacak - borc ELSE 0 END) AS tahsilat
      FROM cari_hareket WHERE firma = ? AND cari_id = ? AND tarih BETWEEN ? AND ? GROUP BY ay ORDER BY ay`, firma, Number(id), P.startOfMonth(P.addMonths(t, -11)), t);
    const urunler = store.db.all(`SELECT s.stok_id, MAX(st.ad) AS ad, SUM(s.tutar) AS tutar, SUM(s.miktar) AS miktar FROM satis s
      LEFT JOIN stok st ON st.firma = s.firma AND st.id = s.stok_id WHERE s.firma = ? AND s.cari_id = ? AND s.tarih >= ? AND IFNULL(s.iptal,0) = 0
      GROUP BY s.stok_id ORDER BY tutar DESC LIMIT 10`, firma, Number(id), P.addDays(t, -364));
    res.json({ kart: { ...kart, firmaAd: ctx.firmaAd(firma) }, bakiye: bakiye.b || 0, sonHareket: bakiye.son, hareketler, aylik, urunler });
  }));

  r.get("/sektorler", (req, res) => res.json({ sektorler: Object.entries(SEKTORLER).map(([kod, v]) => ({ kod, ad: v.ad })) }));

  return r;
};

module.exports.bridgeState = bridgeState;
