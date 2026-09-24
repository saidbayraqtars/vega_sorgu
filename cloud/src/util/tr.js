// Türkçe biçimlendirme ve ek (iyelik) yardımcıları.
// "%37'si", "%25'ini", "%10'u" — sayının okunuşunun son kelimesine göre ünlü uyumu.

const BIRLER = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const ONLAR = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
// 3. tekil iyelik eki (sayı kelimesinden sonra)
const IYELIK = {
  sıfır: "ı", bir: "i", iki: "si", üç: "ü", dört: "ü", beş: "i", altı: "sı", yedi: "si", sekiz: "i", dokuz: "u",
  on: "u", yirmi: "si", otuz: "u", kırk: "ı", elli: "si", altmış: "ı", yetmiş: "i", seksen: "i", doksan: "ı",
  yüz: "ü", bin: "i", milyon: "u", milyar: "ı",
};

function sonKelime(n) {
  n = Math.abs(Math.trunc(n));
  if (n === 0) return "sıfır";
  if (n % 10) return BIRLER[n % 10];
  if (n % 100) return ONLAR[(n % 100) / 10];
  if (n % 1000) return "yüz";
  if (n % 1e6) return "bin";
  if (n % 1e9) return "milyon";
  return "milyar";
}

// Metin olarak yazılmış sayının ("37", "0,5", "1.250") son okunan kelimesi
function sonKelimeMetin(s) {
  const str = String(s).replace(/[^\d,]/g, "");
  const [tam, kesir] = str.split(",");
  if (kesir && /[1-9]/.test(kesir)) return sonKelime(Number(kesir.replace(/0+$/, "")));
  return sonKelime(Number(tam || 0));
}

// iyelik: "%37" → "%37'si"; iyelikBelirtme: "%37'sini"
function iyelik(sayiMetni) {
  return `${sayiMetni}'${IYELIK[sonKelimeMetin(sayiMetni)] || "i"}`;
}
// tamlayan: "%37" → "%37'sinin"
function iyelikTamlayan(sayiMetni) {
  const e = IYELIK[sonKelimeMetin(sayiMetni)] || "i";
  const v = e[e.length - 1];
  return `${sayiMetni}'${e}n${v}n`;
}
function iyelikBelirtme(sayiMetni) {
  const e = IYELIK[sonKelimeMetin(sayiMetni)] || "i";
  const v = e[e.length - 1];
  return `${sayiMetni}'${e}n${v}`;
}

const nf = (d) => new Intl.NumberFormat("tr-TR", { maximumFractionDigits: d, minimumFractionDigits: 0 });
function yuzde(x, d = 0) {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return `%${nf(d).format(Math.abs(x) * 100)}`;
}
function tl(v) { return `${nf(0).format(Math.round(Number(v) || 0))} ₺`; }
function sayi(v, d = 0) { return v === null || v === undefined || !Number.isFinite(v) ? "—" : nf(d).format(v); }

module.exports = { iyelik, iyelikBelirtme, iyelikTamlayan, yuzde, tl, sayi, sonKelime };
