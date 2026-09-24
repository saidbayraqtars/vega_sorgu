// Panolar: modül düzeyinde depo, iyimser güncelleme, 800 ms gecikmeli kayıt
import { useSyncExternalStore } from "react";
import { api } from "../lib/api";
import type { Kutu, Pano } from "../lib/types";

type Durum = { panolar: Pano[] | null; hata: string | null; kaydediliyor: boolean; kayitHata: string | null };

let durum: Durum = { panolar: null, hata: null, kaydediliyor: false, kayitHata: null };
const abone = new Set<() => void>();
let yukleniyor: Promise<void> | null = null;
const bekleyen = new Map<number, { zaman: number; govde: Partial<Pano> }>();

function ayarla(p: Partial<Durum>) {
  durum = { ...durum, ...p };
  abone.forEach((f) => f());
}

export function panolariYukle(zorla = false): Promise<void> {
  if (yukleniyor && !zorla) return yukleniyor;
  yukleniyor = api<{ panolar: Pano[] }>("/panolar").then(
    (r) => ayarla({ panolar: sirala(r.panolar), hata: null }),
    (e: Error) => {
      yukleniyor = null;
      ayarla({ hata: e.message });
    },
  );
  return yukleniyor;
}

export function panolarSifirlaBellek() {
  yukleniyor = null;
  bekleyen.forEach((b) => window.clearTimeout(b.zaman));
  bekleyen.clear();
  durum = { panolar: null, hata: null, kaydediliyor: false, kayitHata: null };
  abone.forEach((f) => f());
}

function sirala(p: Pano[]) {
  return [...p].sort((a, b) => a.sira - b.sira || a.id - b.id);
}

export function usePanolar(): Durum {
  return useSyncExternalStore(
    (f) => {
      abone.add(f);
      return () => abone.delete(f);
    },
    () => durum,
  );
}

async function gonder(id: number) {
  const b = bekleyen.get(id);
  if (!b) return;
  bekleyen.delete(id);
  ayarla({ kaydediliyor: true, kayitHata: null });
  try {
    const r = await api<{ panolar: Pano[] }>(`/panolar/${id}`, { method: "PUT", govde: b.govde });
    // Sunucu yanıtını yalnız başka bekleyen değişiklik yoksa uygula (kullanıcının yeni düzenlemesini ezme)
    if (!bekleyen.size) ayarla({ panolar: sirala(r.panolar) });
    ayarla({ kaydediliyor: bekleyen.size > 0 });
  } catch (e) {
    ayarla({ kaydediliyor: false, kayitHata: (e as Error).message });
    void panolariYukle(true);
  }
}

/** İyimser güncelleme + gecikmeli kayıt */
export function panoGuncelle(id: number, degisiklik: Partial<Pick<Pano, "ad" | "ikon" | "sira" | "widgets">>, gecikme = 800) {
  if (!durum.panolar) return;
  ayarla({ panolar: durum.panolar.map((p) => (p.id === id ? { ...p, ...degisiklik } : p)) });
  const onceki = bekleyen.get(id);
  if (onceki) window.clearTimeout(onceki.zaman);
  const govde = { ...(onceki?.govde || {}), ...degisiklik };
  const zaman = window.setTimeout(() => void gonder(id), gecikme);
  bekleyen.set(id, { zaman, govde });
}

/** Bekleyen kayıtları hemen gönder (sayfadan çıkarken) */
export async function bekleyenleriGonder() {
  const idler = [...bekleyen.keys()];
  for (const id of idler) {
    const b = bekleyen.get(id);
    if (b) window.clearTimeout(b.zaman);
    await gonder(id);
  }
}

export function kutuEkle(panoId: number, kutu: Kutu) {
  const p = durum.panolar?.find((x) => x.id === panoId);
  if (!p) return;
  panoGuncelle(panoId, { widgets: [...p.widgets, kutu] }, 0);
}

export async function panoOlustur(ad: string, ikon: string): Promise<number> {
  const r = await api<{ id: number; panolar: Pano[] }>("/panolar", { method: "POST", govde: { ad, ikon, widgets: [] } });
  ayarla({ panolar: sirala(r.panolar) });
  return r.id;
}

export async function panoSil(id: number) {
  const b = bekleyen.get(id);
  if (b) window.clearTimeout(b.zaman);
  bekleyen.delete(id);
  const r = await api<{ panolar: Pano[] }>(`/panolar/${id}`, { method: "DELETE" });
  ayarla({ panolar: sirala(r.panolar) });
}

export async function panolariSifirla() {
  bekleyen.forEach((b) => window.clearTimeout(b.zaman));
  bekleyen.clear();
  const r = await api<{ panolar?: Pano[] }>("/panolar/sifirla", { method: "POST", govde: {} });
  if (r.panolar) ayarla({ panolar: sirala(r.panolar) });
  else await panolariYukle(true);
}

export function yeniId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => void bekleyenleriGonder());
}
