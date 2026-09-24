// Ana ekran: sağlık, büyüme, anlık finansal durum, bu ay, nakit projeksiyonu, uyarılar, oranlar
import { useCallback, useState, type ReactNode } from "react";
import { ChevronRight, ArrowUpRight, ArrowDownRight, Minus, AlertOctagon } from "lucide-react";
import { sorgu } from "../lib/api";
import type { DovizMap, DurumYanit, Uyari } from "../lib/types";
import { useVeri } from "../state/rapor";
import { useUygulama } from "../state/uygulama";
import { Baglanti, useYon } from "../lib/yonlendirici";
import { doviz, isaretliYuzde, kisaTl, sayi, tarih, tl } from "../lib/bicim";
import { Cekmece, DegisimRozeti, HataKutusu, HataSiniri, Iskelet, Ikon, Kart, cx, degisimRengi, renkSinif } from "../components/ui";
import { SaglikDetay, SaglikGosterge, SutunCubuklari } from "../components/saglik";
import { BuyumeOzet } from "../components/buyume";
import { EChart } from "../charts/EChart";
import { palet, projeksiyonSecenek } from "../charts/secenekler";

export function Durum() {
  const { firmaParam } = useUygulama();
  const { veri, hata, yenile } = useVeri<DurumYanit>(`/durum${sorgu({ firma: firmaParam })}`);
  const [saglikAcik, setSaglikAcik] = useState(false);
  const kapatSaglik = useCallback(() => setSaglikAcik(false), []);

  if (hata && !veri) return <Kart className="p-4"><HataKutusu mesaj={hata.message} yenile={yenile} /></Kart>;
  const d = veri;

  return (
    <div className="flex flex-col gap-4" data-testid="durum-sayfasi">
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sağlık */}
        <Bolum baslik="Finansal sağlık" ikon="HeartPulse" testId="bolum-saglik" ipucu="0-100 arası skor; ayrıntı için dokunun">
          {d ? (
            <button type="button" onClick={() => setSaglikAcik(true)} className="flex w-full flex-col gap-3 rounded-xl text-left hover:bg-kart2/50" aria-label="Sağlık skorunun ayrıntısı">
              <SaglikGosterge saglik={d.saglik} boyut={230} />
              <SutunCubuklari saglik={d.saglik} />
            </button>
          ) : (
            <Iskelet className="h-64 w-full" />
          )}
        </Bolum>

        {/* Büyüme */}
        <Bolum baslik="Büyüme" ikon="Rocket" testId="bolum-buyume" ipucu={d?.buyume.ufukAd || "Birleşik büyüme endeksi"} baglanti="/rapor/ozel.buyume">
          {d ? <BuyumeOzet buyume={d.buyume} /> : <Iskelet className="h-48 w-full" />}
        </Bolum>
      </div>

      {/* Finansal durum */}
      <section aria-label="Anlık finansal durum" data-testid="bolum-finans">
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {d ? <FinansKutulari d={d} /> : Array.from({ length: 8 }, (_, i) => <Iskelet key={i} className="h-28" />)}
        </div>
      </section>

      {/* Bu ay */}
      <Bolum baslik="Bu ay" ikon="Calendar" testId="bolum-buay" ipucu="Ay başından bugüne; ▲▼ geçen yılın aynı dönemine göre, küçük ok önceki aya göre">
        {d ? <BuAySeridi d={d} /> : <Iskelet className="h-20 w-full" />}
      </Bolum>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Nakit projeksiyonu */}
        <Bolum baslik="Nakit (90 gün)" ikon="LineChart" testId="bolum-projeksiyon" className="lg:col-span-3" baglanti="/rapor/ozel.nakit_projeksiyonu" ipucu="Düz çizgi: kesin vadeler (çek/senet). Kesikli: beklenen tahsilat ve ödemelerle.">
          {d ? <HataSiniri><ProjeksiyonMini d={d} /></HataSiniri> : <Iskelet className="h-48 w-full" />}
        </Bolum>

        {/* Uyarılar */}
        <Bolum baslik="Uyarılar" ikon="Bell" testId="bolum-uyarilar" className="lg:col-span-2" baglanti="/uyarilar" baglantiAd="Tümü">
          {d ? <UyariListesi uyarilar={d.uyarilar.slice(0, 3)} /> : <Iskelet className="h-40 w-full" />}
        </Bolum>
      </div>

      {/* Oranlar */}
      <section aria-label="Oranlar" data-testid="bolum-oranlar">
        {d ? <OranCipleri d={d} /> : <Iskelet className="h-12 w-full" />}
      </section>

      {d && (
        <Cekmece acik={saglikAcik} kapat={kapatSaglik} baslik="Finansal sağlık" ikon="HeartPulse" genis>
          <SaglikDetay saglik={d.saglik} />
        </Cekmece>
      )}
    </div>
  );
}

function Bolum({ baslik, ikon, children, testId, className, baglanti, baglantiAd, ipucu }: { baslik: string; ikon: string; children: ReactNode; testId?: string; className?: string; baglanti?: string; baglantiAd?: string; ipucu?: string }) {
  return (
    <Kart className={cx("flex flex-col gap-3 p-4", className)} data-testid={testId}>
      <div className="flex items-center gap-2">
        <Ikon ad={ikon} boyut={20} className="text-marka" />
        <h2 className="flex-1 text-base font-bold" title={ipucu}>
          {baslik}
        </h2>
        {baglanti && (
          <Baglanti to={baglanti} className="inline-flex min-h-9 items-center gap-0.5 rounded-lg px-2 text-sm font-semibold text-marka hover:bg-kart2" aria-label={`${baslik}: ${baglantiAd || "Ayrıntı"}`} title={baglantiAd || "Ayrıntı"}>
            {baglantiAd && <span>{baglantiAd}</span>}
            <ChevronRight size={18} aria-hidden />
          </Baglanti>
        )}
      </div>
      <HataSiniri>{children}</HataSiniri>
    </Kart>
  );
}

function DovizCipleri({ m, kurlu }: { m?: DovizMap; kurlu?: boolean }) {
  const l = Object.entries(m || {}).filter(([, v]) => v);
  if (!l.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {l.map(([k, v]) => (
        <span key={k} className="rounded-md bg-kart2 px-1.5 py-0.5 text-[11px] font-medium text-soluk rakam" title={kurlu ? "Döviz bakiyesi (TL karşılığı toplamlara dahil)" : "Döviz bakiyesi"}>
          {doviz(k, v)}
        </span>
      ))}
    </div>
  );
}

function FinansKutu({ ikon, ad, deger, alt, rapor, renk, testId, children }: { ikon: string; ad: string; deger: number; alt?: ReactNode; rapor: string; renk?: string; testId?: string; children?: ReactNode }) {
  const r = renkSinif(renk || "notr");
  return (
    <Baglanti to={`/rapor/${rapor}`} className="group flex min-h-28 flex-col gap-1.5 rounded-2xl border border-cizgi bg-kart p-3 transition hover:border-marka sm:p-4" data-testid={testId} title={`${ad}: ${tl(deger)}`}>
      <div className="flex items-center gap-2">
        <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", renk ? cx(r.zemin, r.yazi) : "bg-marka-yumusak text-marka")}>
          <Ikon ad={ikon} boyut={20} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-soluk">{ad}</span>
      </div>
      <div className={cx("rakam text-2xl font-extrabold leading-tight sm:text-[1.7rem]", deger < 0 && "text-kotu")}>{kisaTl(deger)}</div>
      {alt && <div className="truncate text-xs text-soluk">{alt}</div>}
      {children}
    </Baglanti>
  );
}

function FinansKutulari({ d }: { d: DurumYanit }) {
  const f = d.durum;
  const kurlu = f.dovizTL !== null && f.dovizTL !== undefined;
  return (
    <>
      <FinansKutu ikon="Wallet" ad="Kasa" deger={f.kasa} rapor="ozel.kasa_durumu" testId="kutu-kasa">
        <DovizCipleri m={f.kasaDoviz} kurlu={kurlu} />
      </FinansKutu>
      <FinansKutu ikon="Landmark" ad="Banka" deger={f.banka} rapor="ozel.banka_durumu" alt={f.bankaKredi ? `kredi ${kisaTl(f.bankaKredi)}` : undefined} testId="kutu-banka">
        <DovizCipleri m={f.bankaDoviz} kurlu={kurlu} />
      </FinansKutu>
      <FinansKutu ikon="HandCoins" ad="Alacak" deger={f.alacak} rapor="ozel.alacak_yaslandirma" alt={`${sayi(f.musteriSayisi)} müşteri`} testId="kutu-alacak" />
      <FinansKutu ikon="Truck" ad="Borç" deger={f.borc} rapor="ozel.alacakli_tedarikciler" alt={`${sayi(f.tedarikciSayisi)} tedarikçi`} testId="kutu-borc" />
      <FinansKutu ikon="Ticket" ad="Alınan çek/senet" deger={f.cekAlinan + (f.senetAlinan || 0)} rapor="ozel.cek_alinan" alt={`${sayi(f.cekAlinanAdet)} çek · senet ${kisaTl(f.senetAlinan)}`} testId="kutu-cek-alinan" />
      <FinansKutu ikon="TicketX" ad="Verilen çek/senet" deger={f.cekVerilen + (f.senetVerilen || 0)} rapor="ozel.cek_verilen" alt={`${sayi(f.cekVerilenAdet)} çek · senet ${kisaTl(f.senetVerilen)}`} testId="kutu-cek-verilen" />
      {f.stokVar && <FinansKutu ikon="Warehouse" ad="Stok" deger={f.stok} rapor="ozel.stok_degeri" testId="kutu-stok" />}
      <FinansKutu
        ikon="Scale"
        ad="Net işletme sermayesi"
        deger={f.netIsletmeSermayesi}
        rapor="ozel.finansal_durum"
        renk={f.netIsletmeSermayesi >= 0 ? "iyi" : "kritik"}
        alt={f.oranlar?.cari ? `cari oran ${sayi(f.oranlar.cari, 2)}x` : undefined}
        testId="kutu-nis"
      />
    </>
  );
}

function KucukOk({ v }: { v: number | null }) {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  const r = renkSinif(degisimRengi(v));
  const I = v > 0.005 ? ArrowUpRight : v < -0.005 ? ArrowDownRight : Minus;
  return (
    <span className={cx("inline-flex items-center text-xs font-semibold rakam", r.yazi)} title={`Önceki aya göre ${isaretliYuzde(v)}`}>
      <I size={14} aria-hidden />
      {isaretliYuzde(v, 0)}
    </span>
  );
}

function BuAySeridi({ d }: { d: DurumYanit }) {
  const kalemler = [
    { k: "satis", ad: "Satış", ikon: "ShoppingCart", rapor: "satis.kpi" },
    { k: "tahsilat", ad: "Tahsilat", ikon: "HandCoins", rapor: "tahsilat.kpi" },
    { k: "kar", ad: "Kâr", ikon: "PiggyBank", rapor: "brut_kar.kpi" },
    { k: "siparis", ad: "Sipariş", ikon: "ClipboardList", rapor: "siparis_tutar.kpi" },
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {kalemler.map((x) => {
        const v = d.buAy[x.k];
        if (!v) return null;
        return (
          <Baglanti key={x.k} to={`/rapor/${x.rapor}?donem=bu_ay`} className="flex flex-col gap-1 rounded-xl bg-kart2 p-3 hover:ring-2 hover:ring-marka/40" data-testid={`buay-${x.k}`} title={`${x.ad}: ${tl(v.simdi)} · geçen yıl ${tl(v.gecenYil)} · önceki ay ${tl(v.onceki)}`}>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-soluk">
              <Ikon ad={x.ikon} boyut={16} /> {x.ad}
            </span>
            <span className="rakam text-xl font-extrabold">{kisaTl(v.simdi)}</span>
            <span className="flex flex-wrap items-center gap-1.5">
              <DegisimRozeti deger={v.yoy} kucuk etiket="" />
              <KucukOk v={v.pop} />
            </span>
          </Baglanti>
        );
      })}
    </div>
  );
}

function ProjeksiyonMini({ d }: { d: DurumYanit }) {
  const p = d.projeksiyon;
  const { git } = useYon();
  const secenek = useCallback((koyu: boolean) => projeksiyonSecenek(palet(koyu), p.seri, p.minKesin, true), [p]);
  return (
    <div className="flex flex-col gap-2">
      {p.ilkAcikTarih && (
        <div className="flex items-center gap-2 rounded-xl bg-kotu-zemin px-3 py-2 text-sm font-semibold text-kotu" role="alert">
          <AlertOctagon size={18} aria-hidden /> Nakit {tarih(p.ilkAcikTarih)} tarihinde eksiye düşebilir
        </div>
      )}
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
        <span>
          Bugün <b className="rakam text-lg">{kisaTl(p.baslangic)}</b>
        </span>
        <span className="text-soluk">
          90. gün <b className="rakam text-yazi">{kisaTl(p.son.kesin)}</b> · beklenen <b className="rakam text-yazi">{kisaTl(p.son.beklenen)}</b>
        </span>
      </div>
      <EChart secenek={secenek} yukseklik={190} onTikla={() => git("/rapor/ozel.nakit_projeksiyonu")} etiket="90 günlük nakit projeksiyonu" />
    </div>
  );
}

export const seviyeBilgi: Record<Uyari["seviye"], { renk: string; ad: string; ikon: string }> = {
  kritik: { renk: "kritik", ad: "Kritik", ikon: "ShieldAlert" },
  uyari: { renk: "orta", ad: "Uyarı", ikon: "TriangleAlert" },
  bilgi: { renk: "notr", ad: "Bilgi", ikon: "Bell" },
};

export function UyariSatiri({ u }: { u: Uyari }) {
  const s = seviyeBilgi[u.seviye] || seviyeBilgi.bilgi;
  const r = renkSinif(s.renk);
  const icerik = (
    <>
      <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", r.zemin, r.yazi)} title={s.ad}>
        <Ikon ad={u.ikon || s.ikon} boyut={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{u.baslik}</span>
        <span className="block text-sm text-soluk">{u.mesaj}</span>
      </span>
      {u.rapor && <ChevronRight size={18} className="mt-2 shrink-0 text-soluk" aria-hidden />}
    </>
  );
  return u.rapor ? (
    <Baglanti to={`/rapor/${u.rapor}`} className="flex items-start gap-3 rounded-xl p-2 hover:bg-kart2" data-testid="uyari">
      {icerik}
    </Baglanti>
  ) : (
    <div className="flex items-start gap-3 p-2" data-testid="uyari">
      {icerik}
    </div>
  );
}

function UyariListesi({ uyarilar }: { uyarilar: Uyari[] }) {
  if (!uyarilar.length)
    return (
      <div className="flex items-center gap-3 rounded-xl bg-iyi-zemin p-3 text-iyi">
        <Ikon ad="BadgeCheck" boyut={22} /> <span className="font-semibold">Her şey yolunda</span>
      </div>
    );
  return (
    <div className="flex flex-col gap-1">
      {uyarilar.map((u) => (
        <UyariSatiri key={u.id} u={u} />
      ))}
    </div>
  );
}

function OranCipleri({ d }: { d: DurumYanit }) {
  const o = d.oranlar;
  const l = [
    { ad: "Tahsil süresi", ikon: "Timer", v: o.dso, bicim: (v: number) => `${sayi(v)} gün`, ipucu: "DSO: alacakların ortalama tahsil süresi. Düşük olması iyi.", renk: (v: number) => (v <= 45 ? "iyi" : v <= 75 ? "orta" : "kritik"), rapor: "ozel.dso_seyri" },
    { ad: "Ödeme süresi", ikon: "CalendarClock", v: o.dpo, bicim: (v: number) => `${sayi(v)} gün`, ipucu: "DPO: tedarikçilere ortalama ödeme süresi.", renk: () => "notr", rapor: "ozel.alacakli_tedarikciler" },
    { ad: "Nakit yeterliliği", ikon: "Hourglass", v: o.nakitGun, bicim: (v: number) => `${sayi(v)} gün`, ipucu: "Mevcut nakit, ortalama ödemelerle kaç gün yeter. 60 gün üstü iyi.", renk: (v: number) => (v >= 60 ? "iyi" : v >= 30 ? "orta" : "kritik"), rapor: "ozel.likidite_seyri" },
    { ad: "Tahsilat oranı", ikon: "HandCoins", v: o.tahsilatOrani90, bicim: (v: number) => `%${sayi(v)}`, ipucu: "Son 90 günde satışların yüzde kaçı kadar tahsilat yapıldı. %95 üstü iyi.", renk: (v: number) => (v >= 95 ? "iyi" : v >= 80 ? "orta" : "kritik"), rapor: "tahsilat.kpi" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {l.map((x) => {
        const v = typeof x.v === "number" ? x.v : null;
        const r = renkSinif(v === null ? "notr" : x.renk(v));
        return (
          <Baglanti key={x.ad} to={`/rapor/${x.rapor}`} className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-cizgi bg-kart px-3 py-1.5 hover:border-marka" title={x.ipucu} data-testid="oran-cip">
            <span className={cx("flex h-7 w-7 items-center justify-center rounded-lg", r.zemin, r.yazi)}>
              <Ikon ad={x.ikon} boyut={16} />
            </span>
            <span className="text-sm text-soluk">{x.ad}</span>
            <b className="rakam">{v === null ? "—" : x.bicim(v)}</b>
          </Baglanti>
        );
      })}
    </div>
  );
}
