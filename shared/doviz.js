// Döviz hesabı / kasası tespiti (Vega Kılavuzu §9.2).
// Bu veritabanlarında banka/kasa PARABIRIMI çoğu zaman 'TL' ve KUR≈1 kayıtlıdır;
// döviz hesapları çoğunlukla yalnızca ADINDA belli olur (İÇ KASA EURO, HALKBANK-STERLİN).
// PARABIRIMI bazen sembol olarak (€, $, £, ₺) kayıtlıdır.

const SYM = { "€": "EUR", "$": "USD", "£": "GBP", "₺": "TL", "TRY": "TL", "YTL": "TL", "TL": "TL" };

function normPb(pb) {
  const s = String(pb || "").trim().toUpperCase();
  if (!s) return "TL";
  return SYM[s] || s;
}

function detectDoviz(name, parabirimi) {
  const norm = normPb(parabirimi);
  if (norm && norm !== "TL") return norm; // gerçek döviz alanı öncelikli
  const s = String(name || "").toLocaleUpperCase("tr-TR");
  if (/\bEUR(O)?\b|AVRO/.test(s)) return "EUR";
  if (/DOLAR|DOLLAR|\bUSD\b/.test(s)) return "USD";
  if (/STERL[İI]N|\bGBP\b|POUND/.test(s)) return "GBP";
  if (/FRANK|\bCHF\b/.test(s)) return "CHF";
  return null; // TL
}

module.exports = { detectDoviz, normPb };
