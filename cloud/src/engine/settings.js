// Kiracı ayarları: varsayılanlar + doğrulama. İzahat eşlemesi Vega Kılavuzu
// EK B.1'deki DOĞRULANMIŞ kodlardan gelir; kuruluma göre ayarlardan değiştirilebilir.

const DEFAULTS = {
  // Yıllık TÜFE (%) — reel büyüme için. null → yalnız nominal büyüme gösterilir.
  enflasyon: null,
  // Cari hareket IZAHAT → iş olayı eşlemesi (Kılavuz §12.3, §26.4, EK B.1)
  izahat: {
    SATIS: [21],          // Satış faturası (BORÇ) — ciro, KDV dahil
    SATIS_IADE: [23],     // Satış iade
    ALIS: [20],           // Alış faturası (ALACAK), KDV dahil
    TAHSILAT: [13, 83],   // Cari giriş bordrosu + havale (83 = banka tahsilatı, §12.4)
    TEDIYE: [11, 84],     // Cari çıkış bordrosu + banka ödemesi
    DEVIR: [103, 104],    // Yıl başı açılış devri — akışlara girmez
  },
  // Personel/özel cari tespiti (Kılavuz §6.2, §26.3): bu FIRMATIPI değerleri ve
  // OZELKOD5='PERSONELCARI' ticari alacak/borç ve akışlardan hariç tutulur.
  personelTipleri: [11, 12],
  // Eşitleme aralığı (dakika) — köprüye ping yanıtında iletilir
  syncDakika: 15,
  // Görüntülenecek firmalar (null = hepsi). Ör. ["0101", "0103"]
  firmalar: null,
  // Sağlık skoru eşiklerini sektöre göre kaydırmak için (ör. brüt marj beklentisi)
  sektor: "genel",
};

const SEKTORLER = {
  genel: { ad: "Genel ticaret", marj: [0, 8, 18, 30] },
  toptan: { ad: "Toptan ticaret", marj: [0, 5, 12, 20] },
  perakende: { ad: "Perakende", marj: [0, 10, 22, 35] },
  uretim: { ad: "Üretim", marj: [0, 10, 20, 32] },
  hizmet: { ad: "Hizmet", marj: [0, 15, 35, 55] },
  gida: { ad: "Gıda / restoran", marj: [0, 20, 40, 60] },
};

function intList(v) {
  if (!Array.isArray(v)) return null;
  const out = [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 100000))];
  return out;
}

function resolveSettings(raw = {}) {
  const s = { ...DEFAULTS, ...raw };
  s.izahat = { ...DEFAULTS.izahat };
  for (const k of Object.keys(DEFAULTS.izahat)) {
    const v = intList(raw.izahat && raw.izahat[k]);
    if (v) s.izahat[k] = v;
  }
  s.personelTipleri = intList(raw.personelTipleri) || DEFAULTS.personelTipleri;
  s.enflasyon = raw.enflasyon === null || raw.enflasyon === undefined || raw.enflasyon === "" ? null : Number(raw.enflasyon);
  if (s.enflasyon !== null && (!Number.isFinite(s.enflasyon) || s.enflasyon < -50 || s.enflasyon > 500)) s.enflasyon = null;
  s.syncDakika = Math.min(240, Math.max(5, Number(raw.syncDakika) || DEFAULTS.syncDakika));
  s.firmalar = Array.isArray(raw.firmalar) && raw.firmalar.length ? raw.firmalar.filter((f) => /^\d{4}$/.test(f)) : null;
  s.sektor = SEKTORLER[raw.sektor] ? raw.sektor : "genel";
  return s;
}

// Ayar güncellemesini doğrula (kayda gidecek ham nesneyi döndürür)
function sanitizeSettingsPatch(patch = {}) {
  const out = {};
  if ("enflasyon" in patch) {
    const v = patch.enflasyon === null || patch.enflasyon === "" ? null : Number(patch.enflasyon);
    if (v !== null && (!Number.isFinite(v) || v < -50 || v > 500)) throw Object.assign(new Error("Enflasyon -50 ile 500 arasında olmalı."), { status: 400 });
    out.enflasyon = v;
  }
  if ("izahat" in patch) {
    if (typeof patch.izahat !== "object" || !patch.izahat) throw Object.assign(new Error("izahat nesne olmalı"), { status: 400 });
    out.izahat = {};
    for (const k of Object.keys(DEFAULTS.izahat)) {
      if (k in patch.izahat) {
        const v = intList(patch.izahat[k]);
        if (!v) throw Object.assign(new Error(`izahat.${k} sayı listesi olmalı`), { status: 400 });
        out.izahat[k] = v;
      }
    }
  }
  if ("personelTipleri" in patch) {
    const v = intList(patch.personelTipleri);
    if (!v) throw Object.assign(new Error("personelTipleri sayı listesi olmalı"), { status: 400 });
    out.personelTipleri = v;
  }
  if ("syncDakika" in patch) {
    const v = Number(patch.syncDakika);
    if (!Number.isFinite(v) || v < 5 || v > 240) throw Object.assign(new Error("Eşitleme aralığı 5-240 dakika olmalı."), { status: 400 });
    out.syncDakika = Math.round(v);
  }
  if ("firmalar" in patch) {
    if (patch.firmalar === null) out.firmalar = null;
    else if (Array.isArray(patch.firmalar) && patch.firmalar.every((f) => /^\d{4}$/.test(f))) out.firmalar = patch.firmalar;
    else throw Object.assign(new Error("firmalar 4 haneli kod listesi olmalı"), { status: 400 });
  }
  if ("sektor" in patch) {
    if (!SEKTORLER[patch.sektor]) throw Object.assign(new Error("Geçersiz sektör"), { status: 400 });
    out.sektor = patch.sektor;
  }
  return out;
}

module.exports = { DEFAULTS, SEKTORLER, resolveSettings, sanitizeSettingsPatch };
