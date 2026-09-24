// Yanıt önbelleği: aynı yol tekrar istenmez; veri sürümü değişince tümü geçersiz kılınır.

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { api, sorgu } from "../lib/api";
import type { Katalog, RaporParam, RaporYanit } from "../lib/types";

type Kayit = { veri?: unknown; hata?: Error; soz?: Promise<unknown> };

const onbellek = new Map<string, Kayit>();
const kalici = new Map<string, Kayit>(); // katalog gibi sürümden bağımsız yanıtlar
let nesil = 0;
const abone = new Set<() => void>();

export function raporOnbellekTemizle() {
  onbellek.clear();
  nesil++;
  abone.forEach((f) => f());
}

function nesilAbone(f: () => void) {
  abone.add(f);
  return () => {
    abone.delete(f);
  };
}

function getir<T>(yol: string, kaliciMi: boolean): Promise<T> {
  const harita = kaliciMi ? kalici : onbellek;
  const k = harita.get(yol);
  if (k?.veri !== undefined) return Promise.resolve(k.veri as T);
  if (k?.soz) return k.soz as Promise<T>;
  const kayit: Kayit = {};
  kayit.soz = api<T>(yol).then(
    (v) => {
      kayit.veri = v;
      kayit.soz = undefined;
      return v;
    },
    (e: Error) => {
      harita.delete(yol);
      throw e;
    },
  );
  harita.set(yol, kayit);
  return kayit.soz as Promise<T>;
}

export type VeriDurumu<T> = { veri: T | undefined; hata: Error | undefined; yukleniyor: boolean; yenile: () => void };

/** yol null ise istek yapılmaz (ör. kutu henüz görünür değil). */
export function useVeri<T>(yol: string | null, secenek: { kalici?: boolean } = {}): VeriDurumu<T> {
  const n = useSyncExternalStore(nesilAbone, () => nesil);
  const kaliciMi = !!secenek.kalici;
  const hazir = yol ? ((kaliciMi ? kalici : onbellek).get(yol)?.veri as T | undefined) : undefined;
  const [durum, setDurum] = useState<{ yol: string | null; veri?: T; hata?: Error }>({ yol, veri: hazir });
  const [deneme, setDeneme] = useState(0);

  useEffect(() => {
    if (!yol) return;
    let iptal = false;
    const mevcut = (kaliciMi ? kalici : onbellek).get(yol)?.veri as T | undefined;
    // Aynı yol için eski veriyi yenilenirken göstermeye devam et (titremesiz yenileme)
    setDurum((d) => (mevcut !== undefined ? { yol, veri: mevcut } : d.yol === yol ? { yol, veri: d.veri } : { yol }));
    if (mevcut !== undefined) return;
    getir<T>(yol, kaliciMi).then(
      (v) => !iptal && setDurum({ yol, veri: v }),
      (e: Error) => !iptal && setDurum((d) => ({ yol, veri: d.yol === yol ? d.veri : undefined, hata: e })),
    );
    return () => {
      iptal = true;
    };
  }, [yol, n, deneme, kaliciMi]);

  const yenile = useCallback(() => {
    if (yol) (kaliciMi ? kalici : onbellek).delete(yol);
    setDurum((d) => ({ yol: d.yol, veri: d.veri }));
    setDeneme((x) => x + 1);
  }, [yol, kaliciMi]);

  const ayni = durum.yol === yol;
  const veri = ayni ? durum.veri : hazir;
  const hata = ayni ? durum.hata : undefined;
  return { veri, hata, yukleniyor: !!yol && veri === undefined && !hata, yenile };
}

export function raporYolu(id: string, p: RaporParam, firma: string | undefined): string {
  return `/rapor/${encodeURIComponent(id)}${sorgu({ donem: p.donem, bas: p.donem === "ozel" ? p.bas : undefined, bit: p.donem === "ozel" ? p.bit : undefined, n: p.n, kirilim: p.kirilim, firma })}`;
}

export function useRapor(id: string | null, p: RaporParam, firma: string | undefined) {
  return useVeri<RaporYanit>(id ? raporYolu(id, p, firma) : null);
}

export function useKatalog() {
  return useVeri<Katalog>("/raporlar", { kalici: true });
}
