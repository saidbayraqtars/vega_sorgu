// Sonuç türü → çizim. Pano kutuları ve rapor görüntüleyici aynı bileşeni kullanır.
import { useCallback, useMemo } from "react";
import { Info, TrendingUp, TrendingDown, AlertOctagon } from "lucide-react";
import type { GrafikTuru, Iyi, Sonuc } from "../../lib/types";
import { birimli, isaretliYuzde, kisaTl, sayi, tarih, tl, yuzde } from "../../lib/bicim";
import { EChart } from "../../charts/EChart";
import {
  agacSecenek, bilancoSecenek, cubukSecenek, isiSecenek, karsilastirSecenek, kivilcimSecenek, palet, paretoSecenek, pastaSecenek, projeksiyonSecenek, seriSecenek,
} from "../../charts/secenekler";
import { DegisimRozeti, Rozet, VeriYok, cx, degisimRengi, renkSinif } from "../ui";
import { SaglikGosterge, SutunCubuklari, SaglikDetay } from "../saglik";
import { BuyumeDetay, BuyumeOzet } from "../buyume";
import { cariAnahtari, useCariAc } from "../CariPanel";
import { TabloGorunum } from "./TabloGorunum";
import { tabloyaDonustur } from "./tablo";

type Props = { sonuc: Sonuc; grafik?: GrafikTuru; birim?: string; iyi?: Iyi; kompakt?: boolean };

export function SonucGorunum({ sonuc, grafik, birim, iyi, kompakt }: Props) {
  const g = grafik || sonuc.grafik;
  const b = (sonuc as { birim?: string }).birim || birim || "TL";
  const iy = (sonuc as { iyi?: Iyi }).iyi || iyi || "yukari";
  // saglik sonucunda `not` harf notudur (A-E), bilgi şeridi değil
  const not = sonuc.tur === "saglik" ? null : sonuc.not;

  let govde: React.ReactNode;
  if (g === "tablo" && sonuc.tur !== "tablo" && sonuc.tur !== "coklu") {
    const t = tabloyaDonustur(sonuc, b);
    govde = t ? <TabloGorunum veri={t} kompakt={kompakt} /> : <VeriYok />;
  } else {
    switch (sonuc.tur) {
      case "kpi":
        govde = <KpiGorunum sonuc={sonuc} birim={b} iyi={iy} kompakt={kompakt} />;
        break;
      case "seri":
        govde = <SeriGorunum sonuc={sonuc} grafik={g} birim={b} iyi={iy} kompakt={kompakt} />;
        break;
      case "kategori":
        govde = <KategoriGorunum sonuc={sonuc} grafik={g} birim={b} iyi={iy} kompakt={kompakt} />;
        break;
      case "matris":
        govde = <MatrisGorunum sonuc={sonuc} birim={b} kompakt={kompakt} />;
        break;
      case "tablo":
        govde = <TabloGorunum veri={tabloyaDonustur(sonuc, b)!} kompakt={kompakt} />;
        break;
      case "coklu":
        govde = (
          <div className="flex flex-col gap-5">
            {sonuc.parcalar.map((p, i) => (
              <section key={i} className="flex flex-col gap-2">
                {p.baslik && <h3 className="text-sm font-bold text-soluk">{p.baslik}</h3>}
                <SonucGorunum sonuc={p} grafik={p.grafik || (p.tur === "tablo" ? "tablo" : undefined)} birim={b} iyi={iy} kompakt={kompakt} />
              </section>
            ))}
          </div>
        );
        break;
      case "saglik":
        govde = kompakt ? (
          <div className="flex flex-col gap-3">
            <SaglikGosterge saglik={sonuc} boyut={200} />
            <SutunCubuklari saglik={sonuc} kucuk />
          </div>
        ) : (
          <SaglikDetay saglik={sonuc} />
        );
        break;
      case "buyume":
        govde = kompakt ? <BuyumeOzet buyume={sonuc} /> : <BuyumeDetay buyume={sonuc} />;
        break;
      case "durum":
        govde = <DurumGorunum sonuc={sonuc} kompakt={kompakt} />;
        break;
      case "projeksiyon":
        govde = <ProjeksiyonGorunum sonuc={sonuc} kompakt={kompakt} />;
        break;
      default:
        govde = <VeriYok mesaj="Bu sonuç türü desteklenmiyor" />;
    }
  }
  return (
    <div className="flex flex-col gap-3" data-sonuc={sonuc.tur}>
      {not && (
        <div className="flex items-start gap-2 rounded-xl bg-marka-yumusak px-3 py-2 text-sm text-yazi">
          <Info size={16} className="mt-0.5 shrink-0 text-marka" aria-hidden />
          <span>{not}</span>
        </div>
      )}
      {govde}
    </div>
  );
}

/* ---------- KPI ---------- */

function KpiGorunum({ sonuc, birim, iyi, kompakt }: { sonuc: Extract<Sonuc, { tur: "kpi" }>; birim: string; iyi: Iyi; kompakt?: boolean }) {
  const seri = sonuc.seri;
  const renk = degisimRengi(sonuc.degisim?.onceki ?? sonuc.degisim?.gecenYil, iyi);
  const secenek = useCallback(
    (koyu: boolean) => {
      const p = palet(koyu);
      const r = renk === "iyi" ? p.iyi : renk === "kotu" ? p.kotu : p.marka;
      return kivilcimSecenek(p, (seri || []).map((d) => d.v), r, (seri || []).map((d) => d.ad), birim);
    },
    [seri, renk, birim],
  );
  const tip = sonuc.degisim?.tip || "oran";
  return (
    <div className="flex flex-col gap-2">
      <div className={cx("rakam font-extrabold leading-none tracking-tight", kompakt ? "text-3xl" : "text-5xl")} title={birimli(sonuc.deger, birim)}>
        {birimli(sonuc.deger, birim, kompakt)}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <DegisimRozeti deger={sonuc.degisim?.onceki} iyi={iyi} tip={tip} etiket="önceki" kucuk={kompakt} />
        <DegisimRozeti deger={sonuc.degisim?.gecenYil} iyi={iyi} tip={tip} etiket="geçen yıl" kucuk={kompakt} />
      </div>
      {!kompakt && (
        <div className="grid grid-cols-2 gap-2 text-sm text-soluk">
          <div>
            {sonuc.karsilastirma?.onceki?.ad || "Önceki dönem"}: <b className="rakam text-yazi">{birimli(sonuc.onceki, birim)}</b>
          </div>
          <div>
            {sonuc.karsilastirma?.gecenYil?.ad || "Geçen yıl"}: <b className="rakam text-yazi">{birimli(sonuc.gecenYil, birim)}</b>
          </div>
        </div>
      )}
      {seri && seri.length > 1 && <EChart secenek={secenek} yukseklik={kompakt ? 48 : 140} etiket="Mini grafik" />}
    </div>
  );
}

/* ---------- Seri ---------- */

function SeriGorunum({ sonuc, grafik, birim, iyi, kompakt }: { sonuc: Extract<Sonuc, { tur: "seri" }>; grafik?: GrafikTuru; birim: string; iyi: Iyi; kompakt?: boolean }) {
  const g = grafik && ["cizgi", "alan", "sutun"].includes(grafik) ? grafik : "cizgi";
  const seriler = sonuc.seriler;
  const secenek = useCallback((koyu: boolean) => seriSecenek(palet(koyu), seriler, g, birim, kompakt), [seriler, g, birim, kompakt]);
  const bos = !seriler.length || seriler.every((s) => s.veri.every((d) => d.v === null || d.v === 0));
  if (bos) return <VeriYok />;
  return (
    <div className="flex flex-col gap-2">
      {typeof sonuc.toplam === "number" && (
        <div className="flex flex-wrap items-baseline gap-2">
          <span className={cx("rakam font-bold", kompakt ? "text-xl" : "text-2xl")}>{birimli(sonuc.toplam, birim, kompakt)}</span>
          {sonuc.degisim !== undefined && sonuc.degisim !== null && <DegisimRozeti deger={sonuc.degisim} iyi={iyi} kucuk />}
          {typeof sonuc.oncekiToplam === "number" && !kompakt && <span className="text-sm text-soluk">önceki {birimli(sonuc.oncekiToplam, birim, true)}</span>}
        </div>
      )}
      <EChart secenek={secenek} yukseklik={kompakt ? 220 : 360} etiket="Zaman serisi grafiği" />
    </div>
  );
}

/* ---------- Kategori ---------- */

function KategoriGorunum({ sonuc, grafik, birim, iyi, kompakt }: { sonuc: Extract<Sonuc, { tur: "kategori" }>; grafik?: GrafikTuru; birim: string; iyi: Iyi; kompakt?: boolean }) {
  const cariAc = useCariAc();
  const satirlar = sonuc.satirlar;
  const diger = sonuc.diger;
  const g = grafik || (sonuc.sirali ? "sutun" : "cubuk");
  const dikey = g === "sutun" || (g === "cubuk" && !!sonuc.sirali);
  const secenek = useCallback(
    (koyu: boolean) => {
      const p = palet(koyu);
      if (g === "pasta") return pastaSecenek(p, satirlar, diger, birim);
      if (g === "agac") return agacSecenek(p, satirlar, diger, birim);
      if (g === "karsilastir") return karsilastirSecenek(p, satirlar, birim, iyi);
      if (g === "pareto") return paretoSecenek(p, satirlar, birim);
      return cubukSecenek(p, satirlar, diger, birim, dikey);
    },
    [g, satirlar, diger, birim, iyi, dikey],
  );
  const tikla = useCallback(
    (x: { dataIndex: number }) => {
      if (sonuc.boyut?.id !== "cari") return;
      const s = x.dataIndex < satirlar.length ? satirlar[x.dataIndex] : null;
      const k = s ? cariAnahtari(s, "cari") : null;
      if (k) cariAc(k);
    },
    [sonuc.boyut?.id, satirlar, cariAc],
  );
  if (!satirlar.length) return <VeriYok />;
  const yatay = !dikey && (g === "cubuk" || g === "karsilastir");
  const adet = satirlar.length + (diger && diger.v && !yatay ? 1 : 0);
  const yukseklik = yatay ? Math.max(kompakt ? 180 : 220, Math.min(kompakt ? 360 : 900, adet * (kompakt ? 26 : 30) + 20)) : kompakt ? 240 : 380;

  return (
    <div className="flex flex-col gap-2">
      {g === "karsilastir" && (sonuc.artan !== undefined || sonuc.karsilastirma) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {sonuc.artan !== undefined && (
            <Rozet renk={iyi === "asagi" ? "kotu" : "iyi"}>
              <TrendingUp size={14} aria-hidden /> {sonuc.artan} artan
            </Rozet>
          )}
          {sonuc.azalan !== undefined && (
            <Rozet renk={iyi === "asagi" ? "iyi" : "kotu"}>
              <TrendingDown size={14} aria-hidden /> {sonuc.azalan} azalan
            </Rozet>
          )}
          {sonuc.karsilastirma && !kompakt && (
            <span className="text-soluk">
              {sonuc.karsilastirma.ad}: {tarih(sonuc.karsilastirma.bas)} – {tarih(sonuc.karsilastirma.bit)}
            </span>
          )}
        </div>
      )}
      {g === "pareto" && sonuc.abc && (
        <div className="grid grid-cols-3 gap-2">
          {(["A", "B", "C"] as const).map((k) => (
            <div key={k} className="rounded-xl border border-cizgi px-2 py-1.5 text-center">
              <div className="text-lg font-extrabold">{k}</div>
              <div className="rakam text-xs text-soluk">
                {sayi(sonuc.abc![k].adet)} · {kisaTl(sonuc.abc![k].v)}
              </div>
            </div>
          ))}
        </div>
      )}
      {g !== "karsilastir" && g !== "pareto" && typeof sonuc.toplam === "number" && !kompakt && (
        <div className="text-sm text-soluk">
          Toplam <b className="rakam text-yazi">{birimli(sonuc.toplam, birim)}</b>
          {sonuc.adet ? ` · ${sayi(sonuc.adet)} ${sonuc.boyut?.ad?.toLocaleLowerCase("tr-TR") || "kalem"}` : ""}
        </div>
      )}
      <div className="relative">
        <EChart secenek={secenek} yukseklik={yukseklik} onTikla={tikla} etiket={`${sonuc.boyut?.ad || "Kategori"} grafiği`} />
        {g === "pasta" && typeof sonuc.toplam === "number" && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-soluk">Toplam</span>
            <span className="rakam text-lg font-extrabold">{birimli(sonuc.toplam, birim, true)}</span>
          </div>
        )}
      </div>
      {yatay && g === "cubuk" && diger && diger.v ? (
        <div className="flex items-center gap-2 text-sm text-soluk">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-notr" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{diger.ad}</span>
          <b className="rakam text-yazi">{birimli(diger.v, birim, true)}</b>
          {diger.pay != null && <span className="rakam">{yuzde(diger.pay, 0)}</span>}
        </div>
      ) : null}
      {g === "pasta" && !kompakt && (
        <ul className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
          {[...satirlar, ...(diger && diger.v ? [diger] : [])].map((s, i) => (
            <li key={String(s.k)} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.k === "__diger" ? "var(--notr)" : `var(--p${i % 8})` }} />
              <span className="min-w-0 flex-1 truncate">{s.ad}</span>
              <span className="rakam text-soluk">{yuzde(s.pay ?? null)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Matris ---------- */

function MatrisGorunum({ sonuc, birim, kompakt }: { sonuc: Extract<Sonuc, { tur: "matris" }>; birim: string; kompakt?: boolean }) {
  const { x, y, hucreler } = sonuc;
  const secenek = useCallback((koyu: boolean) => isiSecenek(palet(koyu), x, y, hucreler, birim), [x, y, hucreler, birim]);
  if (!hucreler.length) return <VeriYok />;
  return <EChart secenek={secenek} yukseklik={kompakt ? 260 : Math.max(300, y.length * 34 + 90)} etiket="Isı haritası" />;
}

/* ---------- Finansal durum (bilanço) ---------- */

function DurumGorunum({ sonuc, kompakt }: { sonuc: Extract<Sonuc, { tur: "durum" }>; kompakt?: boolean }) {
  const { varliklar, yukumlulukler } = sonuc;
  const secenek = useCallback((koyu: boolean) => bilancoSecenek(palet(koyu), varliklar || {}, yukumlulukler || {}), [varliklar, yukumlulukler]);
  const nis = sonuc.netIsletmeSermayesi;
  const oranlar = [
    { ad: "Cari oran", v: sonuc.oranlar?.cari, ideal: 1.5 },
    { ad: "Asit-test", v: sonuc.oranlar?.asitTest, ideal: 1 },
    { ad: "Nakit oranı", v: sonuc.oranlar?.nakit, ideal: 0.2 },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <div className="text-xs text-soluk">Net işletme sermayesi</div>
          <div className={cx("rakam font-extrabold", kompakt ? "text-2xl" : "text-4xl", nis < 0 ? "text-kotu" : "text-yazi")}>{kompakt ? kisaTl(nis) : tl(nis)}</div>
        </div>
        <div className="text-sm text-soluk">
          Varlık <b className="rakam text-yazi">{kisaTl(varliklar?.toplam)}</b> · Yükümlülük <b className="rakam text-yazi">{kisaTl(yukumlulukler?.toplam)}</b>
        </div>
      </div>
      <EChart secenek={secenek} yukseklik={kompakt ? 200 : 240} etiket="Varlık ve yükümlülükler" />
      <div className="flex flex-wrap gap-1.5">
        {oranlar.map((o) => (
          <Rozet key={o.ad} renk={o.v === null || o.v === undefined ? "notr" : o.v >= o.ideal ? "iyi" : "orta"} className="text-sm">
            {o.ad} <b className="rakam">{o.v === null || o.v === undefined ? "—" : `${sayi(o.v, 2)}x`}</b>
          </Rozet>
        ))}
      </div>
    </div>
  );
}

/* ---------- Nakit projeksiyonu ---------- */

export function ProjeksiyonGorunum({ sonuc, kompakt }: { sonuc: { seri: import("../../lib/types").ProjeksiyonNokta[]; minKesin: { tarih: string; deger: number } | null; ilkAcikTarih: string | null; son: { kesin: number; beklenen: number }; baslangic: number; gun: number; gunlukTahsilat?: number; gunlukOdeme?: number; vadesiGecenAlinan?: number }; kompakt?: boolean }) {
  const { seri, minKesin } = sonuc;
  const secenek = useCallback((koyu: boolean) => projeksiyonSecenek(palet(koyu), seri, minKesin, kompakt), [seri, minKesin, kompakt]);
  const degisimK = useMemo(() => (sonuc.baslangic ? (sonuc.son.kesin - sonuc.baslangic) / Math.abs(sonuc.baslangic) : null), [sonuc]);
  if (!seri.length) return <VeriYok />;
  return (
    <div className="flex flex-col gap-2">
      {sonuc.ilkAcikTarih && (
        <div className="flex items-center gap-2 rounded-xl bg-kotu-zemin px-3 py-2 text-sm font-semibold text-kotu" role="alert">
          <AlertOctagon size={18} aria-hidden /> Nakit {tarih(sonuc.ilkAcikTarih)} tarihinde eksiye düşebilir
        </div>
      )}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span>
          Bugün <b className="rakam">{kisaTl(sonuc.baslangic)}</b>
        </span>
        <span>
          {sonuc.gun}. gün <b className="rakam">{kisaTl(sonuc.son.kesin)}</b>{" "}
          {degisimK !== null && <span className={cx("rakam", renkSinif(degisimRengi(degisimK)).yazi)}>{isaretliYuzde(degisimK, 0)}</span>}
        </span>
        {minKesin && (
          <span className="text-soluk">
            En düşük <b className="rakam text-yazi">{kisaTl(minKesin.deger)}</b> ({tarih(minKesin.tarih)})
          </span>
        )}
      </div>
      <EChart secenek={secenek} yukseklik={kompakt ? 200 : 340} etiket="Nakit projeksiyonu" />
      {!kompakt && (sonuc.gunlukTahsilat || sonuc.gunlukOdeme) ? (
        <div className="flex flex-wrap gap-3 text-sm text-soluk">
          <span>Günlük ort. tahsilat <b className="rakam text-iyi">{kisaTl(sonuc.gunlukTahsilat)}</b></span>
          <span>Günlük ort. ödeme <b className="rakam text-kotu">{kisaTl(sonuc.gunlukOdeme)}</b></span>
          {sonuc.vadesiGecenAlinan ? <span>Vadesi geçen alınan çek/senet <b className="rakam text-orta">{kisaTl(sonuc.vadesiGecenAlinan)}</b></span> : null}
        </div>
      ) : null}
    </div>
  );
}
