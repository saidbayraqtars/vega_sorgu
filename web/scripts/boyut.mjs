// İlk yükleme JS bütçesi denetimi: index.html'in doğrudan yüklediği JS (script + modulepreload) gzip ≤ 250 KB
import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const html = readFileSync(join(dist, "index.html"), "utf8");
const ilk = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
const kb = (f) => gzipSync(readFileSync(join(dist, f))).length / 1024;

let toplam = 0;
for (const f of ilk) {
  const k = kb(f);
  toplam += k;
  console.log(`ilk   ${f.padEnd(44)} ${k.toFixed(1)} KB gzip`);
}
for (const f of readdirSync(join(dist, "assets")).filter((f) => f.endsWith(".js") && !ilk.includes(`assets/${f}`))) {
  console.log(`tembel assets/${f.padEnd(37)} ${kb(`assets/${f}`).toFixed(1)} KB gzip`);
}
console.log(`\nİlk yükleme JS: ${toplam.toFixed(1)} KB gzip (bütçe 250 KB)`);
if (toplam > 250) {
  console.error("Bütçe aşıldı!");
  process.exit(1);
}
