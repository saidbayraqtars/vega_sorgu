// Rapor kataloğu: kategori ızgarası + Türkçe duyarsız arama + görünüm filtreleri
import { useDeferredValue, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Search, X } from "lucide-react";
import type { Gorunum, Kategori, RaporTanimi } from "../lib/types";
import { eslesir, katla } from "../lib/arama";
import { useKatalog } from "../state/rapor";
import { HataKutusu, Ikon, Iskelet, VeriYok, cx, girdiSinif } from "./ui";

export const GORUNUMLER: { id: string; ad: string; ikon: string; kapsar: Gorunum[] }[] = [
  { id: "kpi", ad: "Özet sayı", ikon: "Calculator", kapsar: ["kpi"] },
  { id: "trend", ad: "Trend", ikon: "LineChart", kapsar: ["trend"] },
  { id: "yoy", ad: "Geçen yılla", ikon: "GitCompareArrows", kapsar: ["yoy"] },
  { id: "kumulatif", ad: "Kümülatif", ikon: "TrendingUp", kapsar: ["kumulatif"] },
  { id: "top", ad: "Sıralama", ikon: "ListOrdered", kapsar: ["top"] },
  { id: "pay", ad: "Pay", ikon: "PieChart", kapsar: ["pay"] },
  { id: "karsilastir", ad: "Karşılaştırma", ikon: "ArrowLeftRight", kapsar: ["karsilastir"] },
  { id: "pareto", ad: "ABC", ikon: "BarChart3", kapsar: ["pareto"] },
  { id: "isi", ad: "Isı/Mevsim", ikon: "Grid3x3", kapsar: ["isi", "mevsim"] },
  { id: "dagilim", ad: "Dağılım", ikon: "ScatterChart", kapsar: ["dagilim"] },
  { id: "ozel", ad: "Özel", ikon: "Sparkles", kapsar: ["ozel"] },
];

const kategoriRenk: Record<string, string> = {
  indigo: "#6366f1", blue: "#3b82f6", emerald: "#10b981", violet: "#8b5cf6", amber: "#f59e0b", orange: "#f97316", teal: "#14b8a6",
  slate: "#64748b", green: "#22c55e", sky: "#0ea5e9", rose: "#f43f5e", cyan: "#06b6d4", gray: "#6b7280",
};
export const katRenk = (r: string) => kategoriRenk[r] || "#6366f1";

type Dizinli = RaporTanimi & { _k: string };

export function RaporKarti({ r, kat, onSec, secili }: { r: RaporTanimi; kat?: Kategori; onSec: (r: RaporTanimi) => void; secili?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onSec(r)}
      className={cx("flex min-h-16 w-full items-center gap-3 rounded-2xl border bg-kart p-3 text-left transition hover:border-marka", secili ? "border-marka ring-2 ring-marka/30" : "border-cizgi")}
      title={r.aciklama}
      data-testid="rapor-karti"
      data-rapor={r.id}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${katRenk(kat?.renk || "")}1f`, color: katRenk(kat?.renk || "") }}>
        <Ikon ad={r.ikon} boyut={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold">{r.kisa}</span>
        <span className="block truncate text-xs text-soluk">{r.ad}</span>
      </span>
    </button>
  );
}

export function KatalogGezgini({ onSec, seciliId, sikisik }: { onSec: (r: RaporTanimi) => void; seciliId?: string; sikisik?: boolean }) {
  const { veri, hata, yenile } = useKatalog();
  const [ara, setAra] = useState("");
  const [kategori, setKategori] = useState<string | null>(null);
  const [gorunum, setGorunum] = useState<string | null>(null);
  const [limit, setLimit] = useState(60);
  const araErtelenmis = useDeferredValue(ara);

  const dizin = useMemo<Dizinli[]>(() => (veri ? veri.raporlar.map((r) => ({ ...r, _k: katla(`${r.ad} ${r.kisa} ${r.aciklama}`) })) : []), [veri]);
  const katHarita = useMemo(() => new Map((veri?.kategoriler || []).map((k) => [k.id, k])), [veri]);
  const sayilar = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of dizin) m.set(r.kategori, (m.get(r.kategori) || 0) + 1);
    return m;
  }, [dizin]);

  const sonuc = useMemo(() => {
    const g = gorunum ? GORUNUMLER.find((x) => x.id === gorunum)?.kapsar : null;
    const a = araErtelenmis.trim();
    return dizin.filter((r) => (!kategori || r.kategori === kategori) && (!g || g.includes(r.gorunum)) && (!a || eslesir(r._k, a)));
  }, [dizin, kategori, gorunum, araErtelenmis]);

  if (hata && !veri) return <HataKutusu mesaj={hata.message} yenile={yenile} />;
  if (!veri)
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }, (_, i) => (
          <Iskelet key={i} className="h-28" />
        ))}
      </div>
    );

  const kategoriGorunumu = !kategori && !ara.trim() && !gorunum;
  const kat = kategori ? katHarita.get(kategori) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search size={20} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-soluk" aria-hidden />
        <input
          type="search"
          value={ara}
          onChange={(e) => {
            setAra(e.target.value);
            setLimit(60);
          }}
          placeholder={`${veri.raporlar.length.toLocaleString("tr-TR")} rapor içinde ara`}
          aria-label="Rapor ara"
          className={cx(girdiSinif, "pl-10 pr-10")}
          data-testid="katalog-ara"
        />
        {ara && (
          <button type="button" onClick={() => setAra("")} className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-soluk hover:bg-kart2" aria-label="Aramayı temizle" title="Aramayı temizle">
            <X size={18} aria-hidden />
          </button>
        )}
      </div>

      <div className="ince-kaydirma -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Görünüm filtresi">
        {GORUNUMLER.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              setGorunum((x) => (x === g.id ? null : g.id));
              setLimit(60);
            }}
            aria-pressed={gorunum === g.id}
            title={g.ad}
            className={cx(
              "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm whitespace-nowrap",
              gorunum === g.id ? "border-marka bg-marka text-white dark:text-[#0b1020]" : "border-cizgi bg-kart hover:bg-kart2",
            )}
          >
            <Ikon ad={g.ikon} boyut={16} />
            <span className={cx(sikisik && "hidden sm:inline")}>{g.ad}</span>
          </button>
        ))}
      </div>

      {kat && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setKategori(null)} className="inline-flex min-h-9 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-marka hover:bg-kart2" aria-label="Kategorilere dön" title="Kategorilere dön">
            <ArrowLeft size={18} aria-hidden /> Kategoriler
          </button>
          <span className="flex items-center gap-1.5 font-bold" style={{ color: katRenk(kat.renk) }}>
            <Ikon ad={kat.ikon} boyut={18} /> {kat.ad}
          </span>
        </div>
      )}

      {kategoriGorunumu ? (
        <div className={cx("grid gap-2 sm:gap-3", sikisik ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4")} data-testid="kategori-izgarasi">
          {veri.kategoriler.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKategori(k.id)}
              className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border border-cizgi bg-kart p-3 text-center transition hover:border-marka"
              data-testid="kategori"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${katRenk(k.renk)}1f`, color: katRenk(k.renk) }}>
                <Ikon ad={k.ikon} boyut={26} />
              </span>
              <span className="font-bold leading-tight">{k.ad}</span>
              <span className="text-xs text-soluk">{sayilar.get(k.id) || 0} rapor</span>
            </button>
          ))}
        </div>
      ) : sonuc.length ? (
        <>
          <p className="text-sm text-soluk" aria-live="polite">
            {sonuc.length.toLocaleString("tr-TR")} rapor
          </p>
          <div className={cx("grid gap-2", sikisik ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
            {sonuc.slice(0, limit).map((r) => (
              <RaporKarti key={r.id} r={r} kat={katHarita.get(r.kategori)} onSec={onSec} secili={r.id === seciliId} />
            ))}
          </div>
          {sonuc.length > limit && (
            <button type="button" onClick={() => setLimit((l) => l + 60)} className="inline-flex items-center justify-center gap-1 self-center rounded-xl px-4 py-2 text-sm font-semibold text-marka hover:bg-kart2">
              <ChevronDown size={16} aria-hidden /> Daha fazla ({sonuc.length - limit})
            </button>
          )}
        </>
      ) : (
        <VeriYok mesaj="Sonuç bulunamadı" />
      )}
    </div>
  );
}
