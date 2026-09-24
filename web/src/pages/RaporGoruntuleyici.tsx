// Tek rapor: denetimler (dönem, kırılım, ilk N, grafik) URL'de; büyük grafik + tablo + CSV + panoya ekle
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, LayoutDashboard, Plus, Check, CalendarRange, Table } from "lucide-react";
import { useKatalog, useRapor } from "../state/rapor";
import { useUygulama } from "../state/uygulama";
import { useSorguParam, useYon } from "../lib/yonlendirici";
import { GRAFIK } from "../lib/grafikler";
import { csvIndir } from "../lib/csv";
import { tarih } from "../lib/bicim";
import type { Boyut, GrafikTuru, RaporParam, RaporParametreleri, RaporTanimi, Sonuc } from "../lib/types";
import { Alan, Dugme, HataKutusu, HataSiniri, Ikon, IkonDugme, Kart, KutuIskelet, Pencere, Yardim, cx, girdiSinif } from "../components/ui";
import { SonucGorunum } from "../components/sonuc/SonucGorunum";
import { TabloGorunum, hucreMetni } from "../components/sonuc/TabloGorunum";
import { tabloyaDonustur, type TabloVeri } from "../components/sonuc/tablo";
import { kutuEkle, panolariYukle, usePanolar, yeniId } from "../state/panolar";

const N_SECENEK = [5, 10, 20, 50]; // katalog nSecenekler vermezse

function csvTablosu(s: Sonuc, birim?: string): TabloVeri | null {
  if (s.tur === "coklu") {
    const t = s.parcalar.find((p) => p.tur === "tablo") || s.parcalar[0];
    return t ? tabloyaDonustur(t, birim) : null;
  }
  return tabloyaDonustur(s, birim);
}

export function RaporGoruntuleyici({ id }: { id: string }) {
  const { meta, firmaParam, bildir } = useUygulama();
  const { git } = useYon();
  const q = useSorguParam();
  const { veri: katalog } = useKatalog();
  const tanim = useMemo<RaporTanimi | undefined>(() => katalog?.raporlar.find((r) => r.id === id), [katalog, id]);
  const pr: RaporParametreleri = tanim?.parametreler || { donem: true };

  const donem = q.get("donem") || tanim?.donem || undefined;
  const param: RaporParam = {
    donem: pr.donem === false ? undefined : donem,
    bas: q.get("bas") || undefined,
    bit: q.get("bit") || undefined,
    kirilim: pr.kirilim ? q.get("kirilim") || undefined : undefined,
    n: pr.n ? Number(q.get("n")) || undefined : undefined,
  };
  const { veri, hata, yukleniyor, yenile } = useRapor(katalog ? id : null, param, firmaParam);
  const grafikler = veri?.rapor.grafikler || tanim?.grafikler || [];
  const grafikQ = q.get("grafik") as GrafikTuru | null;
  const grafik: GrafikTuru | undefined = grafikQ && grafikler.includes(grafikQ) ? grafikQ : veri?.rapor.grafik || tanim?.grafik;

  const [ekleAcik, setEkleAcik] = useState(false);
  const [ozelBas, setOzelBas] = useState(param.bas || "");
  const [ozelBit, setOzelBit] = useState(param.bit || "");

  const paramAyarla = (degisim: Record<string, string | number | null>) => {
    const s = new URLSearchParams(q);
    for (const [k, v] of Object.entries(degisim)) {
      if (v === null || v === "") s.delete(k);
      else s.set(k, String(v));
    }
    const m = s.toString();
    git(`/rapor/${encodeURIComponent(id)}${m ? `?${m}` : ""}`, { degistir: true });
  };

  const ikon = veri?.rapor.ikon || tanim?.ikon || "FileText";
  const ad = veri?.rapor.ad || tanim?.ad || id;
  const aciklama = veri?.rapor.aciklama || tanim?.aciklama;
  const bulunamadi = katalog && !tanim;

  const csv = () => {
    if (!veri) return;
    const t = csvTablosu(veri.sonuc, veri.rapor.birim);
    if (!t) return bildir("Bu rapor için tablo yok");
    csvIndir(
      `${veri.rapor.kisa || veri.rapor.ad} ${veri.donem?.bas || ""}_${veri.donem?.bit || ""}`,
      t.kolonlar.map((k) => ({ ad: k.ad || " ", deger: (s) => (typeof s[k.id] === "number" ? (k.tip === "yuzde" ? (s[k.id] as number) * 100 : s[k.id]) : k.tip === "tarih" || k.tip === "etiket" ? hucreMetni(s[k.id], k.tip) : s[k.id]) })),
      t.satirlar,
    );
  };

  const tabloAlti = veri && grafik !== "tablo" && !["tablo", "coklu", "saglik", "buyume"].includes(veri.sonuc.tur) ? tabloyaDonustur(veri.sonuc, veri.rapor.birim) : null;

  return (
    <div className="flex flex-col gap-3" data-testid="rapor-goruntuleyici">
      <div className="flex items-start gap-2">
        <IkonDugme etiket="Geri" onClick={() => (window.history.length > 1 ? window.history.back() : git("/raporlar"))}>
          <ArrowLeft size={22} aria-hidden />
        </IkonDugme>
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-marka-yumusak text-marka">
          <Ikon ad={ikon} boyut={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg leading-tight font-extrabold sm:text-xl" data-testid="rapor-baslik">
            {ad}
          </h1>
          {veri?.donem && pr.donem !== false && (
            <p className="text-xs text-soluk">
              {veri.donem.ad} · {tarih(veri.donem.bas)} – {tarih(veri.donem.bit)}
            </p>
          )}
        </div>
        {aciklama && <Yardim metin={aciklama} etiket="Rapor açıklaması" />}
      </div>

      {/* Denetimler */}
      {!bulunamadi && (
        <Kart className="flex flex-col gap-2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            {pr.donem !== false && meta && (
              <label className="flex items-center gap-1.5" title="Dönem">
                <Ikon ad={meta.donemler.find((d) => d.kod === donem)?.ikon || "Calendar"} boyut={18} className="text-marka" />
                <span className="sr-only">Dönem</span>
                <select className={cx(girdiSinif, "min-h-10 w-auto py-1 pr-8 text-sm")} value={donem || ""} onChange={(e) => paramAyarla({ donem: e.target.value, ...(e.target.value !== "ozel" ? { bas: null, bit: null } : {}) })} data-testid="rapor-donem">
                  {meta.donemler.map((d) => (
                    <option key={d.kod} value={d.kod}>
                      {d.ad}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {pr.kirilim && meta && (
              <div className="flex rounded-xl bg-kart2 p-0.5" role="group" aria-label="Kırılım">
                {meta.kirilimlar.map((k) => {
                  const aktif = (param.kirilim || (veri?.sonuc as { kirilim?: string } | undefined)?.kirilim) === k.kod;
                  return (
                    <button key={k.kod} type="button" aria-pressed={aktif} onClick={() => paramAyarla({ kirilim: k.kod })} className={cx("min-h-9 rounded-lg px-2.5 text-sm", aktif ? "bg-kart font-semibold shadow" : "text-soluk")}>
                      {k.ad}
                    </button>
                  );
                })}
              </div>
            )}
            {pr.n && (
              <div className="flex items-center gap-1 rounded-xl bg-kart2 p-0.5" role="group" aria-label="İlk N">
                <Ikon ad="ListOrdered" boyut={16} className="ml-1.5 text-soluk" />
                {(pr.nSecenekler || N_SECENEK).map((n) => {
                  const aktif = (param.n ?? veri?.n ?? pr.nVarsayilan) === n;
                  return (
                    <button key={n} type="button" aria-pressed={aktif} onClick={() => paramAyarla({ n })} className={cx("min-h-9 min-w-9 rounded-lg px-2 text-sm rakam", aktif ? "bg-kart font-semibold shadow" : "text-soluk")} title={`İlk ${n}`}>
                      {n}
                    </button>
                  );
                })}
              </div>
            )}
            {grafikler.length > 1 && (
              <div className="flex items-center gap-0.5 rounded-xl bg-kart2 p-0.5" role="group" aria-label="Grafik türü">
                {grafikler.map((g) => {
                  const G = GRAFIK[g];
                  const aktif = grafik === g;
                  return (
                    <button key={g} type="button" aria-pressed={aktif} aria-label={G?.ad || g} title={G?.ad || g} onClick={() => paramAyarla({ grafik: g })} className={cx("flex h-9 w-9 items-center justify-center rounded-lg", aktif ? "bg-kart text-marka shadow" : "text-soluk hover:text-yazi")} data-grafik-sec={g}>
                      {G ? <G.ikon size={18} aria-hidden /> : g}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="ml-auto flex items-center gap-1">
              <IkonDugme etiket="CSV indir" onClick={csv} disabled={!veri} data-testid="csv-indir">
                <Download size={20} aria-hidden />
              </IkonDugme>
              <Dugme tur="birincil" onClick={() => setEkleAcik(true)} disabled={!tanim} data-testid="panoya-ekle">
                <Plus size={18} aria-hidden />
                <span className="hidden sm:inline">Panoya ekle</span>
                <LayoutDashboard size={18} className="sm:hidden" aria-hidden />
              </Dugme>
            </div>
          </div>
          {donem === "ozel" && pr.donem !== false && (
            <div className="flex flex-wrap items-end gap-2">
              <CalendarRange size={18} className="mb-3 text-soluk" aria-hidden />
              <input type="date" aria-label="Başlangıç" className={cx(girdiSinif, "w-auto")} value={ozelBas} onChange={(e) => setOzelBas(e.target.value)} />
              <input type="date" aria-label="Bitiş" className={cx(girdiSinif, "w-auto")} value={ozelBit} onChange={(e) => setOzelBit(e.target.value)} />
              <Dugme onClick={() => paramAyarla({ bas: ozelBas, bit: ozelBit })} disabled={!ozelBas || !ozelBit || ozelBas > ozelBit}>
                <Check size={16} aria-hidden /> Uygula
              </Dugme>
            </div>
          )}
        </Kart>
      )}

      <Kart className="p-3 sm:p-4" data-testid="rapor-govde">
        {bulunamadi ? (
          <HataKutusu mesaj="Rapor bulunamadı" />
        ) : hata && !veri ? (
          <HataKutusu mesaj={donem === "ozel" && (!param.bas || !param.bit) ? "Tarih aralığı seçin" : hata.message} yenile={yenile} />
        ) : yukleniyor || !veri ? (
          <KutuIskelet yukseklik="h-80" />
        ) : (
          <HataSiniri sifirla={`${id}|${grafik}|${veri.veriSurumu}`}>
            <SonucGorunum sonuc={veri.sonuc} grafik={grafik} birim={veri.rapor.birim} iyi={veri.rapor.iyi} />
          </HataSiniri>
        )}
      </Kart>

      {tabloAlti && tabloAlti.satirlar.length > 0 && (
        <Kart className="p-3 sm:p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-soluk">
            <Table size={16} aria-hidden /> Veri
          </h2>
          <HataSiniri>
            <TabloGorunum veri={tabloAlti} />
          </HataSiniri>
        </Kart>
      )}

      {tanim && <PanoyaEklePenceresi acik={ekleAcik} kapat={() => setEkleAcik(false)} tanim={tanim} grafik={grafik} param={param} />}
    </div>
  );
}

function PanoyaEklePenceresi({ acik, kapat, tanim, grafik, param }: { acik: boolean; kapat: () => void; tanim: RaporTanimi; grafik?: GrafikTuru; param: RaporParam }) {
  const { panolar } = usePanolar();
  const { bildir } = useUygulama();
  const { git } = useYon();
  const [panoId, setPanoId] = useState<number | null>(null);
  const [boyut, setBoyut] = useState<Boyut>(tanim.tur === "kpi" ? "s" : "m");
  const [donemKoru, setDonemKoru] = useState(false);

  useEffect(() => {
    if (acik) void panolariYukle();
  }, [acik]);
  const secili = panoId ?? panolar?.[0]?.id ?? null;

  const ekle = () => {
    if (!secili) return;
    const kutu = {
      id: yeniId(),
      rapor: tanim.id,
      boyut,
      ...(grafik && grafik !== tanim.grafik ? { grafik } : {}),
      ...(donemKoru && param.donem ? { donem: param.donem, ...(param.donem === "ozel" ? { bas: param.bas, bit: param.bit } : {}) } : {}),
      ...(param.kirilim ? { kirilim: param.kirilim } : {}),
      ...(param.n ? { n: param.n } : {}),
    };
    kutuEkle(secili, kutu);
    bildir("Kutu panoya eklendi");
    kapat();
    git(`/pano/${secili}`);
  };

  return (
    <Pencere
      acik={acik}
      kapat={kapat}
      baslik="Panoya ekle"
      alt={
        <>
          <Dugme onClick={kapat}>Vazgeç</Dugme>
          <Dugme tur="birincil" onClick={ekle} disabled={!secili} data-testid="panoya-ekle-onay">
            <Plus size={16} aria-hidden /> Ekle
          </Dugme>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alan etiket="Pano">
          <div className="grid grid-cols-2 gap-2">
            {(panolar || []).map((p) => (
              <button key={p.id} type="button" onClick={() => setPanoId(p.id)} aria-pressed={secili === p.id} className={cx("flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm", secili === p.id ? "border-marka bg-marka-yumusak font-semibold" : "border-cizgi hover:bg-kart2")}>
                <Ikon ad={p.ikon} boyut={18} />
                <span className="truncate">{p.ad}</span>
              </button>
            ))}
          </div>
        </Alan>
        <Alan etiket="Boyut">
          <BoyutSecici deger={boyut} degistir={setBoyut} />
        </Alan>
        {param.donem && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={donemKoru} onChange={(e) => setDonemKoru(e.target.checked)} className="h-5 w-5 accent-[var(--marka)]" />
            Bu dönemi sabitle (yoksa genel dönemi izler)
          </label>
        )}
      </div>
    </Pencere>
  );
}

export function BoyutSecici({ deger, degistir }: { deger: Boyut; degistir: (b: Boyut) => void }) {
  const l: { b: Boyut; ad: string; ipucu: string }[] = [
    { b: "s", ad: "S", ipucu: "Küçük (1 sütun)" },
    { b: "m", ad: "M", ipucu: "Orta (2 sütun)" },
    { b: "l", ad: "L", ipucu: "Geniş (tam satır)" },
  ];
  return (
    <div className="flex rounded-xl bg-kart2 p-0.5" role="group" aria-label="Boyut">
      {l.map((x) => (
        <button key={x.b} type="button" aria-pressed={deger === x.b} title={x.ipucu} aria-label={x.ipucu} onClick={() => degistir(x.b)} className={cx("min-h-9 flex-1 rounded-lg px-3 text-sm font-bold", deger === x.b ? "bg-kart text-marka shadow" : "text-soluk")}>
          {x.ad}
        </button>
      ))}
    </div>
  );
}
