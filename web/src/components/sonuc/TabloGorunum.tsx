// Biçimli, sıralanabilir tablo (+ toplam satırı, "daha fazla")
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import { sayi, tarih, tl, yuzde, yuzdeSayi } from "../../lib/bicim";
import type { Kolon } from "../../lib/types";
import { Rozet, VeriYok, cx } from "../ui";
import { cariAnahtari, useCariAc } from "../CariPanel";
import type { TabloVeri } from "./tablo";

const SAYISAL = new Set(["sayi", "tl", "yuzde", "yuzdeSayi"]);

function etiketRengi(v: unknown): string {
  const s = String(v ?? "").toLocaleLowerCase("tr-TR");
  if (/kritik|gecik|zarar|kayıp|iptal|karşılıksız|yok$|risk/.test(s)) return "kritik";
  if (/uyar|dikkat|bekle|b$/.test(s) || s === "uyari") return "orta";
  if (/şampiyon|sadık|tahsil edildi|ödendi|aktif|^a$|iyi|yeni/.test(s)) return "iyi";
  return "notr";
}

const seviyeAd: Record<string, string> = { kritik: "Kritik", uyari: "Uyarı", bilgi: "Bilgi" };

export function hucreMetni(v: unknown, tip: string): string {
  if (v === null || v === undefined || v === "") return "";
  switch (tip) {
    case "tl":
      return typeof v === "number" ? tl(v) : String(v);
    case "sayi":
      return typeof v === "number" ? sayi(v, Number.isInteger(v) ? 0 : 2) : String(v);
    case "yuzde":
      return typeof v === "number" ? yuzde(v) : String(v);
    case "yuzdeSayi":
      return typeof v === "number" ? yuzdeSayi(v) : String(v);
    case "tarih":
      return tarih(String(v));
    case "etiket":
      return seviyeAd[String(v)] || String(v);
    default:
      return typeof v === "boolean" ? (v ? "Evet" : "Hayır") : String(v);
  }
}

function Hucre({ v, kolon }: { v: unknown; kolon: Kolon }) {
  if (kolon.tip === "etiket" && v !== null && v !== undefined && v !== "") {
    const r = String(v) in seviyeAd ? (v === "kritik" ? "kritik" : v === "uyari" ? "orta" : "notr") : etiketRengi(v);
    return <Rozet renk={r}>{hucreMetni(v, "etiket")}</Rozet>;
  }
  const metin = hucreMetni(v, kolon.tip);
  const negatif = typeof v === "number" && v < 0 && SAYISAL.has(kolon.tip);
  return <span className={cx(negatif && "text-kotu")}>{metin}</span>;
}

export function TabloGorunum({ veri, kompakt, sayfa = 50 }: { veri: TabloVeri; kompakt?: boolean; sayfa?: number }) {
  const [sirala, setSirala] = useState<{ id: string; yon: 1 | -1 } | null>(null);
  const [limit, setLimit] = useState(sayfa);
  const cariAc = useCariAc();
  const satirlar = useMemo(() => {
    if (!sirala) return veri.satirlar;
    const kopya = [...veri.satirlar];
    kopya.sort((a, b) => {
      const x = a[sirala.id];
      const y = b[sirala.id];
      if (x === y) return 0;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      if (typeof x === "number" && typeof y === "number") return (x - y) * sirala.yon;
      return String(x).localeCompare(String(y), "tr") * sirala.yon;
    });
    return kopya;
  }, [veri.satirlar, sirala]);

  if (!veri.satirlar.length) return <VeriYok />;
  const gorunen = satirlar.slice(0, limit);

  const basaTikla = (k: Kolon) =>
    setSirala((s) => (s?.id === k.id ? (s.yon === -1 ? { id: k.id, yon: 1 } : null) : { id: k.id, yon: SAYISAL.has(k.tip) ? -1 : 1 }));

  return (
    <div className="flex flex-col gap-2">
      <div className={cx("ince-kaydirma overflow-auto rounded-xl border border-cizgi", kompakt && "max-h-80")}>
        <table className="w-full text-sm" data-tablo>
          <thead className="sticky top-0 z-10 bg-kart2 text-left text-soluk">
            <tr>
              {veri.kolonlar.map((k) => {
                const aktif = sirala?.id === k.id;
                return (
                  <th key={k.id} scope="col" className={cx("px-3 py-2 font-semibold whitespace-nowrap", SAYISAL.has(k.tip) && "text-right")} aria-sort={aktif ? (sirala!.yon === 1 ? "ascending" : "descending") : undefined}>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-yazi" onClick={() => basaTikla(k)} title="Sırala">
                      {k.ad}
                      {aktif && (sirala!.yon === 1 ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {gorunen.map((s, i) => {
              const anahtar = cariAnahtari(s, veri.boyutId);
              return (
                <tr
                  key={i}
                  className={cx("border-t border-cizgi", anahtar && "cursor-pointer hover:bg-kart2")}
                  onClick={anahtar ? () => cariAc(anahtar) : undefined}
                  onKeyDown={anahtar ? (e) => e.key === "Enter" && cariAc(anahtar) : undefined}
                  tabIndex={anahtar ? 0 : undefined}
                  title={anahtar ? "Cari ayrıntısı" : undefined}
                >
                  {veri.kolonlar.map((k) => (
                    <td key={k.id} className={cx("px-3 py-1.5", SAYISAL.has(k.tip) ? "rakam text-right whitespace-nowrap" : k.tip === "tarih" ? "rakam whitespace-nowrap" : "max-w-[18rem] truncate")}>
                      <Hucre v={s[k.id]} kolon={k} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {veri.toplam && (
            <tfoot className="sticky bottom-0 bg-kart2 font-bold">
              <tr className="border-t-2 border-cizgi">
                {veri.kolonlar.map((k, i) => (
                  <td key={k.id} className={cx("px-3 py-2", SAYISAL.has(k.tip) && "rakam text-right whitespace-nowrap")}>
                    {veri.toplam && k.id in veri.toplam ? hucreMetni(veri.toplam[k.id], k.tip) : i === 0 ? "Toplam" : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {satirlar.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + sayfa)} className="inline-flex items-center justify-center gap-1 self-center rounded-xl px-4 py-2 text-sm font-semibold text-marka hover:bg-kart2">
          <ChevronDown size={16} aria-hidden /> Daha fazla ({satirlar.length - limit})
        </button>
      )}
      {veri.adet !== undefined && veri.adet > veri.satirlar.length && (
        <p className="text-center text-xs text-soluk rakam" data-testid="tablo-kisaltildi">
          {veri.satirlar.length} / {veri.adet} satır gösteriliyor · tümü için "İlk N"yi artırın
        </p>
      )}
    </div>
  );
}
