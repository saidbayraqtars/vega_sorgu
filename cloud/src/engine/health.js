// ═══════════════════════════════════════════════════════════════════════════
//  Finansal Sağlık Skoru (0–100)
//
//  Beş sütun, her biri ölçütlerin parçalı-doğrusal puanlarının ortalaması:
//    Likidite  %25 · Kârlılık %20 · Büyüme %20 · Tahsilat & Döngü %20 · Risk %15
//  Eksik ölçüt/sütun hesaba katılmaz; ağırlıklar yeniden ölçeklenir.
//  Not: ≥80 A (Çok iyi) · 65–79 B (İyi) · 50–64 C (Orta) · 35–49 D (Zayıf) · <35 E (Kritik)
//  Her ölçüt kendi açıklamasını taşır → "neden bu skor?" sorusu ekranda yanıtlanır.
// ═══════════════════════════════════════════════════════════════════════════

const S = require("./stats");
const { SEKTORLER } = require("./settings");
const { ratios } = require("./ratios");
const { growthAnalysis } = require("./growth");
const { position } = require("./position");
const { iyelik, iyelikBelirtme, iyelikTamlayan } = require("../util/tr");

const fmtPct = (x, d = 0) => (x === null || x === undefined ? "—" : `%${(x * 100).toLocaleString("tr-TR", { maximumFractionDigits: d, minimumFractionDigits: d })}`);
const fmtNum = (x, d = 1) => (x === null || x === undefined ? "—" : x.toLocaleString("tr-TR", { maximumFractionDigits: d, minimumFractionDigits: 0 }));

const GRADES = [
  { min: 80, not: "A", etiket: "Çok iyi", renk: "iyi" },
  { min: 65, not: "B", etiket: "İyi", renk: "iyi" },
  { min: 50, not: "C", etiket: "Orta", renk: "orta" },
  { min: 35, not: "D", etiket: "Zayıf", renk: "zayif" },
  { min: -1, not: "E", etiket: "Kritik", renk: "kritik" },
];
function grade(score) { return GRADES.find((g) => score >= g.min) || GRADES[GRADES.length - 1]; }

// Puanlama "%" ölçütlerde kesirle (0.30), "puan" ölçütlerde yüzde puanıyla (−9.3) yapılır.
// Dışarı verilen değer API'nin genel birim kuralına uyar: "%" → yüzde sayısı (29.96), "puan" → yüzde puanı.
function metric(id, ad, ikon, deger, birim, anchors, aciklama, ideal) {
  const var_ = deger !== null && deger !== undefined && Number.isFinite(deger);
  const skor = var_ ? S.clamp(S.scorePiecewise(deger, anchors), 0, 100) : null;
  return { id, ad, ikon, deger: var_ ? (birim === "%" ? deger * 100 : deger) : null, birim, skor, aciklama, ideal };
}

function healthScore(ctx, opts = {}) {
  return ctx.cached("health", () => {
    const r = ratios(ctx, opts);
    const g = growthAnalysis(ctx);
    const pos = position(ctx, opts);
    const marj = SEKTORLER[ctx.s.sektor].marj;

    const pillars = [
      {
        id: "likidite", ad: "Likidite", ikon: "Droplets", agirlik: 25,
        olcutler: [
          metric("cari_oran", "Cari oran", "Scale", pos.oranlar.cari, "x", [[0.5, 0], [1, 45], [1.5, 75], [2, 90], [3, 100]],
            `Dönen varlıklar kısa vadeli borçların ${fmtNum(pos.oranlar.cari, 2)} katı.`, "≥ 1,5"),
          metric("asit_test", "Asit-test oranı", "FlaskConical", pos.oranlar.asitTest, "x", [[0.3, 0], [0.7, 45], [1, 70], [1.5, 95], [2, 100]],
            `Stok hariç hızlı varlıklar borçların ${fmtNum(pos.oranlar.asitTest, 2)} katı.`, "≥ 1"),
          metric("nakit_gun", "Nakit yeterliliği", "Hourglass", r.nakitGun, "gün", [[5, 0], [15, 30], [30, 55], [60, 80], [90, 100]],
            `Mevcut nakit, ortalama ödemelerle ${fmtNum(r.nakitGun, 0)} gün yetiyor.`, "≥ 60 gün"),
          metric("vade_karsilama", "30 gün vade karşılama", "CalendarCheck2", r.vadeKarsilama, "x", [[0.5, 0], [1, 50], [1.5, 80], [2.5, 100]],
            r.vadeKarsilama === null ? "Önümüzdeki 30 günde ödenecek çek/senet yok." : `30 gün içinde ödenecek çek/senetler ${fmtNum(r.vadeKarsilama, 2)} kat karşılanıyor.`, "≥ 1,5"),
        ],
      },
      {
        id: "karlilik", ad: "Kârlılık", ikon: "PiggyBank", agirlik: 20,
        olcutler: [
          metric("brut_marj", "Brüt kâr marjı", "Percent", r.marj === null ? null : r.marj / 100, "%", [[marj[0] / 100, 0], [marj[1] / 100, 40], [marj[2] / 100, 75], [marj[3] / 100, 100]],
            `Son 12 ayda satışın ${iyelik(fmtPct(r.marj === null ? null : r.marj / 100, 1))} brüt kâr.`, `≥ %${marj[2]}`),
          metric("marj_trend", "Marj eğilimi", "TrendingUp", r.marjTrend, "puan", [[-5, 0], [-2, 35], [0, 60], [2, 85], [4, 100]],
            r.marjTrend === null ? "Geçen yılla karşılaştırma için veri yok." : `Son 90 günün marjı geçen yıla göre ${r.marjTrend >= 0 ? "+" : ""}${fmtNum(r.marjTrend, 1)} puan.`, "≥ 0"),
          metric("zarar_payi", "Zararına satış", "TriangleAlert", r.zararSatisPayi, "%", [[0, 100], [0.02, 80], [0.1, 30], [0.2, 0]],
            `Son 90 günde cironun ${iyelik(fmtPct(r.zararSatisPayi, 1))} zararına satılan ${r.zararliUrun || 0} üründen.`, "≤ %2"),
        ],
      },
      {
        id: "buyume", ad: "Büyüme", ikon: "Rocket", agirlik: 20,
        olcutler: [
          g.reel !== null
            ? metric("reel_buyume", "Reel büyüme", "Rocket", g.reel, "%", [[-0.3, 0], [-0.1, 30], [0, 50], [0.1, 75], [0.25, 100]],
              `Enflasyondan arındırılmış büyüme ${fmtPct(g.reel, 1)} (nominal ${fmtPct(g.yuzde, 1)}).`, "> %0")
            : metric("nominal_buyume", "Büyüme (nominal)", "Rocket", g.yuzde, "%", [[-0.3, 0], [-0.1, 30], [0, 50], [0.1, 75], [0.25, 100]],
              `Nominal büyüme ${fmtPct(g.yuzde, 1)}. Enflasyon girilmediği için reel değerlendirme yapılamadı.`, "> enflasyon"),
          metric("musteri_buyume", "Müşteri tabanı", "Users", (g.bilesenler.find((b) => b.id === "musteri") || {}).yuzde ?? null, "%",
            [[-0.3, 0], [-0.1, 30], [0, 50], [0.1, 75], [0.25, 100]],
            `Aktif müşteri sayısı ${fmtPct((g.bilesenler.find((b) => b.id === "musteri") || {}).yuzde ?? null, 0)} değişti.`, "> %0"),
          metric("ivme", "İvme", "Gauge", g.ivme ? g.ivme.deger * 100 : null, "puan", [[-20, 0], [-5, 40], [0, 55], [5, 75], [20, 100]],
            g.ivme ? `Son 90 günün yıllık büyümesi genel eğilime göre ${g.ivme.deger >= 0 ? "+" : ""}${fmtNum(g.ivme.deger * 100, 1)} puan.` : "İvme için yeterli geçmiş yok.", "≥ 0"),
        ],
      },
      {
        id: "dongu", ad: "Tahsilat & Döngü", ikon: "RefreshCcw", agirlik: 20,
        olcutler: [
          metric("dso", "Tahsil süresi (DSO)", "Timer", r.dso, "gün", [[15, 100], [30, 85], [60, 60], [90, 35], [150, 0]],
            `Alacaklar ortalama ${fmtNum(r.dso, 0)} günde tahsil ediliyor.`, "≤ 45 gün"),
          metric("tahsilat_orani", "Tahsilat oranı", "HandCoins", r.tahsilatOrani90 === null ? null : r.tahsilatOrani90 / 100, "%", [[0.6, 0], [0.85, 50], [0.95, 75], [1, 90], [1.1, 100]],
            `Son 90 günde satışların ${iyelik(fmtPct(r.tahsilatOrani90 === null ? null : r.tahsilatOrani90 / 100, 0))} kadar tahsilat yapıldı.`, "≥ %95"),
          metric("vadesi_gecen", "Vadesi geçen alacak", "AlarmClock", r.vadesiGecenOran, "%", [[0, 100], [0.1, 75], [0.25, 45], [0.5, 0]],
            `Alacakların ${iyelikTamlayan(fmtPct(r.vadesiGecenOran, 0))} vadesi geçmiş.`, "≤ %10"),
          metric("ccc", "Nakit dönüşüm süresi", "Repeat", r.dio === null ? null : r.ccc, "gün", [[0, 100], [30, 85], [60, 65], [120, 30], [180, 0]],
            `Stok + alacak − borç döngüsü ${fmtNum(r.ccc, 0)} gün.`, "≤ 60 gün"),
        ],
      },
      {
        id: "risk", ad: "Risk", ikon: "ShieldCheck", agirlik: 15,
        olcutler: [
          metric("yogunlasma", "Müşteri yoğunlaşması", "PieChart", r.ilk5Pay, "%", [[0.2, 100], [0.35, 75], [0.5, 50], [0.7, 15], [0.85, 0]],
            `En büyük 5 müşteri cironun ${iyelikBelirtme(fmtPct(r.ilk5Pay, 0))} oluşturuyor.`, "≤ %35"),
          metric("oynaklik", "Satış oynaklığı", "Activity", r.oynaklik, "x", [[0.1, 100], [0.25, 75], [0.4, 50], [0.6, 20], [0.8, 0]],
            `Aylık satışların değişkenlik katsayısı ${fmtNum(r.oynaklik, 2)}.`, "≤ 0,25"),
          metric("kaldirac", "Kaldıraç", "Anchor", r.kaldirac, "x", [[0, 100], [0.25, 80], [0.5, 55], [1, 20], [1.5, 0]],
            `Kredi + verilen çek/senet, likit varlık ve alacakların ${fmtNum(r.kaldirac, 2)} katı.`, "≤ 0,5"),
          metric("karsiliksiz", "Vadesi geçen alınan çek", "FileWarning", r.vadesiGecenCekOran, "%", [[0, 100], [0.05, 70], [0.15, 35], [0.3, 0]],
            `Portföydeki alınan çek/senetlerin ${iyelik(fmtPct(r.vadesiGecenCekOran, 0))} vadesi geçtiği hâlde tahsil edilmemiş.`, "%0"),
        ],
      },
    ];

    let wsum = 0, acc = 0;
    for (const p of pillars) {
      const scored = p.olcutler.filter((m) => m.skor !== null);
      p.skor = scored.length ? S.mean(scored.map((m) => m.skor)) : null;
      p.kapsam = scored.length / p.olcutler.length;
      if (p.skor !== null) { acc += p.skor * p.agirlik; wsum += p.agirlik; }
      Object.assign(p, grade(p.skor ?? 0), { not: p.skor === null ? null : grade(p.skor).not });
    }
    const skor = wsum > 0 ? acc / wsum : null;
    const gr = skor === null ? null : grade(skor);

    // Etki: (skor − 50) × sütun ağırlığı / sütundaki ölçüt sayısı
    const all = [];
    for (const p of pillars) {
      const n = p.olcutler.filter((m) => m.skor !== null).length || 1;
      for (const m of p.olcutler) if (m.skor !== null) all.push({ ...m, sutun: p.id, sutunAd: p.ad, etki: ((m.skor - 50) * p.agirlik) / n });
    }
    const olumlu = all.filter((m) => m.skor >= 65).sort((a, b) => b.etki - a.etki).slice(0, 4);
    const olumsuz = all.filter((m) => m.skor < 50).sort((a, b) => a.etki - b.etki).slice(0, 4);

    const kapsam = wsum / 100;
    const guven = skor === null ? "yok" : g.guven === "yuksek" && kapsam > 0.8 ? "yuksek" : g.guven === "dusuk" || kapsam < 0.5 ? "dusuk" : "orta";
    return {
      skor: skor === null ? null : Math.round(skor),
      ...(gr ? { not: gr.not, etiket: gr.etiket, renk: gr.renk } : { not: null, etiket: "Yetersiz veri", renk: "notr" }),
      sutunlar: pillars.map((p) => ({ ...p, skor: p.skor === null ? null : Math.round(p.skor) })),
      olumlu, olumsuz, guven, kapsam,
    };
  });
}

module.exports = { healthScore, grade, GRADES };
