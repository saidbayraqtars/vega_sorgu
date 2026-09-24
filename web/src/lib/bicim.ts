// tr-TR biçimlendirme yardımcıları

const tamSayi = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const ondalik1 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
const ondalik2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const bos = "—";
const sayiMi = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** 1.234.567 ₺ */
export function tl(v: number | null | undefined): string {
  if (!sayiMi(v)) return bos;
  return `${tamSayi.format(Math.round(v))} ₺`;
}

/** Kısa sayı: 850 B, 1,2 Mn, 3,4 Mr */
export function kisaSayi(v: number | null | undefined): string {
  if (!sayiMi(v)) return bos;
  const a = Math.abs(v);
  const isaret = v < 0 ? "-" : "";
  if (a >= 1e9) return `${isaret}${ondalik1.format(a / 1e9)} Mr`;
  if (a >= 1e6) return `${isaret}${ondalik1.format(a / 1e6)} Mn`;
  if (a >= 1e4) return `${isaret}${tamSayi.format(a / 1e3)} B`;
  if (a >= 1e3) return `${isaret}${ondalik1.format(a / 1e3)} B`;
  return `${isaret}${ondalik1.format(a)}`;
}

/** Kısa TL: 850 B ₺ */
export function kisaTl(v: number | null | undefined): string {
  if (!sayiMi(v)) return bos;
  return `${kisaSayi(v)} ₺`;
}

export function sayi(v: number | null | undefined, basamak = 0): string {
  if (!sayiMi(v)) return bos;
  if (basamak === 0) return tamSayi.format(Math.round(v));
  return new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: basamak }).format(v);
}

/** Kesir → %12,5 */
export function yuzde(kesir: number | null | undefined, basamak = 1): string {
  if (!sayiMi(kesir)) return bos;
  return yuzdeSayi(kesir * 100, basamak);
}

/** Zaten yüzde olan sayı → %12,5 */
export function yuzdeSayi(v: number | null | undefined, basamak = 1): string {
  if (!sayiMi(v)) return bos;
  const f = basamak === 1 ? ondalik1 : basamak === 2 ? ondalik2 : new Intl.NumberFormat("tr-TR", { maximumFractionDigits: basamak });
  const d = Math.abs(v) >= 100 ? tamSayi.format(v) : f.format(v);
  return `%${d}`;
}

/** İşaretli yüzde: +%33,8 */
export function isaretliYuzde(kesir: number | null | undefined, basamak = 1): string {
  if (!sayiMi(kesir)) return bos;
  const s = yuzde(Math.abs(kesir), basamak);
  return `${kesir > 0 ? "+" : kesir < 0 ? "−" : ""}${s}`;
}

/** Değişim: ▲ %16 / ▼ %4 */
export function degisim(kesir: number | null | undefined, tip: "oran" | "puan" = "oran"): string {
  if (!sayiMi(kesir)) return bos;
  if (tip === "puan") return puan(kesir);
  const ok = kesir > 0 ? "▲" : kesir < 0 ? "▼" : "■";
  const a = Math.abs(kesir) * 100;
  return `${ok} %${a >= 10 ? tamSayi.format(a) : ondalik1.format(a)}`;
}

/** +2,1 puan */
export function puan(v: number | null | undefined): string {
  if (!sayiMi(v)) return bos;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${ondalik1.format(Math.abs(v))} puan`;
}

/** YYYY-MM-DD → 24.09.2026 */
export function tarih(t: string | null | undefined): string {
  if (!t) return bos;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (!m) return t;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

const aylar = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** YYYY-MM → Eyl 2026 ; YYYY-MM-DD → 24 Eyl */
export function kisaTarih(t: string): string {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(t);
  if (!m) return t;
  const ay = aylar[Number(m[2]) - 1] || m[2];
  return m[3] ? `${Number(m[3])} ${ay}` : `${ay} ${m[1]}`;
}

/** ISO zaman damgası → "12 dk önce" */
export function goreliZaman(iso: string | null | undefined, simdi = Date.now()): string {
  if (!iso) return "hiç";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return bos;
  const sn = Math.max(0, Math.round((simdi - t) / 1000));
  if (sn < 60) return "az önce";
  const dk = Math.round(sn / 60);
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.round(dk / 60);
  if (sa < 24) return `${sa} sa önce`;
  const gun = Math.round(sa / 24);
  if (gun < 30) return `${gun} gün önce`;
  return tarih(new Date(t).toISOString().slice(0, 10));
}

export function tarihSaat(iso: string | null | undefined): string {
  if (!iso) return bos;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const dovizSembol: Record<string, string> = { EUR: "€", USD: "$", GBP: "£", CHF: "CHF", JPY: "¥" };

export function doviz(kod: string, v: number): string {
  return `${kod} ${tamSayi.format(Math.round(v))} ${dovizSembol[kod] ?? ""}`.trim();
}

/** Birime göre değer biçimi (rapor `birim`) */
export function birimli(v: number | null | undefined, birim: string | undefined, kisa = false): string {
  if (!sayiMi(v)) return bos;
  switch (birim) {
    case "TL":
      return kisa ? kisaTl(v) : tl(v);
    case "%":
      return yuzdeSayi(v);
    case "gün":
      return `${sayi(v)} gün`;
    case "x":
      return `${sayi(v, 2)}x`;
    case "adet":
      return kisa ? kisaSayi(v) : sayi(v);
    default:
      return kisa ? kisaSayi(v) : sayi(v, 2);
  }
}

/** Sağlık ölçütü değeri — API birim kuralı: % → yüzde sayısı (29.96), puan → yüzde puanı (−9.3), x, gün */
export function olcutDegeri(o: { id: string; deger: number | null; birim: string }): string {
  const v = o.deger;
  if (!sayiMi(v)) return bos;
  switch (o.birim) {
    case "%":
      return yuzdeSayi(v);
    case "puan":
      return puan(v);
    case "x":
      return `${sayi(v, 2)}x`;
    case "gün":
      return `${sayi(v)} gün`;
    default:
      return sayi(v, 2);
  }
}
