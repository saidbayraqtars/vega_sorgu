// Uygulama geneli durum: oturum, meta, firma/dönem seçimi, tema, veri sürümü yoklaması.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, oturumOlayi } from "../lib/api";
import type { Kullanici, Meta, Surum, Tema } from "../lib/types";
import { raporOnbellekTemizle } from "./rapor";

export type DonemSecimi = { kod: string; bas?: string; bit?: string };

type UygulamaCtx = {
  kullanici: Kullanici | null | undefined; // undefined = yükleniyor
  meta: Meta | null;
  metaHata: string | null;
  firmalar: string[]; // [] = varsayılan (etkin firmalar), ["hepsi"] = tümü
  firmaParam: string | undefined;
  donem: DonemSecimi;
  tema: Tema;
  koyu: boolean;
  veriSurumu: number;
  surum: Surum | null;
  bildirim: string | null;
  girisYapildi: (k: Kullanici) => void;
  cikis: () => Promise<void>;
  benYenile: () => Promise<void>;
  metaYenile: () => Promise<void>;
  setFirmalar: (f: string[]) => void;
  setDonem: (d: DonemSecimi) => void;
  setTema: (t: Tema) => void;
  surumYokla: () => Promise<void>;
  bildir: (m: string) => void;
};

const Ctx = createContext<UygulamaCtx | null>(null);

// Tarayıcıda yalnız tema tutulur (girişten önceki ilk boyama için); diğer tercihler sunucuda
const YEREL = "vb_tercih";
type Yerel = { tema?: Tema };

function yerelOku(): Yerel {
  try {
    return JSON.parse(localStorage.getItem(YEREL) || "{}") as Yerel;
  } catch {
    return {};
  }
}
function yerelYaz(p: Partial<Yerel>) {
  try {
    localStorage.setItem(YEREL, JSON.stringify({ ...yerelOku(), ...p }));
  } catch {
    /* gizli sekme vb. */
  }
}

function sistemKoyu() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

export function UygulamaSaglayici({ children }: { children: ReactNode }) {
  const [kullanici, setKullanici] = useState<Kullanici | null | undefined>(undefined);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metaHata, setMetaHata] = useState<string | null>(null);
  const [firmalar, setFirmalarS] = useState<string[]>([]);
  const [donem, setDonemS] = useState<DonemSecimi>({ kod: "bu_ay" });
  const [tema, setTemaS] = useState<Tema>(() => yerelOku().tema || "sistem");
  const [sistem, setSistem] = useState<boolean>(sistemKoyu);
  const [veriSurumu, setVeriSurumu] = useState(0);
  const [surum, setSurum] = useState<Surum | null>(null);
  const [bildirim, setBildirim] = useState<string | null>(null);
  const bildirimZaman = useRef<number | undefined>(undefined);

  const koyu = tema === "koyu" || (tema === "sistem" && sistem);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const f = () => setSistem(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", koyu);
    document.documentElement.style.colorScheme = koyu ? "dark" : "light";
  }, [koyu]);

  const bildir = useCallback((m: string) => {
    setBildirim(m);
    window.clearTimeout(bildirimZaman.current);
    bildirimZaman.current = window.setTimeout(() => setBildirim(null), 4000);
  }, []);

  const tercihUygula = useCallback((k: Kullanici) => {
    const t = k.tercihler || {};
    if (t.tema) {
      setTemaS(t.tema);
      yerelYaz({ tema: t.tema });
    }
    const f = Array.isArray(t.firmalar) ? t.firmalar : [];
    setFirmalarS(f.includes("hepsi") ? ["hepsi"] : f);
    if (t.donem) setDonemS(t.donem === "ozel" ? (t.donemBas && t.donemBit ? { kod: "ozel", bas: t.donemBas, bit: t.donemBit } : { kod: "bu_ay" }) : { kod: t.donem });
  }, []);

  const metaYenile = useCallback(async () => {
    try {
      setMetaHata(null);
      const m = await api<Meta>("/meta");
      setMeta(m);
      setVeriSurumu(m.veriSurumu);
    } catch (e) {
      setMeta(null);
      setMetaHata((e as Error).message);
    }
  }, []);

  const benYenile = useCallback(async () => {
    try {
      const r = await api<{ kullanici: Kullanici }>("/auth/ben", { sessiz: true });
      setKullanici(r.kullanici);
      tercihUygula(r.kullanici);
    } catch {
      setKullanici(null);
    }
  }, [tercihUygula]);

  useEffect(() => {
    void benYenile();
  }, [benYenile]);

  // Oturum/firma değişince meta yükle
  const gorunenId = kullanici?.gorunenFirma?.id;
  useEffect(() => {
    if (!kullanici) {
      setMeta(null);
      return;
    }
    if (!gorunenId) {
      setMeta(null);
      return;
    }
    raporOnbellekTemizle();
    void metaYenile();
  }, [kullanici, gorunenId, metaYenile]);

  useEffect(
    () =>
      oturumOlayi((durum) => {
        if (durum === 401) {
          raporOnbellekTemizle();
          setKullanici(null);
        }
      }),
    [],
  );

  const girisYapildi = useCallback(
    (k: Kullanici) => {
      raporOnbellekTemizle();
      setKullanici(k);
      tercihUygula(k);
    },
    [tercihUygula],
  );

  const cikis = useCallback(async () => {
    try {
      await api("/auth/cikis", { method: "POST", govde: {} });
    } catch {
      /* yine de çık */
    }
    raporOnbellekTemizle();
    setKullanici(null);
    setMeta(null);
  }, []);

  const tercihKaydet = useCallback((t: Record<string, unknown>) => {
    void api("/auth/tercihler", { method: "PUT", govde: t }).catch(() => undefined);
  }, []);

  const setFirmalar = useCallback(
    (f: string[]) => {
      const secim = f.includes("hepsi") ? ["hepsi"] : f;
      setFirmalarS(secim);
      tercihKaydet({ firmalar: secim });
    },
    [tercihKaydet],
  );

  const setDonem = useCallback(
    (d: DonemSecimi) => {
      setDonemS(d);
      tercihKaydet(d.kod === "ozel" ? { donem: "ozel", donemBas: d.bas, donemBit: d.bit } : { donem: d.kod, donemBas: null, donemBit: null });
    },
    [tercihKaydet],
  );

  const setTema = useCallback(
    (t: Tema) => {
      setTemaS(t);
      yerelYaz({ tema: t });
      tercihKaydet({ tema: t });
    },
    [tercihKaydet],
  );

  const firmaParam = firmalar.includes("hepsi") ? "hepsi" : firmalar.length ? firmalar.join(",") : undefined;

  // Veri sürümü yoklaması (60 sn; sekme gizliyken durur). Uyarı özeti firma seçimine bağlı:
  // seçim değişince yoklama hemen yinelenir.
  const veriSurumuRef = useRef(veriSurumu);
  veriSurumuRef.current = veriSurumu;
  const surumYokla = useCallback(async () => {
    try {
      const s = await api<Surum>(firmaParam ? `/surum?firma=${encodeURIComponent(firmaParam)}` : "/surum");
      setSurum(s);
      if (veriSurumuRef.current && s.veriSurumu !== veriSurumuRef.current) {
        raporOnbellekTemizle();
        setVeriSurumu(s.veriSurumu);
        bildir("Veriler güncellendi");
      } else if (!veriSurumuRef.current) setVeriSurumu(s.veriSurumu);
    } catch {
      /* 401 dinleyicisi halleder */
    }
  }, [bildir, firmaParam]);

  const hazir = !!meta;
  useEffect(() => {
    if (!hazir) return;
    let zamanlayici: number | undefined;
    const baslat = () => {
      window.clearInterval(zamanlayici);
      if (document.visibilityState === "visible") {
        void surumYokla();
        zamanlayici = window.setInterval(() => void surumYokla(), 60000);
      }
    };
    baslat();
    document.addEventListener("visibilitychange", baslat);
    return () => {
      window.clearInterval(zamanlayici);
      document.removeEventListener("visibilitychange", baslat);
    };
  }, [hazir, surumYokla]);

  const deger = useMemo<UygulamaCtx>(
    () => ({
      kullanici, meta, metaHata, firmalar, firmaParam, donem, tema, koyu, veriSurumu, surum, bildirim,
      girisYapildi, cikis, benYenile, metaYenile, setFirmalar, setDonem, setTema, surumYokla, bildir,
    }),
    [kullanici, meta, metaHata, firmalar, firmaParam, donem, tema, koyu, veriSurumu, surum, bildirim,
      girisYapildi, cikis, benYenile, metaYenile, setFirmalar, setDonem, setTema, surumYokla, bildir],
  );
  return <Ctx.Provider value={deger}>{children}</Ctx.Provider>;
}

export function useUygulama(): UygulamaCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("UygulamaSaglayici yok");
  return c;
}
