// Türkçe duyarsız arama: İ/i/I/ı, Ş/s, Ğ/g, Ç/c, Ö/o, Ü/u katlanır.

const ESLEME: Record<string, string> = {
  İ: "i", I: "i", ı: "i", i: "i",
  Ş: "s", ş: "s", Ğ: "g", ğ: "g", Ç: "c", ç: "c", Ö: "o", ö: "o", Ü: "u", ü: "u",
  Â: "a", â: "a", Î: "i", î: "i", Û: "u", û: "u",
};

export function katla(metin: string): string {
  let s = "";
  for (const ch of metin) s += ESLEME[ch] ?? ch.toLowerCase();
  return s;
}

/** Aranan metnin tüm kelimeleri hedefte geçiyorsa true. */
export function eslesir(hedefKatli: string, aranan: string): boolean {
  const kelimeler = katla(aranan).split(/\s+/).filter(Boolean);
  return kelimeler.every((k) => hedefKatli.includes(k));
}
