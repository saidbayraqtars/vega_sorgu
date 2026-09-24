// Sunucunun gönderebileceği her lucide ikon adı arayüzün eşleme dosyasında olmalı
// (web/src/lib/ikonlar.ts; eşlemede olmayan ad arayüzde boş daire olarak görünür).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const CAT = require("../src/engine/catalog");
const { MEASURES, DIMENSIONS } = require("../src/engine/model");
const P = require("../src/engine/period");
const { defaultBoards } = require("../src/routes/boards");

const WEB = path.join(__dirname, "..", "..", "web", "src", "lib", "ikonlar.ts");
const SRC = path.join(__dirname, "..", "src");

function sunucuIkonlari() {
  const set = new Set(["CalendarSearch", "LayoutGrid"]); // /api/meta özel dönem, yeni pano varsayılanı
  for (const k of CAT.KATEGORILER) set.add(k.ikon);
  for (const r of CAT.catalog()) set.add(r.ikon);
  for (const m of Object.values(MEASURES)) set.add(m.ikon);
  for (const d of Object.values(DIMENSIONS)) set.add(d.ikon);
  for (const p of Object.values(P.PRESETS)) set.add(p.ikon);
  for (const b of defaultBoards()) set.add(b.ikon);
  // Motorun ürettiği ikonlar (uyarılar, sağlık sütun/ölçütleri, büyüme bileşenleri, RFM segmentleri)
  for (const f of ["engine/alerts.js", "engine/health.js", "engine/growth.js", "engine/segments.js"]) {
    const s = fs.readFileSync(path.join(SRC, f), "utf8");
    for (const m of s.matchAll(/ikon: (?:[^"\n]*\? )?"(\w+)"(?: : "(\w+)")?/g)) { set.add(m[1]); if (m[2]) set.add(m[2]); }
    for (const m of s.matchAll(/metric\("\w+", "[^"]+", "(\w+)"/g)) set.add(m[1]);
  }
  set.delete(undefined);
  return set;
}

test("sunucu ikonları arayüz eşlemesinde", { skip: !fs.existsSync(WEB) && "web/ yok" }, () => {
  const fe = fs.readFileSync(WEB, "utf8");
  const blok = /export const IKONLAR[^{]*\{([\s\S]*?)\n\};/.exec(fe);
  assert.ok(blok, "IKONLAR eşlemesi bulunamadı");
  const tanimli = new Set([...blok[1].matchAll(/^\s+(\w+)(?::\s*\w+)?,\s*$/gm)].map((m) => m[1]));
  const ikonlar = sunucuIkonlari();
  assert.ok(ikonlar.size > 100, `yalnız ${ikonlar.size} ikon toplandı`);
  const eksik = [...ikonlar].filter((k) => !tanimli.has(k)).sort();
  assert.deepEqual(eksik, [], `web/src/lib/ikonlar.ts dosyasına ekleyin: ${eksik.join(", ")}`);
});
