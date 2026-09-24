// Küçük istemci yönlendiricisi (History API). Uygulama birkaç sabit yol kullanır.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";

type Konum = { yol: string; arama: string };
type YonCtx = Konum & { git: (hedef: string, secenek?: { degistir?: boolean }) => void };

const Ctx = createContext<YonCtx | null>(null);

function oku(): Konum {
  return { yol: window.location.pathname, arama: window.location.search };
}

export function Yonlendirici({ children }: { children: ReactNode }) {
  const [konum, setKonum] = useState<Konum>(oku);
  useEffect(() => {
    const f = () => setKonum(oku());
    window.addEventListener("popstate", f);
    return () => window.removeEventListener("popstate", f);
  }, []);
  const git = useCallback((hedef: string, secenek?: { degistir?: boolean }) => {
    const once = window.location.pathname + window.location.search;
    if (hedef === once) return;
    if (secenek?.degistir) window.history.replaceState(null, "", hedef);
    else window.history.pushState(null, "", hedef);
    const yeni = oku();
    setKonum(yeni);
    if (!secenek?.degistir && yeni.yol !== new URL(once, window.location.origin).pathname) window.scrollTo(0, 0);
  }, []);
  const deger = useMemo(() => ({ ...konum, git }), [konum, git]);
  return <Ctx.Provider value={deger}>{children}</Ctx.Provider>;
}

export function useYon(): YonCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("Yonlendirici yok");
  return c;
}

export function useSorguParam(): URLSearchParams {
  const { arama } = useYon();
  return useMemo(() => new URLSearchParams(arama), [arama]);
}

/** "/pano/:id" desenini eşleştirir. */
export function eslestir(desen: string, yol: string): Record<string, string> | null {
  const d = desen.split("/").filter(Boolean);
  const y = yol.split("/").filter(Boolean);
  if (d.length !== y.length) return null;
  const p: Record<string, string> = {};
  for (let i = 0; i < d.length; i++) {
    if (d[i].startsWith(":")) p[d[i].slice(1)] = decodeURIComponent(y[i]);
    else if (d[i] !== y[i]) return null;
  }
  return p;
}

export function Baglanti({ to, onClick, ...kalan }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const { git } = useYon();
  const tikla = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    git(to);
  };
  return <a href={to} onClick={tikla} {...kalan} />;
}
