// Cari (müşteri/tedarikçi) ayrıntı yan paneli
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { MapPin, Phone, Wallet, CalendarClock, ShieldCheck, Users } from "lucide-react";
import { useVeri } from "../state/rapor";
import { kisaTl, sayi, tarih, tl } from "../lib/bicim";
import { EChart } from "../charts/EChart";
import { aylikIkiliSecenek, palet } from "../charts/secenekler";
import { Cekmece, HataKutusu, KutuIskelet, VeriYok } from "./ui";

type CariYanit = {
  kart: Record<string, unknown> & { ad?: string; kod?: string; il?: string; ilce?: string; grup?: string; temsilci?: string; vade_gun?: number; kredi_limit?: number; risk_limit?: number; firmaAd?: string; telefon?: string };
  bakiye: number;
  sonHareket: string | null;
  hareketler: { tarih: string; izahat: number; islem: string; evrak: string; borc: number; alacak: number; vade: string }[];
  aylik: { ay: string; satis: number; tahsilat: number }[];
  urunler: { stok_id: number; ad: string; tutar: number; miktar: number }[];
};

const Ctx = createContext<(anahtar: string) => void>(() => undefined);

export function useCariAc() {
  return useContext(Ctx);
}

/** Satırdan cari anahtarı çıkarır ("0101:215") */
export function cariAnahtari(satir: Record<string, unknown>, boyutId?: string): string | null {
  if (boyutId === "cari" && typeof satir.k === "string" && /^\d{4}:\d+$/.test(satir.k)) return satir.k;
  if (typeof satir.k === "string" && /^\d{4}:\d+$/.test(satir.k) && boyutId === undefined) return satir.k;
  if (typeof satir.firma === "string" && /^\d{4}$/.test(satir.firma) && (typeof satir.id === "number" || /^\d+$/.test(String(satir.id ?? "")))) return `${satir.firma}:${satir.id}`;
  return null;
}

export function CariSaglayici({ children }: { children: ReactNode }) {
  const [anahtar, setAnahtar] = useState<string | null>(null);
  const kapat = useCallback(() => setAnahtar(null), []);
  return (
    <Ctx.Provider value={setAnahtar}>
      {children}
      <CariCekmece anahtar={anahtar} kapat={kapat} />
    </Ctx.Provider>
  );
}

function CariCekmece({ anahtar, kapat }: { anahtar: string | null; kapat: () => void }) {
  const { veri, hata, yukleniyor, yenile } = useVeri<CariYanit>(anahtar ? `/cari/${encodeURIComponent(anahtar)}` : null);
  const aylik = veri?.aylik;
  const secenek = useCallback((koyu: boolean) => aylikIkiliSecenek(palet(koyu), aylik || []), [aylik]);
  const k = veri?.kart;
  const bilgiler = useMemo(
    () =>
      k
        ? [
            { ikon: MapPin, deger: [k.il, k.ilce].filter(Boolean).join(" / "), ad: "Konum" },
            { ikon: Users, deger: k.grup, ad: "Grup" },
            { ikon: ShieldCheck, deger: k.temsilci, ad: "Temsilci" },
            { ikon: CalendarClock, deger: k.vade_gun ? `${k.vade_gun} gün vade` : null, ad: "Vade" },
            { ikon: Wallet, deger: k.kredi_limit ? `Limit ${kisaTl(k.kredi_limit)}` : null, ad: "Kredi limiti" },
            { ikon: Phone, deger: k.telefon, ad: "Telefon" },
          ].filter((b) => b.deger)
        : [],
    [k],
  );
  return (
    <Cekmece acik={!!anahtar} kapat={kapat} baslik={k?.ad || "Cari"} ikon="UserRound" genis>
      {yukleniyor && <KutuIskelet yukseklik="h-64" />}
      {hata && <HataKutusu mesaj={hata.message} yenile={yenile} />}
      {veri && k && (
        <div className="flex flex-col gap-5" data-testid="cari-panel">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm text-soluk">
                {k.kod} · {k.firmaAd}
              </div>
              <div className={`rakam text-4xl font-extrabold ${veri.bakiye > 0 ? "text-yazi" : "text-iyi"}`} title="Bakiye (+ borçlu / − alacaklı)">
                {tl(veri.bakiye)}
              </div>
              <div className="text-xs text-soluk">Son hareket {tarih(veri.sonHareket)}</div>
            </div>
          </div>
          {bilgiler.length > 0 && (
            <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {bilgiler.map((b) => (
                <li key={b.ad} className="flex items-center gap-2" title={b.ad}>
                  <b.ikon size={16} className="shrink-0 text-soluk" aria-label={b.ad} />
                  <span className="truncate">{String(b.deger)}</span>
                </li>
              ))}
            </ul>
          )}
          <section>
            <h3 className="mb-2 font-bold">Satış ↔ tahsilat (12 ay)</h3>
            {aylik && aylik.length ? <EChart secenek={secenek} yukseklik={220} etiket="Aylık satış ve tahsilat" /> : <VeriYok />}
          </section>
          <section>
            <h3 className="mb-2 font-bold">En çok aldığı ürünler</h3>
            {veri.urunler.length ? (
              <ul className="flex flex-col divide-y divide-cizgi rounded-xl border border-cizgi bg-kart">
                {veri.urunler.map((u) => (
                  <li key={u.stok_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{u.ad}</span>
                    <span className="rakam text-soluk">{sayi(u.miktar)} ad.</span>
                    <span className="rakam w-24 text-right font-semibold">{kisaTl(u.tutar)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <VeriYok />
            )}
          </section>
          <section>
            <h3 className="mb-2 font-bold">Son hareketler</h3>
            <div className="ince-kaydirma max-h-96 overflow-auto rounded-xl border border-cizgi">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="sticky top-0 bg-kart2 text-left text-soluk">
                  <tr>
                    <th className="px-3 py-2">Tarih</th>
                    <th className="px-3 py-2">İşlem</th>
                    <th className="px-3 py-2">Evrak</th>
                    <th className="px-3 py-2 text-right">Borç</th>
                    <th className="px-3 py-2 text-right">Alacak</th>
                  </tr>
                </thead>
                <tbody>
                  {veri.hareketler.map((h, i) => (
                    <tr key={i} className="border-t border-cizgi">
                      <td className="rakam px-3 py-1.5 whitespace-nowrap">{tarih(h.tarih)}</td>
                      <td className="px-3 py-1.5">{h.islem}</td>
                      <td className="px-3 py-1.5 text-soluk">{h.evrak}</td>
                      <td className="rakam px-3 py-1.5 text-right">{h.borc ? tl(h.borc) : ""}</td>
                      <td className="rakam px-3 py-1.5 text-right">{h.alacak ? tl(h.alacak) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </Cekmece>
  );
}
