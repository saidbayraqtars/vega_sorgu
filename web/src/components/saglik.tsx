// Finansal Sağlık Skoru: yarım daire gösterge + 5 sütun + ayrıntı paneli
import { ShieldAlert, ThumbsDown, ThumbsUp } from "lucide-react";
import { olcutDegeri } from "../lib/bicim";
import type { Olcut, Saglik } from "../lib/types";
import { Ikon, Rozet, cx, renkSinif } from "./ui";

const renkDegisken: Record<string, string> = { iyi: "var(--iyi)", orta: "var(--orta)", zayif: "var(--zayif)", kritik: "var(--kotu)", notr: "var(--notr)" };

export function skorRengi(skor: number | null | undefined): string {
  if (skor === null || skor === undefined) return "notr";
  if (skor >= 65) return "iyi";
  if (skor >= 45) return "orta";
  if (skor >= 30) return "zayif";
  return "kritik";
}

export function SaglikGosterge({ saglik, boyut = 220 }: { saglik: Pick<Saglik, "skor" | "not" | "etiket" | "renk" | "guven">; boyut?: number }) {
  const skor = saglik.skor ?? 0;
  const r = 80;
  const cevre = Math.PI * r;
  const dolu = saglik.skor === null ? 0 : (Math.max(0, Math.min(100, skor)) / 100) * cevre;
  const renk = renkDegisken[saglik.renk] || "var(--notr)";
  return (
    <div className="relative mx-auto" style={{ width: boyut, maxWidth: "100%" }}>
      <svg viewBox="0 0 200 118" className="w-full" role="img" aria-label={`Sağlık skoru ${saglik.skor ?? "yok"} / 100, not ${saglik.not ?? "-"}, ${saglik.etiket}`}>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--cizgi)" strokeWidth="16" strokeLinecap="round" />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke={renk}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${dolu} ${cevre}`}
          style={{ transition: "stroke-dasharray .6s ease" }}
        />
        <text x="100" y="82" textAnchor="middle" fontSize="44" fontWeight="800" fill="var(--yazi)" className="rakam">
          {saglik.skor ?? "—"}
        </text>
        <text x="100" y="106" textAnchor="middle" fontSize="14" fontWeight="600" fill={renk}>
          {saglik.not ? `${saglik.not} · ${saglik.etiket}` : saglik.etiket}
        </text>
      </svg>
      {(saglik.guven === "dusuk" || saglik.guven === "yok") && (
        <span className="absolute top-0 right-0 text-orta" title="Veri kapsamı düşük: skor güvenilirliği sınırlı" aria-label="Veri kapsamı düşük">
          <ShieldAlert size={20} aria-hidden />
        </span>
      )}
    </div>
  );
}

export function SutunCubuklari({ saglik, kucuk }: { saglik: Saglik; kucuk?: boolean }) {
  return (
    <div className={cx("grid grid-cols-5 gap-2", kucuk && "gap-1")}>
      {saglik.sutunlar.map((s) => {
        const r = renkSinif(s.renk);
        return (
          <div key={s.id} className="flex flex-col items-center gap-1 text-center" title={`${s.ad}: ${s.skor ?? "—"} / 100 (${s.etiket})`}>
            <span className={cx("flex h-9 w-9 items-center justify-center rounded-xl", r.zemin, r.yazi)}>
              <Ikon ad={s.ikon} boyut={18} />
            </span>
            <span className="h-1.5 w-full overflow-hidden rounded-full bg-cizgi">
              <span className={cx("block h-full rounded-full", r.dolgu)} style={{ width: `${s.skor ?? 0}%` }} />
            </span>
            <span className="rakam text-sm font-bold">{s.skor ?? "—"}</span>
            {!kucuk && <span className="w-full truncate text-[11px] leading-tight text-soluk">{s.ad}</span>}
          </div>
        );
      })}
    </div>
  );
}

function OlcutSatir({ o }: { o: Olcut }) {
  const r = renkSinif(skorRengi(o.skor));
  return (
    <li className="flex gap-3 rounded-xl border border-cizgi bg-kart p-3">
      <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", r.zemin, r.yazi)}>
        <Ikon ad={o.ikon} boyut={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">{o.ad}</span>
          <span className="rakam font-bold">{olcutDegeri(o)}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-cizgi">
            <span className={cx("block h-full rounded-full", r.dolgu)} style={{ width: `${Math.round(o.skor ?? 0)}%` }} />
          </span>
          <span className="rakam w-8 text-right text-xs text-soluk">{o.skor === null ? "—" : Math.round(o.skor)}</span>
        </div>
        <p className="mt-1.5 text-sm text-soluk">{o.aciklama}</p>
        {o.ideal && <p className="mt-0.5 text-xs text-soluk">İdeal: {o.ideal}</p>}
      </div>
    </li>
  );
}

export function SaglikDetay({ saglik }: { saglik: Saglik }) {
  return (
    <div className="flex flex-col gap-5">
      <SaglikGosterge saglik={saglik} />
      {(saglik.olumlu?.length > 0 || saglik.olumsuz?.length > 0) && (
        <section>
          <h3 className="mb-2 text-base font-bold">Neden?</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-iyi-zemin p-3">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-iyi">
                <ThumbsUp size={16} aria-hidden /> Olumlu
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {saglik.olumlu.map((o) => (
                  <li key={o.id} className="flex items-center gap-1.5">
                    <Ikon ad={o.ikon} boyut={14} className="shrink-0 text-iyi" />
                    <span className="min-w-0 flex-1 truncate">{o.ad}</span>
                    <span className="rakam font-semibold">{olcutDegeri(o)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-kotu-zemin p-3">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-kotu">
                <ThumbsDown size={16} aria-hidden /> Olumsuz
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {saglik.olumsuz.map((o) => (
                  <li key={o.id} className="flex items-center gap-1.5">
                    <Ikon ad={o.ikon} boyut={14} className="shrink-0 text-kotu" />
                    <span className="min-w-0 flex-1 truncate">{o.ad}</span>
                    <span className="rakam font-semibold">{olcutDegeri(o)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
      {saglik.sutunlar.map((s) => (
        <section key={s.id}>
          <div className="mb-2 flex items-center gap-2">
            <Ikon ad={s.ikon} boyut={20} className={renkSinif(s.renk).yazi} />
            <h3 className="flex-1 text-base font-bold">{s.ad}</h3>
            <Rozet renk={s.renk}>
              {s.skor ?? "—"} · {s.etiket}
            </Rozet>
            <span className="text-xs text-soluk" title="Skordaki ağırlığı">
              %{s.agirlik}
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {s.olcutler.map((o) => (
              <OlcutSatir key={o.id} o={o} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
