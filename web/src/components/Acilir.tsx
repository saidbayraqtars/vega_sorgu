// Tetik düğmesine bağlı açılır kutu (dışarı tıklayınca / Esc ile kapanır)
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

export function Acilir({
  tetik, children, hiza = "sag", genislik = "w-72", etiket,
}: { tetik: (acik: boolean) => ReactNode; children: (kapat: () => void) => ReactNode; hiza?: "sag" | "sol"; genislik?: string; etiket: string }) {
  const [acik, setAcik] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!acik) return;
    const d = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAcik(false);
    };
    const t = (e: KeyboardEvent) => e.key === "Escape" && setAcik(false);
    document.addEventListener("pointerdown", d);
    document.addEventListener("keydown", t);
    return () => {
      document.removeEventListener("pointerdown", d);
      document.removeEventListener("keydown", t);
    };
  }, [acik]);
  return (
    <div ref={ref} className="relative">
      <div onClick={() => setAcik((a) => !a)} aria-expanded={acik}>
        {tetik(acik)}
      </div>
      {acik && (
        <div
          role="dialog"
          aria-label={etiket}
          className={cx(
            "fixed inset-x-2 top-16 z-50 max-h-[75dvh] overflow-y-auto rounded-2xl border border-cizgi bg-kart p-2 shadow-2xl sm:absolute sm:inset-x-auto sm:top-12",
            hiza === "sag" ? "sm:right-0" : "sm:left-0",
            genislik === "w-72" ? "sm:w-72" : genislik,
          )}
        >
          {children(() => setAcik(false))}
        </div>
      )}
    </div>
  );
}
