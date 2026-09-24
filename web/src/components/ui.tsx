// Ortak küçük arayüz parçaları

import { Component, createElement, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ErrorInfo, type ReactNode } from "react";
import { CircleHelp, RotateCcw, Inbox, X, TriangleAlert } from "lucide-react";
import { ikonBul } from "../lib/ikonlar";
import { degisim as degisimBicim } from "../lib/bicim";
import type { Iyi } from "../lib/types";

export function cx(...s: (string | false | null | undefined)[]) {
  return s.filter(Boolean).join(" ");
}

/** Sunucudan gelen lucide adıyla ikon */
export function Ikon({ ad, className, boyut = 20, ...kalan }: { ad: string | null | undefined; className?: string; boyut?: number; "aria-hidden"?: boolean }) {
  return createElement(ikonBul(ad), { size: boyut, className, "aria-hidden": true, ...kalan });
}

type IkonDugmeProps = ButtonHTMLAttributes<HTMLButtonElement> & { etiket: string; children: ReactNode; aktif?: boolean };

/** Yalnız ikon olan düğme: aria-label + title zorunlu */
export function IkonDugme({ etiket, children, className, aktif, ...kalan }: IkonDugmeProps) {
  return (
    <button
      type="button"
      aria-label={etiket}
      title={etiket}
      className={cx(
        "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-soluk transition hover:bg-kart2 hover:text-yazi disabled:opacity-40",
        aktif && "bg-marka-yumusak text-marka",
        className,
      )}
      {...kalan}
    >
      {children}
    </button>
  );
}

export function Dugme({ children, className, tur = "ikincil", ...kalan }: ButtonHTMLAttributes<HTMLButtonElement> & { tur?: "birincil" | "ikincil" | "tehlike" | "hayalet" }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        tur === "birincil" && "bg-marka text-white hover:brightness-110 dark:text-[#0b1020]",
        tur === "ikincil" && "border border-cizgi bg-kart text-yazi hover:bg-kart2",
        tur === "tehlike" && "bg-kotu text-white hover:brightness-110 dark:text-[#0b1020]",
        tur === "hayalet" && "text-soluk hover:bg-kart2 hover:text-yazi",
        className,
      )}
      {...kalan}
    >
      {children}
    </button>
  );
}

export function Kart({ children, className, ...kalan }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-2xl border border-cizgi bg-kart shadow-[0_1px_2px_rgba(16,24,40,.04)]", className)} {...kalan}>
      {children}
    </div>
  );
}

export function Iskelet({ className }: { className?: string }) {
  return <div className={cx("iskelet", className)} aria-hidden />;
}

export function KutuIskelet({ yukseklik = "h-40" }: { yukseklik?: string }) {
  return (
    <div className="flex flex-col gap-3 p-1" role="status" aria-label="Yükleniyor">
      <Iskelet className="h-8 w-1/2" />
      <Iskelet className={cx("w-full", yukseklik)} />
    </div>
  );
}

export function VeriYok({ mesaj = "Veri yok" }: { mesaj?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-soluk" data-bos>
      <Inbox size={32} aria-hidden />
      <span className="text-sm">{mesaj}</span>
    </div>
  );
}

export function HataKutusu({ mesaj, yenile }: { mesaj?: string; yenile?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-kotu" role="alert">
      <TriangleAlert size={28} aria-hidden />
      <span className="max-w-xs text-sm">{mesaj || "Yüklenemedi"}</span>
      {yenile && (
        <Dugme tur="ikincil" onClick={yenile} className="mt-1">
          <RotateCcw size={16} aria-hidden /> Yeniden dene
        </Dugme>
      )}
    </div>
  );
}

/** Bir kutunun hatası sayfayı çökertmesin */
export class HataSiniri extends Component<{ children: ReactNode; sifirla?: unknown }, { hata: Error | null; sifirla?: unknown }> {
  state: { hata: Error | null; sifirla?: unknown } = { hata: null, sifirla: this.props.sifirla };
  static getDerivedStateFromError(hata: Error) {
    return { hata };
  }
  static getDerivedStateFromProps(p: { sifirla?: unknown }, s: { hata: Error | null; sifirla?: unknown }) {
    if (p.sifirla !== s.sifirla) return { hata: null, sifirla: p.sifirla };
    return null;
  }
  componentDidCatch(hata: Error, bilgi: ErrorInfo) {
    console.warn("Kutu hatası:", hata.message, bilgi.componentStack?.split("\n")[1]);
  }
  render() {
    if (this.state.hata) return <HataKutusu mesaj="Bu kutu gösterilemedi" yenile={() => this.setState({ hata: null })} />;
    return this.props.children;
  }
}

export type AnlamRenk = "iyi" | "orta" | "zayif" | "kritik" | "kotu" | "notr" | "mor";

export function renkSinif(r: string | null | undefined): { yazi: string; zemin: string; dolgu: string } {
  switch (r) {
    case "iyi":
      return { yazi: "text-iyi", zemin: "bg-iyi-zemin", dolgu: "bg-iyi" };
    case "orta":
      return { yazi: "text-orta", zemin: "bg-orta-zemin", dolgu: "bg-orta" };
    case "zayif":
      return { yazi: "text-zayif", zemin: "bg-zayif-zemin", dolgu: "bg-zayif" };
    case "kritik":
    case "kotu":
      return { yazi: "text-kotu", zemin: "bg-kotu-zemin", dolgu: "bg-kotu" };
    case "mor":
      return { yazi: "text-mor", zemin: "bg-marka-yumusak", dolgu: "bg-mor" };
    default:
      return { yazi: "text-notr", zemin: "bg-notr-zemin", dolgu: "bg-notr" };
  }
}

/** Değişimin anlamı: işaret × iyi yönü */
export function degisimRengi(v: number | null | undefined, iyi: Iyi | undefined = "yukari"): AnlamRenk {
  if (v === null || v === undefined || !Number.isFinite(v) || Math.abs(v) < 1e-9 || iyi === "notr") return "notr";
  const artis = v > 0;
  return (iyi === "asagi" ? !artis : artis) ? "iyi" : "kotu";
}

export function DegisimRozeti({ deger, iyi, tip = "oran", etiket, kucuk }: { deger: number | null | undefined; iyi?: Iyi; tip?: "oran" | "puan"; etiket?: string; kucuk?: boolean }) {
  if (deger === null || deger === undefined || !Number.isFinite(deger)) return null;
  const r = renkSinif(degisimRengi(deger, iyi));
  return (
    <span
      className={cx("inline-flex items-center gap-1 rounded-lg font-semibold rakam whitespace-nowrap", r.yazi, r.zemin, kucuk ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm")}
      title={etiket}
    >
      {degisimBicim(deger, tip)}
      {etiket && <span className="font-normal opacity-80">{etiket}</span>}
    </span>
  );
}

export function Rozet({ children, renk = "notr", className }: { children: ReactNode; renk?: string; className?: string }) {
  const r = renkSinif(renk);
  return <span className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", r.yazi, r.zemin, className)}>{children}</span>;
}

/** "?" açılır açıklama balonu */
export function Yardim({ metin, etiket = "Açıklama", className }: { metin: ReactNode; etiket?: string; className?: string }) {
  const [acik, setAcik] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!acik) return;
    const kapat = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAcik(false);
    };
    const tus = (e: KeyboardEvent) => e.key === "Escape" && setAcik(false);
    document.addEventListener("pointerdown", kapat);
    document.addEventListener("keydown", tus);
    return () => {
      document.removeEventListener("pointerdown", kapat);
      document.removeEventListener("keydown", tus);
    };
  }, [acik]);
  return (
    <span ref={ref} className={cx("relative inline-flex", className)}>
      <button
        type="button"
        aria-label={etiket}
        title={etiket}
        aria-expanded={acik}
        aria-describedby={acik ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setAcik((a) => !a);
        }}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-soluk hover:bg-kart2 hover:text-yazi"
      >
        <CircleHelp size={16} aria-hidden />
      </button>
      {acik && (
        <span
          id={id}
          role="tooltip"
          className="absolute top-8 right-0 z-40 w-64 max-w-[80vw] rounded-xl border border-cizgi bg-kart p-3 text-left text-sm font-normal text-yazi shadow-xl"
        >
          {metin}
        </span>
      )}
    </span>
  );
}

/** Sağdan açılan yan panel (telefonda tam ekran) */
export function Cekmece({ acik, kapat, baslik, ikon, children, genis }: { acik: boolean; kapat: () => void; baslik: ReactNode; ikon?: string; children: ReactNode; genis?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!acik) return;
    const onceki = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const tus = (e: KeyboardEvent) => e.key === "Escape" && kapat();
    document.addEventListener("keydown", tus);
    const tasma = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tus);
      document.body.style.overflow = tasma;
      onceki?.focus?.();
    };
  }, [acik, kapat]);
  if (!acik) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={typeof baslik === "string" ? baslik : undefined}>
      <div className="absolute inset-0 bg-black/40" onClick={kapat} aria-hidden />
      <div
        ref={ref}
        tabIndex={-1}
        className={cx("relative flex h-full w-full flex-col bg-zemin shadow-2xl outline-none", genis ? "sm:max-w-3xl" : "sm:max-w-lg")}
      >
        <div className="flex items-center gap-3 border-b border-cizgi bg-kart px-4 py-3">
          {ikon && <Ikon ad={ikon} boyut={22} className="text-marka" />}
          <h2 className="min-w-0 flex-1 truncate text-lg font-bold">{baslik}</h2>
          <IkonDugme etiket="Kapat" onClick={kapat}>
            <X size={22} aria-hidden />
          </IkonDugme>
        </div>
        <div className="ince-kaydirma flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

/** Ortada açılan küçük pencere */
export function Pencere({ acik, kapat, baslik, children, alt }: { acik: boolean; kapat: () => void; baslik: string; children: ReactNode; alt?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!acik) return;
    const onceki = document.activeElement as HTMLElement | null;
    const ilk = ref.current?.querySelector<HTMLElement>("input,select,textarea,button:not([data-kapat])");
    (ilk || ref.current)?.focus();
    const tus = (e: KeyboardEvent) => e.key === "Escape" && kapat();
    document.addEventListener("keydown", tus);
    return () => {
      document.removeEventListener("keydown", tus);
      onceki?.focus?.();
    };
  }, [acik, kapat]);
  if (!acik) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={baslik}>
      <div className="absolute inset-0 bg-black/40" onClick={kapat} aria-hidden />
      <div ref={ref} tabIndex={-1} className="relative m-0 flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-kart shadow-2xl outline-none sm:m-4 sm:max-w-md sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b border-cizgi px-4 py-3">
          <h2 className="flex-1 text-lg font-bold">{baslik}</h2>
          <IkonDugme etiket="Kapat" onClick={kapat} data-kapat>
            <X size={20} aria-hidden />
          </IkonDugme>
        </div>
        <div className="ince-kaydirma overflow-y-auto p-4">{children}</div>
        {alt && <div className="flex flex-wrap justify-end gap-2 border-t border-cizgi px-4 py-3">{alt}</div>}
      </div>
    </div>
  );
}

export function Alan({ etiket, children, ipucu }: { etiket: string; children: ReactNode; ipucu?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold">{etiket}</span>
      {children}
      {ipucu && <span className="text-xs text-soluk">{ipucu}</span>}
    </label>
  );
}

export const girdiSinif =
  "min-h-11 w-full rounded-xl border border-cizgi bg-kart px-3 text-base text-yazi placeholder:text-soluk focus:border-marka focus:outline-none";

export function Anahtar({ acik, degistir, etiket }: { acik: boolean; degistir: (v: boolean) => void; etiket: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acik}
      aria-label={etiket}
      title={etiket}
      onClick={() => degistir(!acik)}
      className={cx("relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition", acik ? "bg-iyi" : "bg-cizgi")}
    >
      <span className={cx("inline-block h-5 w-5 rounded-full bg-white shadow transition", acik ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

/** Seçilebilir ikonlu çip */
export function Cip({ secili, onClick, ikon, children, etiket, className }: { secili?: boolean; onClick?: () => void; ikon?: string; children?: ReactNode; etiket?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={secili}
      title={etiket}
      aria-label={children ? undefined : etiket}
      className={cx(
        "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition",
        secili ? "border-marka bg-marka text-white dark:text-[#0b1020]" : "border-cizgi bg-kart text-yazi hover:bg-kart2",
        className,
      )}
    >
      {ikon && <Ikon ad={ikon} boyut={16} />}
      {children}
    </button>
  );
}
