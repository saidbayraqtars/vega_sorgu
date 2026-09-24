#!/usr/bin/env node
// Rapor kataloğunu belgeye döker → docs/RAPORLAR.md
//   node cloud/scripts/raporlar-md.js
// Katalog koddan üretildiği için belge de koddan üretilir (elle düzenlemeyin).

const fs = require("fs");
const path = require("path");
const CAT = require("../src/engine/catalog");
const { MEASURES, DIMENSIONS, dimsForMeasure } = require("../src/engine/model");

const list = CAT.catalog();
const kat = Object.fromEntries(CAT.KATEGORILER.map((k) => [k.id, k]));
const n = (x) => x.toLocaleString("tr-TR");
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

const GORUNUM = {
  kpi: ["Gösterge", "Tek sayı; önceki dönem ve geçen yılın aynı dönemiyle değişim, mini grafik"],
  trend: ["Eğilim", "Zaman serisi (gün · hafta · ay · çeyrek · yıl kırılımı)"],
  yoy: ["Geçen yılla", "Bu dönem ile geçen yılın aynı dönemi üst üste"],
  kumulatif: ["Birikimli", "Yıl başından birikimli toplam, geçen yılın eğrisiyle"],
  isi: ["Isı haritası", "Haftanın günü × hafta: yoğun ve durgun günler"],
  mevsim: ["Mevsimsellik", "Ay × yıl ısı haritası"],
  top: ["Sıralama", "Boyuta göre en yüksek N (ör. en çok satan 10 ürün) + diğerleri"],
  pay: ["Pay", "Toplam içindeki paylar (pasta · ağaç haritası)"],
  karsilastir: ["Karşılaştırma", "Önceki döneme göre en çok artan / azalanlar"],
  pareto: ["Pareto / ABC", "Kümülatif pay ve A-B-C sınıfları"],
  dagilim: ["Dağılım", "Haftanın günü, ay, saat gibi takvim kırılımları"],
};
const TUR = { kpi: "Gösterge", seri: "Zaman serisi", kategori: "Kırılım", matris: "Isı haritası", tablo: "Tablo", coklu: "Grafik + tablo",
  saglik: "Sağlık skoru", buyume: "Büyüme endeksi", durum: "Bilanço", projeksiyon: "Projeksiyon" };
const DONEM = { bugun: "Bugün", dun: "Dün", bu_hafta: "Bu hafta", bu_ay: "Bu ay", gecen_ay: "Geçen ay", son30: "Son 30 gün", son90: "Son 90 gün",
  bu_ceyrek: "Bu çeyrek", bu_yil: "Bu yıl", gecen_yil: "Geçen yıl", son12: "Son 12 ay", tumu: "Tüm zamanlar" };

const L = [];
L.push(`# Rapor Kataloğu — ${n(list.length)} rapor`, "");
L.push("> Bu belge `node cloud/scripts/raporlar-md.js` ile koddan üretilir; elle düzenlemeyin.", "> Her rapor panelde bir kutu olarak panoya eklenebilir; grafik türü, dönem ve N (ilk kaç) kullanıcı tarafından değiştirilebilir.", "");
L.push("Raporlar üç kaynaktan oluşur:", "");
const olcuRap = list.filter((r) => !r.ozel).length;
L.push(`1. **Ölçü × görünüm** — ${Object.keys(MEASURES).length} ölçünün her biri gösterge, eğilim, geçen yılla karşılaştırma, birikimli, ısı haritası, mevsimsellik görünümleriyle;`);
L.push(`2. **Ölçü × boyut × görünüm** — ölçüler ${Object.keys(DIMENSIONS).length} boyutta (müşteri, ürün, il, temsilci, kasa, banka hesabı…) sıralama, pay, karşılaştırma, Pareto ve dağılım olarak;`);
L.push(`3. **Özel analizler** — ${list.filter((r) => r.ozel).length} rapor: sağlık skoru, büyüme endeksi, anlık bilanço, nakit projeksiyonu, yaşlandırma, RFM, ABC, vade takvimi, tahmin…`, "");
L.push(`Toplam: ${n(olcuRap)} ölçü tabanlı + ${n(list.length - olcuRap)} özel = **${n(list.length)}** rapor.`, "");

L.push("## Kategoriler", "", "| Kategori | Simge | Rapor |", "|---|---|---:|");
for (const k of CAT.KATEGORILER) L.push(`| ${k.ad} | \`${k.ikon}\` | ${n(list.filter((r) => r.kategori === k.id).length)} |`);
L.push("");

L.push("## Görünümler", "", "| Görünüm | Açıklama | Rapor |", "|---|---|---:|");
for (const [id, [ad, acik]] of Object.entries(GORUNUM)) L.push(`| ${ad} | ${acik} | ${n(list.filter((r) => !r.ozel && r.gorunum === id).length)} |`);
L.push(`| Özel | Aşağıdaki özel analizler | ${n(list.filter((r) => r.ozel).length)} |`, "");

L.push(`## Ölçüler (${Object.keys(MEASURES).length})`, "", "| Ölçü | Birim | Kategori | Kırılabildiği boyutlar | Tanım |", "|---|---|---|---|---|");
for (const [id, m] of Object.entries(MEASURES)) {
  const dims = dimsForMeasure(id).map((d) => DIMENSIONS[d].ad).join(", ");
  L.push(`| **${esc(m.ad)}** \`${id}\` | ${m.birim} | ${kat[m.kat] ? kat[m.kat].ad : m.kat} | ${dims || "—"} | ${esc(m.aciklama)} |`);
}
L.push("");

L.push(`## Boyutlar (${Object.keys(DIMENSIONS).length})`, "", "| Boyut | Simge |", "|---|---|");
for (const [id, d] of Object.entries(DIMENSIONS)) L.push(`| ${d.ad} \`${id}\` | \`${d.ikon}\` |`);
L.push("");

L.push(`## Özel analizler (${list.filter((r) => r.ozel).length})`, "", "Dönem sütunu: *anlık* = dönem seçimi uygulanmaz (güncel bakiye ya da sabit pencere). İlk N: varsayılan satır sayısı.", "",
  "| Rapor | Kimlik | Sonuç | Dönem | İlk N | Açıklama |", "|---|---|---|---|---:|---|");
for (const r of list.filter((x) => x.ozel)) {
  L.push(`| **${esc(r.ad)}** | \`${r.id}\` | ${TUR[r.tur] || r.tur} | ${r.donemsiz ? "anlık" : DONEM[r.donem] || r.donem} | ${r.n || "—"} | ${esc(r.aciklama)} |`);
}
L.push("");

L.push("## Tüm raporlar", "");
for (const k of CAT.KATEGORILER) {
  const rs = list.filter((r) => r.kategori === k.id);
  if (!rs.length) continue;
  L.push(`<details><summary><b>${k.ad}</b> — ${n(rs.length)} rapor</summary>`, "", "| Rapor | Kimlik | Sonuç | Varsayılan dönem | Grafikler |", "|---|---|---|---|---|");
  for (const r of rs) L.push(`| ${esc(r.ad)} | \`${r.id}\` | ${TUR[r.tur] || r.tur} | ${r.donemsiz ? "— (anlık)" : DONEM[r.donem] || r.donem || "—"} | ${r.grafikler.join(", ")} |`);
  L.push("", "</details>", "");
}

const out = path.join(__dirname, "..", "..", "docs", "RAPORLAR.md");
fs.writeFileSync(out, L.join("\n"));
console.log(`${out}: ${n(list.length)} rapor, ${n(fs.statSync(out).size)} bayt`);
