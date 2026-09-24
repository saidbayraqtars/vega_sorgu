// Büyüme Endeksi kartı ve ayrıntısı
import { useCallback } from "react";
import { ArrowRight, Info, TrendingDown, TrendingUp, MoveRight, Rocket } from "lucide-react";
import { isaretliYuzde, kisaTarih, kisaTl, tarih, tl, birimli } from "../lib/bicim";
import type { Buyume } from "../lib/types";
import { Baglanti } from "../lib/yonlendirici";
import { EChart } from "../charts/EChart";
import { palet } from "../charts/secenekler";
import { Ikon, Rozet, cx, degisimRengi, renkSinif } from "./ui";

const ivmeBilgi = {
  hizlaniyor: { ikon: TrendingUp, metin: "Hızlanıyor", renk: "iyi" },
  yavasliyor: { ikon: TrendingDown, metin: "Yavaşlıyor", renk: "orta" },
  dengeli: { ikon: MoveRight, metin: "Dengeli", renk: "notr" },
} as const;

export function BuyumeOzet({ buyume, ayarlarBaglantisi = true }: { buyume: Buyume; ayarlarBaglantisi?: boolean }) {
  const r = renkSinif(degisimRengi(buyume.yuzde));
  const ivme = buyume.ivme ? ivmeBilgi[buyume.ivme.durum] : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cx("rakam text-5xl font-extrabold leading-none tracking-tight sm:text-6xl", r.yazi)} data-testid="buyume-yuzde">
            {isaretliYuzde(buyume.yuzde)}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {buyume.reel !== null && buyume.reel !== undefined ? (
              <span className={cx("rakam font-semibold", renkSinif(degisimRengi(buyume.reel)).yazi)} title={`Yıllık enflasyon %${buyume.enflasyon} ile arındırılmış`}>
                Reel {isaretliYuzde(buyume.reel)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-soluk" title="Reel büyüme için Ayarlar'dan yıllık enflasyonu girin">
                <Info size={14} aria-hidden /> Enflasyon girilmedi
                {ayarlarBaglantisi && (
                  <Baglanti to="/ayarlar" className="font-semibold text-marka underline" onClick={(e) => e.stopPropagation()}>
                    Ayarlar
                  </Baglanti>
                )}
              </span>
            )}
          </div>
        </div>
        {ivme && (
          <span className={cx("inline-flex shrink-0 items-center gap-1 rounded-xl px-2 py-1 text-sm font-semibold", renkSinif(ivme.renk).zemin, renkSinif(ivme.renk).yazi)} title={`İvme: ${ivme.metin}`}>
            <ivme.ikon size={18} aria-hidden />
            <span className="hidden sm:inline">{ivme.metin}</span>
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {buyume.bilesenler.map((b) => {
          const br = renkSinif(degisimRengi(b.yuzde));
          return (
            <span key={b.id} className={cx("inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold", br.zemin, br.yazi)} title={`${b.ad}: ${kisaTl(b.simdi)} (önceki ${kisaTl(b.onceki)}) · ağırlık %${Math.round(b.agirlik * 100)}`}>
              <Ikon ad={b.ikon} boyut={14} />
              <span className="rakam">{isaretliYuzde(b.yuzde, 0)}</span>
            </span>
          );
        })}
      </div>
      {buyume.yilSonu && (
        <div className="flex items-center gap-2 text-sm text-soluk" title="Yıl sonu ciro tahmini ve geçen yıla göre değişim">
          <Rocket size={16} aria-hidden className="shrink-0" />
          <span>Yıl sonu</span>
          <span className="rakam font-semibold text-yazi">{kisaTl(buyume.yilSonu.deger)}</span>
          {buyume.yilSonu.yuzde !== null && <span className={cx("rakam font-semibold", renkSinif(degisimRengi(buyume.yilSonu.yuzde)).yazi)}>{isaretliYuzde(buyume.yilSonu.yuzde, 0)}</span>}
        </div>
      )}
    </div>
  );
}

const detayAd: Record<string, string> = { ay: "Bu ay (geçen yıl)", ayOnceki: "Bu ay (önceki ay)", yil: "Yıl başından", ttm: "Son 12 ay", son90: "Son 90 gün" };

export function BuyumeDetay({ buyume }: { buyume: Buyume }) {
  const tahmin = buyume.tahmin;
  const secenek = useCallback(
    (koyu: boolean) => {
      const p = palet(koyu);
      const aylar = tahmin?.aylar || [];
      return {
        color: p.kategorik,
        grid: { left: 8, right: 12, top: 16, bottom: 8, containLabel: true },
        tooltip: {
          trigger: "axis",
          backgroundColor: p.kart,
          borderColor: p.cizgi,
          textStyle: { color: p.yazi },
          formatter: (ps: { dataIndex: number }[]) => {
            const a = aylar[ps[0].dataIndex];
            return `<b>${kisaTarih(a.k)}</b><br/>Tahmin: <b>${tl(a.deger)}</b><br/><span style="opacity:.75">${kisaTl(a.alt)} – ${kisaTl(a.ust)}</span>`;
          },
        },
        xAxis: { type: "category", data: aylar.map((a) => kisaTarih(a.k)), axisLine: { lineStyle: { color: p.cizgi } }, axisLabel: { color: p.soluk }, axisTick: { show: false } },
        yAxis: { type: "value", axisLabel: { color: p.soluk, formatter: (v: number) => kisaTl(v).replace(" ₺", "") }, splitLine: { lineStyle: { color: p.cizgi, type: "dashed" } } },
        series: [
          { type: "line", data: aylar.map((a) => a.alt), stack: "b", symbol: "none", lineStyle: { opacity: 0 } },
          { type: "line", data: aylar.map((a) => a.ust - a.alt), stack: "b", symbol: "none", lineStyle: { opacity: 0 }, areaStyle: { color: p.kategorik[1], opacity: 0.18 } },
          { type: "line", data: aylar.map((a) => a.deger), symbolSize: 6, lineStyle: { type: "dashed", width: 2.5, color: p.kategorik[0] }, itemStyle: { color: p.kategorik[0] } },
        ],
      };
    },
    [tahmin],
  );
  return (
    <div className="flex flex-col gap-5">
      <BuyumeOzet buyume={buyume} />
      <p className="text-sm text-soluk">{buyume.ufukAd}</p>
      {buyume.detay && (
        <div className="ince-kaydirma overflow-x-auto rounded-xl border border-cizgi">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-kart2 text-left text-soluk">
              <tr>
                <th className="px-3 py-2 font-semibold">Dönem</th>
                <th className="px-3 py-2 text-right font-semibold">Şimdi</th>
                <th className="px-3 py-2 text-right font-semibold">Önceki</th>
                <th className="px-3 py-2 text-right font-semibold">Değişim</th>
              </tr>
            </thead>
            <tbody>
              {(["ay", "ayOnceki", "yil", "ttm", "son90"] as const).map((k) => {
                const d = buyume.detay?.[k];
                if (!d) return null;
                return (
                  <tr key={k} className="border-t border-cizgi">
                    <td className="px-3 py-2">
                      <div className="font-medium">{detayAd[k]}</div>
                      <div className="text-xs text-soluk">
                        {tarih(d.bas)} – {tarih(d.bit)}
                      </div>
                    </td>
                    <td className="rakam px-3 py-2 text-right">{kisaTl(d.simdi)}</td>
                    <td className="rakam px-3 py-2 text-right text-soluk">{kisaTl(d.onceki)}</td>
                    <td className="px-3 py-2 text-right">
                      <Rozet renk={degisimRengi(d.yuzde)}>{isaretliYuzde(d.yuzde)}</Rozet>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {tahmin && tahmin.aylar.length > 0 && (
        <section>
          <h3 className="mb-1 flex items-center gap-2 font-bold">
            <ArrowRight size={16} aria-hidden /> Ciro tahmini
          </h3>
          <p className="mb-2 text-xs text-soluk">{tahmin.yontem} · gölge: olası aralık</p>
          <EChart secenek={secenek} yukseklik={220} etiket="Ciro tahmini grafiği" />
        </section>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {buyume.bilesenler.map((b) => (
          <div key={b.id} className="rounded-xl border border-cizgi bg-kart p-3">
            <div className="flex items-center gap-1.5 text-sm text-soluk">
              <Ikon ad={b.ikon} boyut={16} />
              {b.ad}
            </div>
            <div className={cx("rakam mt-1 text-xl font-bold", renkSinif(degisimRengi(b.yuzde)).yazi)}>{isaretliYuzde(b.yuzde)}</div>
            <div className="rakam text-xs text-soluk">{b.id === "musteri" ? `${birimli(b.simdi, "adet")} / ${birimli(b.onceki, "adet")}` : `${kisaTl(b.simdi)} / ${kisaTl(b.onceki)}`}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
