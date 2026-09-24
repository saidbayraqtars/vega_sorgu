// Özelleştirilebilir panolar: sekmeler, ızgara, düzenleme modu (sürükle-bırak, kutu menüsü), katalog çekmecesi
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Check, Plus, GripVertical, Settings2, Trash2, RotateCcw, Maximize2, Cloud, CloudOff, LayoutDashboard } from "lucide-react";
import { api } from "../lib/api";
import type { Boyut, GrafikTuru, Kutu, Pano, RaporTanimi } from "../lib/types";
import { GRAFIK } from "../lib/grafikler";
import { tarih } from "../lib/bicim";
import { Baglanti, useYon } from "../lib/yonlendirici";
import { useUygulama } from "../state/uygulama";
import { useKatalog, useRapor } from "../state/rapor";
import { kutuEkle, panoGuncelle, panoOlustur, panoSil, panolariSifirla, panolariYukle, usePanolar, yeniId } from "../state/panolar";
import { Alan, Cekmece, Dugme, HataKutusu, HataSiniri, Ikon, IkonDugme, Kart, KutuIskelet, Pencere, Rozet, VeriYok, cx, girdiSinif } from "../components/ui";
import { SonucGorunum } from "../components/sonuc/SonucGorunum";
import { KatalogGezgini } from "../components/KatalogGezgini";
import { BoyutSecici } from "./RaporGoruntuleyici";

const PANO_IKONLARI = ["LayoutDashboard", "LayoutGrid", "ShoppingCart", "Wallet", "Users", "Package", "Warehouse", "HandCoins", "PiggyBank", "Landmark", "Truck", "Rocket", "HeartPulse", "Star", "Target", "Briefcase"];
const N_SECENEK = [5, 10, 20, 50];

const boyutSinif: Record<Boyut, string> = { s: "col-span-1", m: "col-span-1 sm:col-span-2", l: "col-span-1 sm:col-span-2 lg:col-span-4" };

export function Panolar({ id }: { id?: string }) {
  const { panolar, hata, kaydediliyor, kayitHata } = usePanolar();
  const { kullanici } = useUygulama();
  const { git } = useYon();
  const [duzenle, setDuzenle] = useState(false);
  const [katalogAcik, setKatalogAcik] = useState(false);
  const [yeniPanoAcik, setYeniPanoAcik] = useState(false);
  const [panoAyarAcik, setPanoAyarAcik] = useState(false);
  const [sifirlaAcik, setSifirlaAcik] = useState(false);

  useEffect(() => {
    void panolariYukle();
  }, []);

  const anaPano = kullanici?.tercihler?.anaPano;
  const aktif = useMemo(() => {
    if (!panolar?.length) return null;
    const n = Number(id);
    return panolar.find((p) => p.id === n) || panolar.find((p) => p.id === anaPano) || panolar[0];
  }, [panolar, id, anaPano]);

  const sekmeSec = (p: Pano) => {
    git(`/pano/${p.id}`);
    void api("/auth/tercihler", { method: "PUT", govde: { anaPano: p.id } }).catch(() => undefined);
  };

  if (hata && !panolar) return <Kart className="p-4"><HataKutusu mesaj={hata} yenile={() => void panolariYukle(true)} /></Kart>;
  if (!panolar) return <KutuIskelet yukseklik="h-96" />;

  return (
    <div className="flex flex-col gap-3" data-testid="panolar-sayfasi">
      {/* Sekmeler */}
      <div className="flex items-center gap-2">
        <div className="ince-kaydirma -mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 py-1" role="tablist" aria-label="Panolar">
          {panolar.map((p) => {
            const secili = p.id === aktif?.id;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={secili}
                onClick={() => sekmeSec(p)}
                className={cx("inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold whitespace-nowrap", secili ? "bg-marka text-white dark:text-[#0b1020]" : "bg-kart text-soluk hover:text-yazi")}
                data-testid="pano-sekme"
              >
                <Ikon ad={p.ikon} boyut={18} />
                {p.ad}
              </button>
            );
          })}
          <IkonDugme etiket="Yeni pano" onClick={() => setYeniPanoAcik(true)} className="bg-kart" data-testid="yeni-pano">
            <Plus size={20} aria-hidden />
          </IkonDugme>
        </div>
        <span className="hidden text-soluk sm:inline-flex" title={kayitHata ? `Kaydedilemedi: ${kayitHata}` : kaydediliyor ? "Kaydediliyor…" : "Kaydedildi"} aria-live="polite">
          {kayitHata ? <CloudOff size={18} className="text-kotu" aria-label="Kaydedilemedi" /> : <Cloud size={18} className={cx(kaydediliyor && "animate-pulse text-marka")} aria-label={kaydediliyor ? "Kaydediliyor" : "Kaydedildi"} />}
        </span>
        <Dugme tur={duzenle ? "birincil" : "ikincil"} onClick={() => setDuzenle((d) => !d)} aria-pressed={duzenle} data-testid="duzenle" title={duzenle ? "Bitti" : "Düzenle"}>
          {duzenle ? <Check size={18} aria-hidden /> : <Pencil size={18} aria-hidden />}
          <span className="hidden sm:inline">{duzenle ? "Bitti" : "Düzenle"}</span>
        </Dugme>
      </div>

      {kayitHata && (
        <p className="rounded-xl bg-kotu-zemin px-3 py-2 text-sm text-kotu" role="alert">
          Kaydedilemedi: {kayitHata}
        </p>
      )}

      {duzenle && aktif && (
        <div className="flex flex-wrap gap-2" data-testid="duzenleme-cubugu">
          <Dugme tur="birincil" onClick={() => setKatalogAcik(true)} data-testid="kutu-ekle">
            <Plus size={18} aria-hidden /> Kutu ekle
          </Dugme>
          <Dugme onClick={() => setPanoAyarAcik(true)}>
            <Settings2 size={18} aria-hidden /> Pano
          </Dugme>
          <Dugme onClick={() => setSifirlaAcik(true)} title="Tüm panoları varsayılana döndür">
            <RotateCcw size={18} aria-hidden /> Varsayılana dön
          </Dugme>
        </div>
      )}

      {aktif ? <PanoIzgarasi pano={aktif} duzenle={duzenle} kutuEkleAc={() => setKatalogAcik(true)} /> : <VeriYok mesaj="Pano yok" />}

      {aktif && <KatalogCekmecesi acik={katalogAcik} kapat={() => setKatalogAcik(false)} pano={aktif} />}
      <YeniPanoPenceresi acik={yeniPanoAcik} kapat={() => setYeniPanoAcik(false)} olustu={(pid) => { setDuzenle(true); git(`/pano/${pid}`); }} />
      {aktif && <PanoAyarPenceresi acik={panoAyarAcik} kapat={() => setPanoAyarAcik(false)} pano={aktif} silindi={() => git("/pano", { degistir: true })} tekPano={panolar.length <= 1} />}
      <Pencere
        acik={sifirlaAcik}
        kapat={() => setSifirlaAcik(false)}
        baslik="Varsayılana dön"
        alt={
          <>
            <Dugme onClick={() => setSifirlaAcik(false)}>Vazgeç</Dugme>
            <Dugme tur="tehlike" onClick={async () => { await panolariSifirla(); setSifirlaAcik(false); git("/pano", { degistir: true }); }}>
              <RotateCcw size={16} aria-hidden /> Sıfırla
            </Dugme>
          </>
        }
      >
        <p>Tüm panolarınız silinip 3 varsayılan pano yeniden oluşturulacak. Emin misiniz?</p>
      </Pencere>
    </div>
  );
}

/* ---------- Izgara ---------- */

function PanoIzgarasi({ pano, duzenle, kutuEkleAc }: { pano: Pano; duzenle: boolean; kutuEkleAc: () => void }) {
  const sensorler = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const kutular = pano.widgets;
  const idler = useMemo(() => kutular.map((k) => k.id), [kutular]);

  const suruklemeBitti = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const eski = idler.indexOf(String(active.id));
    const yeni = idler.indexOf(String(over.id));
    if (eski < 0 || yeni < 0) return;
    panoGuncelle(pano.id, { widgets: arrayMove(kutular, eski, yeni) });
  };

  const kutuDegistir = useCallback(
    (kid: string, degisim: Partial<Kutu> | null) => {
      const guncel = pano.widgets;
      if (degisim === null) panoGuncelle(pano.id, { widgets: guncel.filter((k) => k.id !== kid) });
      else
        panoGuncelle(
          pano.id,
          {
            widgets: guncel.map((k) => {
              if (k.id !== kid) return k;
              const y = { ...k, ...degisim } as Kutu;
              for (const a of Object.keys(y) as (keyof Kutu)[]) if (y[a] === undefined || y[a] === "") delete y[a];
              return y;
            }),
          },
        );
    },
    [pano.id, pano.widgets],
  );

  if (!kutular.length)
    return (
      <Kart className="flex flex-col items-center gap-3 p-8 text-center">
        <LayoutDashboard size={40} className="text-soluk" aria-hidden />
        <p className="text-soluk">Bu pano boş</p>
        <Dugme tur="birincil" onClick={kutuEkleAc}>
          <Plus size={18} aria-hidden /> Kutu ekle
        </Dugme>
      </Kart>
    );

  return (
    <DndContext sensors={sensorler} collisionDetection={closestCenter} onDragEnd={suruklemeBitti}>
      <SortableContext items={idler} strategy={rectSortingStrategy} disabled={!duzenle}>
        <div className="grid grid-flow-dense grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="pano-izgara">
          {kutular.map((k) => (
            <SiraliKutu key={k.id} kutu={k} duzenle={duzenle} degistir={kutuDegistir} />
          ))}
          {duzenle && (
            <button type="button" onClick={kutuEkleAc} className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-cizgi text-soluk hover:border-marka hover:text-marka" aria-label="Kutu ekle">
              <Plus size={32} aria-hidden />
              <span className="text-sm font-semibold">Kutu ekle</span>
            </button>
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SiraliKutu({ kutu, duzenle, degistir }: { kutu: Kutu; duzenle: boolean; degistir: (id: string, d: Partial<Kutu> | null) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: kutu.id, disabled: !duzenle });
  const stil = { transform: CSS.Translate.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={stil} className={cx(boyutSinif[kutu.boyut] || boyutSinif.m, isDragging && "z-10 opacity-80")} data-testid="kutu" data-kutu-rapor={kutu.rapor} data-kutu-id={kutu.id}>
      <PanoKutusu kutu={kutu} duzenle={duzenle} degistir={degistir} tutamak={duzenle ? { ...attributes, ...listeners } : undefined} />
    </div>
  );
}

function useGorunur<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [gorunur, setGorunur] = useState(false);
  useEffect(() => {
    if (gorunur || !ref.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setGorunur(true);
      return;
    }
    const g = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setGorunur(true), { rootMargin: "200px" });
    g.observe(ref.current);
    return () => g.disconnect();
  }, [gorunur]);
  return [ref, gorunur];
}

const PanoKutusu = memo(function PanoKutusu({ kutu, duzenle, degistir, tutamak }: { kutu: Kutu; duzenle: boolean; degistir: (id: string, d: Partial<Kutu> | null) => void; tutamak?: Record<string, unknown> }) {
  const { donem, firmaParam, meta } = useUygulama();
  const { veri: katalog } = useKatalog();
  const tanim = useMemo(() => katalog?.raporlar.find((r) => r.id === kutu.rapor), [katalog, kutu.rapor]);
  const [ref, gorunur] = useGorunur<HTMLDivElement>();
  const [menuAcik, setMenuAcik] = useState(false);
  const pr = tanim?.parametreler || { donem: true };
  const kendiDonemi = !!kutu.donem;
  // Zaman yapılı raporlar (trend, kümülatif, ısı/mevsim) kısa genel dönemde anlamsızlaşır (ör. "Bu ay" → tek sütun);
  // kendi dönemi yoksa raporun varsayılan dönemini kullanır. Diğer kutular genel dönemi izler.
  const zamanYapili = !!tanim && ["trend", "kumulatif", "isi", "mevsim"].includes(tanim.gorunum);
  const d = kutu.donem ? { kod: kutu.donem, bas: kutu.bas, bit: kutu.bit } : zamanYapili && tanim ? { kod: tanim.donem } as { kod: string; bas?: string; bit?: string } : donem;
  const param = {
    donem: pr.donem === false ? undefined : d.kod,
    bas: d.bas,
    bit: d.bit,
    kirilim: pr.kirilim ? kutu.kirilim : undefined,
    n: pr.n ? kutu.n : undefined,
  };
  const { veri, hata, yenile } = useRapor(gorunur && katalog ? kutu.rapor : null, param, firmaParam);
  const donemAd = d.kod === "ozel" ? `${tarih(d.bas)}–${tarih(d.bit)}` : meta?.donemler.find((x) => x.kod === d.kod)?.ad;
  const baslik = kutu.baslik || tanim?.kisa || veri?.rapor.kisa || kutu.rapor;
  const grafik = kutu.grafik || tanim?.grafik;
  const viewerYolu = `/rapor/${encodeURIComponent(kutu.rapor)}?${new URLSearchParams(Object.entries({ donem: param.donem, bas: d.kod === "ozel" ? d.bas : undefined, bit: d.kod === "ozel" ? d.bit : undefined, kirilim: param.kirilim, n: param.n, grafik: kutu.grafik }).filter(([, v]) => v !== undefined && v !== null) as [string, string][]).toString()}`;

  return (
    <Kart className={cx("flex h-full min-h-40 flex-col", duzenle && "ring-2 ring-marka/20")}>
      <div className="flex items-center gap-2 border-b border-cizgi px-3 py-2">
        {duzenle && (
          <button type="button" className="-ml-1 flex h-9 w-8 cursor-grab touch-none items-center justify-center rounded-lg text-soluk hover:bg-kart2 active:cursor-grabbing" aria-label="Taşı" title="Sürükleyerek taşı" {...tutamak} data-testid="kutu-tasi">
            <GripVertical size={18} aria-hidden />
          </button>
        )}
        <Ikon ad={tanim?.ikon || veri?.rapor.ikon} boyut={18} className="shrink-0 text-marka" />
        <h3 className="min-w-0 flex-1 truncate text-sm font-bold" title={tanim?.ad}>
          {baslik}
        </h3>
        {pr.donem !== false && donemAd && (
          <Rozet renk={kendiDonemi ? "mor" : "notr"} className="hidden max-w-28 truncate sm:inline-flex">
            {donemAd}
          </Rozet>
        )}
        {duzenle ? (
          <IkonDugme etiket="Kutu ayarları" onClick={() => setMenuAcik(true)} className="h-9 w-9" data-testid="kutu-menu">
            <Settings2 size={18} aria-hidden />
          </IkonDugme>
        ) : (
          <Baglanti to={viewerYolu} className="flex h-9 w-9 items-center justify-center rounded-lg text-soluk hover:bg-kart2 hover:text-yazi" aria-label={`${baslik}: büyüt`} title="Büyüt">
            <Maximize2 size={16} aria-hidden />
          </Baglanti>
        )}
      </div>
      <div ref={ref} className="flex-1 p-3">
        <HataSiniri sifirla={`${kutu.grafik}|${veri?.veriSurumu}`}>
          {katalog && !tanim ? (
            <HataKutusu mesaj="Rapor artık yok" />
          ) : hata && !veri ? (
            <HataKutusu mesaj={hata.message} yenile={yenile} />
          ) : !veri ? (
            <KutuIskelet yukseklik={kutu.boyut === "s" ? "h-20" : "h-44"} />
          ) : (
            <SonucGorunum sonuc={veri.sonuc} grafik={grafik} birim={veri.rapor.birim} iyi={veri.rapor.iyi} kompakt />
          )}
        </HataSiniri>
      </div>
      {tanim && <KutuAyarPenceresi acik={menuAcik} kapat={() => setMenuAcik(false)} kutu={kutu} tanim={tanim} degistir={(dg) => degistir(kutu.id, dg)} />}
    </Kart>
  );
});

/* ---------- Kutu ayarları ---------- */

function KutuAyarPenceresi({ acik, kapat, kutu, tanim, degistir }: { acik: boolean; kapat: () => void; kutu: Kutu; tanim: RaporTanimi; degistir: (d: Partial<Kutu> | null) => void }) {
  const { meta } = useUygulama();
  const [baslik, setBaslik] = useState(kutu.baslik || "");
  const [bas, setBas] = useState(kutu.bas || "");
  const [bit, setBit] = useState(kutu.bit || "");
  const pr = tanim.parametreler;
  const grafik = kutu.grafik || tanim.grafik;
  return (
    <Pencere
      acik={acik}
      kapat={kapat}
      baslik={tanim.kisa}
      alt={
        <>
          <Dugme tur="tehlike" onClick={() => { degistir(null); kapat(); }} data-testid="kutu-sil">
            <Trash2 size={16} aria-hidden /> Sil
          </Dugme>
          <Dugme tur="birincil" onClick={() => { if (baslik !== (kutu.baslik || "")) degistir({ baslik: baslik.trim() || undefined }); kapat(); }} data-testid="kutu-tamam">
            <Check size={16} aria-hidden /> Tamam
          </Dugme>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-testid="kutu-ayar">
        {tanim.grafikler.length > 1 && (
          <Alan etiket="Grafik">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Grafik türü">
              {tanim.grafikler.map((g: GrafikTuru) => {
                const G = GRAFIK[g];
                const aktif = grafik === g;
                return (
                  <button key={g} type="button" aria-pressed={aktif} onClick={() => degistir({ grafik: g === tanim.grafik ? undefined : g })} className={cx("flex min-h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 text-xs", aktif ? "border-marka bg-marka-yumusak font-semibold text-marka" : "border-cizgi hover:bg-kart2")} data-grafik-sec={g}>
                    {G && <G.ikon size={20} aria-hidden />}
                    {G?.ad || g}
                  </button>
                );
              })}
            </div>
          </Alan>
        )}
        <Alan etiket="Boyut">
          <BoyutSecici deger={kutu.boyut} degistir={(b) => degistir({ boyut: b })} />
        </Alan>
        {pr.donem && meta && (
          <Alan etiket="Dönem">
            <select className={girdiSinif} value={kutu.donem || ""} onChange={(e) => degistir(e.target.value === "ozel" ? {} : { donem: e.target.value || undefined, bas: undefined, bit: undefined })} data-testid="kutu-donem">
              <option value="">Genel dönemi izle</option>
              {meta.donemler.filter((d) => d.kod !== "ozel").map((d) => (
                <option key={d.kod} value={d.kod}>
                  {d.ad}
                </option>
              ))}
              <option value="ozel">Tarih aralığı…</option>
            </select>
            <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
              <input type="date" aria-label="Başlangıç" className={girdiSinif} value={bas} onChange={(e) => setBas(e.target.value)} />
              <input type="date" aria-label="Bitiş" className={girdiSinif} value={bit} onChange={(e) => setBit(e.target.value)} />
              <IkonDugme etiket="Tarih aralığını uygula" disabled={!bas || !bit || bas > bit} onClick={() => degistir({ donem: "ozel", bas, bit })} className="h-11 w-11 border border-cizgi">
                <Check size={18} aria-hidden />
              </IkonDugme>
            </div>
          </Alan>
        )}
        {pr.n && (
          <Alan etiket="İlk N">
            <div className="flex rounded-xl bg-kart2 p-0.5" role="group" aria-label="İlk N">
              {N_SECENEK.map((n) => (
                <button key={n} type="button" aria-pressed={kutu.n === n} onClick={() => degistir({ n })} className={cx("min-h-9 flex-1 rounded-lg text-sm rakam", kutu.n === n ? "bg-kart font-bold text-marka shadow" : "text-soluk")}>
                  {n}
                </button>
              ))}
            </div>
          </Alan>
        )}
        {pr.kirilim && meta && (
          <Alan etiket="Kırılım">
            <select className={girdiSinif} value={kutu.kirilim || ""} onChange={(e) => degistir({ kirilim: e.target.value || undefined })}>
              <option value="">Varsayılan</option>
              {meta.kirilimlar.map((k) => (
                <option key={k.kod} value={k.kod}>
                  {k.ad}
                </option>
              ))}
            </select>
          </Alan>
        )}
        <Alan etiket="Başlık">
          <input className={girdiSinif} value={baslik} maxLength={60} placeholder={tanim.kisa} onChange={(e) => setBaslik(e.target.value)} data-testid="kutu-baslik" />
        </Alan>
      </div>
    </Pencere>
  );
}

/* ---------- Katalog çekmecesi ---------- */

function KatalogCekmecesi({ acik, kapat, pano }: { acik: boolean; kapat: () => void; pano: Pano }) {
  const { donem, firmaParam, bildir } = useUygulama();
  const [secili, setSecili] = useState<RaporTanimi | null>(null);
  const [boyut, setBoyut] = useState<Boyut>("m");
  const onizleme = useRapor(acik && secili ? secili.id : null, { donem: secili?.parametreler.donem === false ? undefined : donem.kod, bas: donem.bas, bit: donem.bit }, firmaParam);
  const kapatVeTemizle = useCallback(() => {
    setSecili(null);
    kapat();
  }, [kapat]);
  const ekle = () => {
    if (!secili) return;
    kutuEkle(pano.id, { id: yeniId(), rapor: secili.id, boyut });
    bildir(`"${secili.kisa}" eklendi`);
    setSecili(null);
  };
  return (
    <Cekmece acik={acik} kapat={kapatVeTemizle} baslik="Kutu ekle" ikon="Plus" genis>
      <div className="flex flex-col gap-4" data-testid="katalog-cekmece">
        {secili && (
          <Kart className="flex flex-col gap-3 p-3" data-testid="onizleme">
            <div className="flex items-center gap-2">
              <Ikon ad={secili.ikon} boyut={20} className="text-marka" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{secili.kisa}</div>
                <div className="truncate text-xs text-soluk">{secili.ad}</div>
              </div>
            </div>
            <div className="max-h-72 overflow-hidden">
              {onizleme.hata ? <HataKutusu mesaj={onizleme.hata.message} /> : !onizleme.veri ? <KutuIskelet /> : <SonucGorunum sonuc={onizleme.veri.sonuc} birim={onizleme.veri.rapor.birim} iyi={onizleme.veri.rapor.iyi} kompakt />}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-40">
                <BoyutSecici deger={boyut} degistir={setBoyut} />
              </div>
              <Dugme tur="birincil" className="ml-auto" onClick={ekle} data-testid="katalog-ekle">
                <Plus size={18} aria-hidden /> Ekle
              </Dugme>
            </div>
          </Kart>
        )}
        <KatalogGezgini onSec={(r) => { setSecili(r); setBoyut(r.tur === "kpi" ? "s" : r.tur === "seri" || r.tur === "matris" ? "l" : "m"); }} seciliId={secili?.id} sikisik />
      </div>
    </Cekmece>
  );
}

/* ---------- Pano oluştur / ayarla ---------- */

function IkonSecici({ deger, degistir }: { deger: string; degistir: (s: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1" role="radiogroup" aria-label="Pano simgesi">
      {PANO_IKONLARI.map((i) => (
        <button key={i} type="button" role="radio" aria-checked={deger === i} aria-label={i} title={i} onClick={() => degistir(i)} className={cx("flex h-10 items-center justify-center rounded-lg", deger === i ? "bg-marka text-white dark:text-[#0b1020]" : "hover:bg-kart2")}>
          <Ikon ad={i} boyut={20} />
        </button>
      ))}
    </div>
  );
}

function YeniPanoPenceresi({ acik, kapat, olustu }: { acik: boolean; kapat: () => void; olustu: (id: number) => void }) {
  const [ad, setAd] = useState("");
  const [ikon, setIkon] = useState("LayoutGrid");
  const [hata, setHata] = useState<string | null>(null);
  const kaydet = async () => {
    if (!ad.trim()) return setHata("Ad gerekli");
    try {
      const id = await panoOlustur(ad.trim(), ikon);
      setAd("");
      setHata(null);
      kapat();
      olustu(id);
    } catch (e) {
      setHata((e as Error).message);
    }
  };
  return (
    <Pencere acik={acik} kapat={kapat} baslik="Yeni pano" alt={<><Dugme onClick={kapat}>Vazgeç</Dugme><Dugme tur="birincil" onClick={kaydet} data-testid="yeni-pano-kaydet"><Check size={16} aria-hidden /> Oluştur</Dugme></>}>
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void kaydet(); }}>
        <Alan etiket="Ad">
          <input className={girdiSinif} value={ad} maxLength={40} onChange={(e) => setAd(e.target.value)} data-testid="yeni-pano-ad" />
        </Alan>
        <Alan etiket="Simge">
          <IkonSecici deger={ikon} degistir={setIkon} />
        </Alan>
        {hata && <p className="text-sm text-kotu" role="alert">{hata}</p>}
      </form>
    </Pencere>
  );
}

function PanoAyarPenceresi({ acik, kapat, pano, silindi, tekPano }: { acik: boolean; kapat: () => void; pano: Pano; silindi: () => void; tekPano: boolean }) {
  const [ad, setAd] = useState(pano.ad);
  const [ikon, setIkon] = useState(pano.ikon);
  const [silOnay, setSilOnay] = useState(false);
  useEffect(() => {
    if (acik) {
      setAd(pano.ad);
      setIkon(pano.ikon);
      setSilOnay(false);
    }
  }, [acik, pano.ad, pano.ikon]);
  const kaydet = () => {
    panoGuncelle(pano.id, { ad: ad.trim() || pano.ad, ikon }, 0);
    kapat();
  };
  return (
    <Pencere
      acik={acik}
      kapat={kapat}
      baslik="Pano"
      alt={
        <>
          {!tekPano &&
            (silOnay ? (
              <Dugme tur="tehlike" onClick={async () => { await panoSil(pano.id); kapat(); silindi(); }}>
                <Trash2 size={16} aria-hidden /> Evet, sil
              </Dugme>
            ) : (
              <Dugme tur="hayalet" onClick={() => setSilOnay(true)} className="text-kotu">
                <Trash2 size={16} aria-hidden /> Panoyu sil
              </Dugme>
            ))}
          <Dugme tur="birincil" onClick={kaydet}>
            <Check size={16} aria-hidden /> Kaydet
          </Dugme>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alan etiket="Ad">
          <input className={girdiSinif} value={ad} maxLength={40} onChange={(e) => setAd(e.target.value)} />
        </Alan>
        <Alan etiket="Simge">
          <IkonSecici deger={ikon} degistir={setIkon} />
        </Alan>
      </div>
    </Pencere>
  );
}
