const API_BASE = "/api";

export async function apiGet(path, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ).toString();
  const res = await fetch(`${API_BASE}${path}${qs ? `?${qs}` : ""}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || "Sunucu hatası");
  return data;
}

const tl = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatTL(n) {
  return `${tl.format(Number(n) || 0)} ₺`;
}

// Para birimine göre sembollü format — döviz hesapları (EUR/USD/GBP/CHF)
// DB'de TL alanında ham tutar olarak saklanır, para birimi hesap adından tespit edilir.
const CURRENCY_SYMBOL = { TL: "₺", TRY: "₺", EUR: "€", USD: "$", GBP: "£", CHF: "CHF" };
export function formatMoney(n, pb) {
  const key = (pb || "TL").toUpperCase();
  const sym = CURRENCY_SYMBOL[key] || key;
  return `${tl.format(Number(n) || 0)} ${sym}`;
}

export function formatNumber(n, frac = 2) {
  return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: frac, maximumFractionDigits: frac }).format(Number(n) || 0);
}

export function formatDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d) || d.getFullYear() < 1950) return "—";
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
