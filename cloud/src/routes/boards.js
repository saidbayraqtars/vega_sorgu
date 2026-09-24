// /api/panolar — kullanıcının özelleştirilebilir panoları (widget listesi)

const express = require("express");
const crypto = require("crypto");
const { requireTenant, HttpError } = require("../auth");
const { wrap } = require("./common");
const CAT = require("../engine/catalog");
const P = require("../engine/period");

const W = (rapor, boyut = "m", ek = {}) => ({ id: crypto.randomUUID(), rapor, boyut, ...ek });

// İlk girişte oluşturulan varsayılan panolar
function defaultBoards() {
  return [
    { ad: "Genel", ikon: "LayoutDashboard", sira: 0, widgets: [
      W("ozel.saglik", "m"), W("ozel.buyume", "m"),
      W("net_ciro.kpi", "s"), W("tahsilat.kpi", "s"), W("brut_kar.kpi", "s"), W("aktif_musteri.kpi", "s"),
      W("net_ciro.trend.ay", "l"), W("ozel.nakit_projeksiyonu", "l"),
      W("satis.top.cari", "m"), W("net_satis.top.urun", "m"),
      W("ozel.alacak_yaslandirma", "m"), W("ozel.vade_takvimi", "m"),
    ] },
    { ad: "Satış", ikon: "ShoppingCart", sira: 1, widgets: [
      W("net_ciro.yoy.gun", "l"), W("fatura_sayisi.kpi", "s"), W("ort_fatura.kpi", "s"), W("brut_marj.kpi", "s"), W("siparis_tutar.kpi", "s"),
      W("net_satis.pay.sinif", "m"), W("brut_kar.top.urun", "m"), W("satis.pay.il", "m"), W("net_ciro.kumulatif", "m"),
      W("satis.isi", "l"),
    ] },
    { ad: "Nakit", ikon: "Wallet", sira: 2, widgets: [
      W("ozel.likidite_seyri", "l"), W("ozel.kasa_durumu", "m"), W("ozel.banka_durumu", "m"),
      W("tahsilat.trend.hafta", "m"), W("ticari_denge.trend.ay", "m"), W("ozel.cek_alinan", "l"),
    ] },
  ];
}

function validateWidgets(list) {
  if (!Array.isArray(list)) throw new HttpError(400, "widgets dizi olmalı.");
  return list.map((w, i) => {
    if (!w || typeof w !== "object") throw new HttpError(400, `Kutu ${i + 1} geçersiz.`);
    const rep = CAT.getReport(String(w.rapor || ""));
    if (!rep) throw new HttpError(400, `Bilinmeyen rapor: ${w.rapor}`);
    const out = { id: /^[\w-]{6,64}$/.test(String(w.id || "")) ? String(w.id) : crypto.randomUUID(), rapor: rep.id, boyut: ["s", "m", "l"].includes(w.boyut) ? w.boyut : "m" };
    if (w.grafik) {
      if (!rep.grafikler.includes(w.grafik)) throw new HttpError(400, `'${rep.ad}' için geçersiz grafik: ${w.grafik}`);
      out.grafik = w.grafik;
    }
    if (w.donem) {
      if (w.donem !== "ozel" && !P.PRESETS[w.donem]) throw new HttpError(400, `Geçersiz dönem: ${w.donem}`);
      out.donem = w.donem;
      if (w.donem === "ozel") {
        if (!P.isDate(w.bas) || !P.isDate(w.bit)) throw new HttpError(400, "Özel dönem için bas/bit gerekli.");
        out.bas = w.bas; out.bit = w.bit;
      }
    }
    if (w.kirilim) { if (!P.GRANS[w.kirilim]) throw new HttpError(400, `Geçersiz kırılım: ${w.kirilim}`); out.kirilim = w.kirilim; }
    if (w.n !== undefined && w.n !== null) out.n = Math.min(CAT.N_MAX, Math.max(3, Number(w.n) || rep.n || 10));
    if (w.baslik) out.baslik = String(w.baslik).slice(0, 60);
    return out;
  });
}

module.exports = function boardRoutes(deps) {
  const { registry } = deps;
  const r = express.Router();
  r.use(requireTenant);

  r.get("/", wrap((req, res) => {
    let boards = registry.boards(req.user.id);
    if (!boards.length) {
      for (const b of defaultBoards()) registry.saveBoard(req.user.id, b);
      boards = registry.boards(req.user.id);
    }
    res.json({ panolar: boards });
  }));

  r.post("/", wrap((req, res) => {
    const b = req.body || {};
    const id = registry.saveBoard(req.user.id, { ad: b.ad, ikon: b.ikon, sira: b.sira, widgets: validateWidgets(b.widgets || []) });
    res.status(201).json({ id, panolar: registry.boards(req.user.id) });
  }));

  r.put("/:id", wrap((req, res) => {
    const b = req.body || {};
    const id = Number(req.params.id);
    const cur = registry.boards(req.user.id).find((x) => x.id === id);
    if (!cur) throw new HttpError(404, "Pano bulunamadı.");
    registry.saveBoard(req.user.id, { id, ad: b.ad, ikon: b.ikon, sira: b.sira, widgets: b.widgets ? validateWidgets(b.widgets) : cur.widgets });
    res.json({ panolar: registry.boards(req.user.id) });
  }));

  r.delete("/:id", wrap((req, res) => {
    registry.deleteBoard(req.user.id, Number(req.params.id));
    res.json({ panolar: registry.boards(req.user.id) });
  }));

  // Varsayılana dön
  r.post("/sifirla", wrap((req, res) => {
    for (const b of registry.boards(req.user.id)) registry.deleteBoard(req.user.id, b.id);
    for (const b of defaultBoards()) registry.saveBoard(req.user.id, b);
    res.json({ panolar: registry.boards(req.user.id) });
  }));

  return r;
};

module.exports.defaultBoards = defaultBoards;
module.exports.validateWidgets = validateWidgets;
