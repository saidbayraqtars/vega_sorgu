// Tüm istekler göreli /api yolu + aynı köken çerezi ile yapılır.

export class ApiHatasi extends Error {
  durum: number;
  constructor(durum: number, mesaj: string) {
    super(mesaj);
    this.durum = durum;
  }
}

type Dinleyici = (durum: number) => void;
const dinleyiciler = new Set<Dinleyici>();

/** 401 (oturum bitti) ve 409 (firma seçilmedi) olaylarını dinle. */
export function oturumOlayi(fn: Dinleyici) {
  dinleyiciler.add(fn);
  return () => {
    dinleyiciler.delete(fn);
  };
}

export async function api<T>(yol: string, secenek: { method?: string; govde?: unknown; sinyal?: AbortSignal; sessiz?: boolean } = {}): Promise<T> {
  const method = secenek.method || "GET";
  let yanit: Response;
  try {
    yanit = await fetch(`/api${yol}`, {
      method,
      credentials: "same-origin",
      headers: secenek.govde !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: secenek.govde !== undefined ? JSON.stringify(secenek.govde) : undefined,
      signal: secenek.sinyal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiHatasi(0, "Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.");
  }
  let veri: unknown = null;
  const metin = await yanit.text();
  if (metin) {
    try {
      veri = JSON.parse(metin);
    } catch {
      veri = null;
    }
  }
  if (!yanit.ok) {
    const mesaj = (veri as { hata?: string } | null)?.hata || varsayilanMesaj(yanit.status);
    if (!secenek.sessiz && (yanit.status === 401 || yanit.status === 409)) dinleyiciler.forEach((fn) => fn(yanit.status));
    throw new ApiHatasi(yanit.status, mesaj);
  }
  return veri as T;
}

function varsayilanMesaj(durum: number) {
  if (durum === 401) return "Oturumunuz sona erdi.";
  if (durum === 403) return "Bu işlem için yetkiniz yok.";
  if (durum === 404) return "Bulunamadı.";
  if (durum === 429) return "Çok fazla deneme. Lütfen biraz bekleyin.";
  return "Bir hata oluştu. Lütfen tekrar deneyin.";
}

/** Sorgu metni üretir; boş değerleri atlar. */
export function sorgu(p: Record<string, string | number | undefined | null>) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const m = s.toString();
  return m ? `?${m}` : "";
}
