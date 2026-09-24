// Uygulama çerçevesi: üst çubuk + sol ikon rayı (masaüstü) + alt sekme çubuğu (telefon)
import { useState, type ReactNode } from "react";
import {
  Gauge, LayoutDashboard, ChartColumnBig, Bell, Settings, Building2, RefreshCw, Check, ChevronDown, Moon, Sun, Monitor, KeyRound, LogOut, UserRound, CalendarRange,
} from "lucide-react";
import { useUygulama } from "../state/uygulama";
import { Baglanti, useYon } from "../lib/yonlendirici";
import { api } from "../lib/api";
import { goreliZaman, tarih } from "../lib/bicim";
import type { KopruDurumKodu, Tema, UyariOzet } from "../lib/types";
import { Acilir } from "./Acilir";
import { Alan, Dugme, Ikon, IkonDugme, Pencere, cx, girdiSinif } from "./ui";

type NavOge = { yol: string; ad: string; ikon: typeof Gauge; eslesme: (y: string) => boolean };

function navOgeleri(rol: string | undefined): NavOge[] {
  const l: NavOge[] = [
    { yol: "/", ad: "Durum", ikon: Gauge, eslesme: (y) => y === "/" },
    { yol: "/pano", ad: "Panolar", ikon: LayoutDashboard, eslesme: (y) => y.startsWith("/pano") },
    { yol: "/raporlar", ad: "Raporlar", ikon: ChartColumnBig, eslesme: (y) => y.startsWith("/rapor") },
    { yol: "/uyarilar", ad: "Uyarılar", ikon: Bell, eslesme: (y) => y.startsWith("/uyarilar") },
    { yol: "/ayarlar", ad: "Ayarlar", ikon: Settings, eslesme: (y) => y.startsWith("/ayarlar") },
  ];
  if (rol === "super") l.push({ yol: "/yonetim", ad: "Yönetim", ikon: Building2, eslesme: (y) => y.startsWith("/yonetim") });
  return l;
}

// Uyarılar menü öğesindeki rozet: kritik varsa kırmızı, yoksa uyarı sayısı amber
function uyariRozeti(o?: UyariOzet) {
  if (!o) return null;
  if (o.kritik > 0) return { n: o.kritik, sinif: "bg-kotu", ad: `${o.kritik} kritik uyarı` };
  if (o.uyari > 0) return { n: o.uyari, sinif: "bg-orta", ad: `${o.uyari} uyarı` };
  return null;
}

function Rozet({ r, className }: { r: { n: number; sinif: string }; className?: string }) {
  return (
    <span aria-hidden data-testid="uyari-rozeti" className={cx("absolute flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] leading-none font-bold text-white rakam dark:text-[#0b1020]", r.sinif, className)}>
      {r.n > 99 ? "99+" : r.n}
    </span>
  );
}

export function Kabuk({ children }: { children: ReactNode }) {
  const { yol } = useYon();
  const { kullanici, meta, surum } = useUygulama();
  const ogeler = navOgeleri(kullanici?.rol);
  const rozet = uyariRozeti(surum?.uyariOzet);
  const etiket = (o: NavOge) => (o.yol === "/uyarilar" && rozet ? `${o.ad} — ${rozet.ad}` : o.ad);
  return (
    <div className="min-h-dvh">
      {/* Sol ray */}
      <nav aria-label="Ana menü" className="fixed inset-y-0 left-0 z-30 hidden w-18 flex-col items-center gap-1 border-r border-cizgi bg-kart py-3 md:flex">
        <Baglanti to="/" className="mb-3 flex h-11 w-11 items-center justify-center" aria-label="Vega Bulut ana sayfa" title="Vega Bulut">
          <img src="/logo.svg" alt="" width={36} height={36} />
        </Baglanti>
        {ogeler.map((o) => {
          const aktif = o.eslesme(yol);
          return (
            <Baglanti
              key={o.yol}
              to={o.yol}
              aria-label={etiket(o)}
              aria-current={aktif ? "page" : undefined}
              className={cx("group relative flex h-12 w-12 items-center justify-center rounded-2xl transition", aktif ? "bg-marka text-white dark:text-[#0b1020]" : "text-soluk hover:bg-kart2 hover:text-yazi")}
            >
              <o.ikon size={24} aria-hidden />
              {o.yol === "/uyarilar" && rozet && <Rozet r={rozet} className="top-0.5 right-0.5" />}
              <span className="pointer-events-none absolute left-14 z-40 hidden rounded-lg bg-yazi px-2 py-1 text-xs font-semibold whitespace-nowrap text-zemin shadow group-hover:block group-focus-visible:block">
                {o.ad}
              </span>
            </Baglanti>
          );
        })}
      </nav>

      <div className="md:pl-18">
        <UstCubuk kiraciAd={meta?.firma.ad || kullanici?.gorunenFirma?.ad || "Vega Bulut"} />
        <main className="mx-auto w-full max-w-7xl px-3 pt-3 pb-24 sm:px-5 md:pb-10">{children}</main>
      </div>

      {/* Alt sekme çubuğu */}
      <nav aria-label="Alt menü" className="guvenli-alt fixed inset-x-0 bottom-0 z-30 border-t border-cizgi bg-kart/95 backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {ogeler.slice(0, 5).map((o) => {
            const aktif = o.eslesme(yol);
            return (
              <li key={o.yol}>
                <Baglanti to={o.yol} aria-label={etiket(o)} aria-current={aktif ? "page" : undefined} className={cx("flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium", aktif ? "text-marka" : "text-soluk")}>
                  <span className={cx("relative flex h-8 w-12 items-center justify-center rounded-full transition", aktif && "bg-marka-yumusak")}>
                    <o.ikon size={22} aria-hidden />
                    {o.yol === "/uyarilar" && rozet && <Rozet r={rozet} className="-top-1 right-0.5" />}
                  </span>
                  {o.ad}
                </Baglanti>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function UstCubuk({ kiraciAd }: { kiraciAd: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-cizgi bg-kart/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-1 px-2 sm:gap-2 sm:px-5">
        <img src="/logo.svg" alt="" width={28} height={28} className="md:hidden" />
        <h1 className="min-w-0 flex-1 truncate text-base font-bold sm:text-lg" title={kiraciAd} data-testid="kiraci-ad">
          {kiraciAd}
        </h1>
        <DonemSecici />
        <FirmaSecici />
        <EsitlemeDurumu />
        <KullaniciMenusu />
      </div>
    </header>
  );
}

/* ---------- Dönem ---------- */

export function DonemSecici() {
  const { meta, donem, setDonem } = useUygulama();
  const [bas, setBas] = useState(donem.bas || "");
  const [bit, setBit] = useState(donem.bit || "");
  if (!meta) return null;
  const secili = meta.donemler.find((d) => d.kod === donem.kod);
  const ad = donem.kod === "ozel" && donem.bas ? `${tarih(donem.bas)} – ${tarih(donem.bit)}` : secili?.ad || "Dönem";
  return (
    <Acilir
      etiket="Dönem seçimi"
      genislik="sm:w-80"
      tetik={(acik) => (
        <button type="button" className={cx("inline-flex h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold hover:bg-kart2", acik && "bg-kart2")} aria-label={`Dönem: ${ad}`} title={`Dönem: ${ad}`} data-testid="donem-secici">
          <Ikon ad={secili?.ikon || "Calendar"} boyut={20} className="text-marka" />
          <span className="hidden max-w-36 truncate lg:inline">{ad}</span>
          <ChevronDown size={14} className="hidden text-soluk lg:inline" aria-hidden />
        </button>
      )}
    >
      {(kapat) => (
        <div className="flex flex-col gap-2 p-1">
          <div className="grid grid-cols-2 gap-1.5">
            {meta.donemler
              .filter((d) => d.kod !== "ozel")
              .map((d) => (
                <button
                  key={d.kod}
                  type="button"
                  onClick={() => {
                    setDonem({ kod: d.kod });
                    kapat();
                  }}
                  className={cx("flex min-h-10 items-center gap-2 rounded-xl px-2.5 text-left text-sm", donem.kod === d.kod ? "bg-marka text-white dark:text-[#0b1020]" : "hover:bg-kart2")}
                  aria-pressed={donem.kod === d.kod}
                >
                  <Ikon ad={d.ikon} boyut={16} />
                  {d.ad}
                </button>
              ))}
          </div>
          <div className="mt-1 rounded-xl border border-cizgi p-2">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <CalendarRange size={16} aria-hidden /> Tarih aralığı
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="date" aria-label="Başlangıç" className={girdiSinif} value={bas} max={bit || undefined} onChange={(e) => setBas(e.target.value)} />
              <input type="date" aria-label="Bitiş" className={girdiSinif} value={bit} min={bas || undefined} onChange={(e) => setBit(e.target.value)} />
            </div>
            <Dugme
              tur="birincil"
              className="mt-2 w-full"
              disabled={!bas || !bit || bas > bit}
              onClick={() => {
                setDonem({ kod: "ozel", bas, bit });
                kapat();
              }}
            >
              <Check size={16} aria-hidden /> Uygula
            </Dugme>
          </div>
        </div>
      )}
    </Acilir>
  );
}

/* ---------- Firma ---------- */

function FirmaSecici() {
  const { meta, firmalar, setFirmalar } = useUygulama();
  if (!meta || meta.firmalar.length < 2) return null;
  const hepsi = firmalar.includes("hepsi");
  const varsayilan = !hepsi && firmalar.length === 0;
  const etkinler = meta.firmalar.filter((f) => f.aktif).map((f) => f.kod);
  const seciliKodlar = hepsi ? meta.firmalar.map((f) => f.kod) : varsayilan ? etkinler : firmalar;
  const ozet = hepsi ? "Tümü" : varsayilan ? "Etkin firmalar" : `${firmalar.length} firma`;
  const degistir = (kod: string) => {
    const set = new Set(seciliKodlar);
    if (set.has(kod)) set.delete(kod);
    else set.add(kod);
    const liste = meta.firmalar.map((f) => f.kod).filter((k) => set.has(k));
    if (!liste.length) return;
    const ayniEtkin = liste.length === etkinler.length && liste.every((k) => etkinler.includes(k));
    setFirmalar(ayniEtkin ? [] : liste);
  };
  return (
    <Acilir
      etiket="Firma seçimi"
      tetik={(acik) => (
        <button type="button" className={cx("inline-flex h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold hover:bg-kart2", acik && "bg-kart2")} aria-label={`Firmalar: ${ozet}`} title={`Firmalar: ${ozet}`} data-testid="firma-secici">
          <Building2 size={20} className="text-marka" aria-hidden />
          <span className="hidden max-w-32 truncate lg:inline">{ozet}</span>
          <ChevronDown size={14} className="hidden text-soluk lg:inline" aria-hidden />
        </button>
      )}
    >
      {() => (
        <div className="flex flex-col gap-1 p-1">
          {meta.firmalar.map((f) => {
            const secili = seciliKodlar.includes(f.kod);
            return (
              <button key={f.kod} type="button" role="checkbox" aria-checked={secili} onClick={() => degistir(f.kod)} className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-left hover:bg-kart2">
                <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", secili ? "border-marka bg-marka text-white dark:text-[#0b1020]" : "border-cizgi")}>{secili && <Check size={16} aria-hidden />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{f.ad}</span>
                  <span className="block truncate text-xs text-soluk">
                    {f.kod}
                    {!f.aktif && " · kapalı"}
                  </span>
                </span>
              </button>
            );
          })}
          <div className="mt-1 grid grid-cols-2 gap-1.5 border-t border-cizgi pt-2">
            <button type="button" onClick={() => setFirmalar([])} aria-pressed={varsayilan} className={cx("min-h-10 rounded-xl px-2 text-sm font-medium", varsayilan ? "bg-marka-yumusak text-marka" : "hover:bg-kart2")}>
              Etkin firmalar
            </button>
            <button type="button" onClick={() => setFirmalar(["hepsi"])} aria-pressed={hepsi} className={cx("min-h-10 rounded-xl px-2 text-sm font-medium", hepsi ? "bg-marka-yumusak text-marka" : "hover:bg-kart2")}>
              Tümü (kapananlar dahil)
            </button>
          </div>
        </div>
      )}
    </Acilir>
  );
}

/* ---------- Eşitleme ---------- */

const kopruRenk: Record<KopruDurumKodu, { sinif: string; ad: string }> = {
  guncel: { sinif: "bg-iyi", ad: "Güncel" },
  gecikmeli: { sinif: "bg-orta", ad: "Gecikmeli" },
  kopuk: { sinif: "bg-kotu", ad: "Bağlantı yok" },
  bekleniyor: { sinif: "bg-notr", ad: "Bekleniyor" },
  yok: { sinif: "bg-notr", ad: "Köprü kurulmadı" },
  demo: { sinif: "bg-mor", ad: "Demo verisi" },
};

function EsitlemeDurumu() {
  const { meta, surum, surumYokla, bildir } = useUygulama();
  const [istek, setIstek] = useState(false);
  const kopru = surum?.kopru || meta?.kopru;
  if (!kopru) return null;
  const r = kopruRenk[kopru.durum] || kopruRenk.yok;
  const donuyor = istek || !!surum?.esitleniyor || !!surum?.bekleyenIstek;
  const zaman = goreliZaman(kopru.sonEsitleme);
  const guncelle = async () => {
    setIstek(true);
    try {
      const y = await api<{ mesaj: string }>("/guncelle", { method: "POST", govde: {} });
      bildir(y.mesaj || "Güncelleme istendi");
      await surumYokla();
    } catch (e) {
      bildir((e as Error).message);
    } finally {
      setIstek(false);
    }
  };
  return (
    <div className="flex items-center" data-testid="esitleme">
      <span className="hidden items-center gap-1.5 px-1 text-xs text-soluk sm:inline-flex" title={`${r.ad} · son eşitleme ${zaman}`}>
        <span className={cx("h-2.5 w-2.5 rounded-full", r.sinif)} aria-hidden />
        <span className="whitespace-nowrap">{zaman}</span>
      </span>
      <IkonDugme etiket={`Şimdi güncelle (${r.ad}, ${zaman})`} onClick={guncelle} disabled={istek} className="relative">
        <RefreshCw size={20} className={cx(donuyor && "animate-spin")} aria-hidden />
        <span className={cx("absolute right-1.5 bottom-1.5 h-2 w-2 rounded-full ring-2 ring-kart sm:hidden", r.sinif)} aria-hidden />
      </IkonDugme>
    </div>
  );
}

/* ---------- Kullanıcı menüsü ---------- */

function KullaniciMenusu() {
  const { kullanici, tema, setTema, cikis } = useUygulama();
  const [sifreAcik, setSifreAcik] = useState(false);
  const { git } = useYon();
  if (!kullanici) return null;
  const temalar: { kod: Tema; ad: string; ikon: typeof Sun }[] = [
    { kod: "acik", ad: "Açık", ikon: Sun },
    { kod: "koyu", ad: "Koyu", ikon: Moon },
    { kod: "sistem", ad: "Sistem", ikon: Monitor },
  ];
  return (
    <>
      <Acilir
        etiket="Kullanıcı menüsü"
        tetik={() => (
          <IkonDugme etiket={`Kullanıcı: ${kullanici.ad}`} data-testid="kullanici-menu">
            <UserRound size={22} aria-hidden />
          </IkonDugme>
        )}
      >
        {(kapat) => (
          <div className="flex flex-col gap-1 p-1">
            <div className="px-2 py-1.5">
              <div className="font-semibold">{kullanici.ad}</div>
              <div className="text-xs text-soluk">
                {kullanici.kullanici} · {kullanici.rol === "super" ? "Sistem yöneticisi" : kullanici.rol === "admin" ? "Yönetici" : "İzleyici"}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-kart2 p-1" role="radiogroup" aria-label="Tema">
              {temalar.map((t) => (
                <button key={t.kod} type="button" role="radio" aria-checked={tema === t.kod} onClick={() => setTema(t.kod)} className={cx("flex min-h-10 flex-col items-center justify-center rounded-lg text-xs", tema === t.kod ? "bg-kart font-semibold shadow" : "text-soluk")} data-testid={`tema-${t.kod}`}>
                  <t.ikon size={18} aria-hidden />
                  {t.ad}
                </button>
              ))}
            </div>
            <button type="button" className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm hover:bg-kart2" onClick={() => { kapat(); setSifreAcik(true); }}>
              <KeyRound size={18} aria-hidden /> Şifre değiştir
            </button>
            {kullanici.rol === "super" && (
              <button type="button" className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm hover:bg-kart2" onClick={() => { kapat(); git("/yonetim"); }}>
                <Building2 size={18} aria-hidden /> Yönetim
              </button>
            )}
            <button type="button" className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm text-kotu hover:bg-kotu-zemin" onClick={() => { kapat(); void cikis(); }} data-testid="cikis">
              <LogOut size={18} aria-hidden /> Çıkış
            </button>
          </div>
        )}
      </Acilir>
      <SifrePenceresi acik={sifreAcik} kapat={() => setSifreAcik(false)} />
    </>
  );
}

export function SifrePenceresi({ acik, kapat }: { acik: boolean; kapat: () => void }) {
  const { bildir } = useUygulama();
  const [eski, setEski] = useState("");
  const [yeni, setYeni] = useState("");
  const [yeni2, setYeni2] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekle, setBekle] = useState(false);
  const kaydet = async () => {
    setHata(null);
    if (yeni.length < 6) return setHata("Yeni şifre en az 6 karakter olmalı.");
    if (yeni !== yeni2) return setHata("Yeni şifreler aynı değil.");
    setBekle(true);
    try {
      await api("/auth/sifre", { method: "POST", govde: { eski, yeni }, sessiz: true });
      bildir("Şifreniz değiştirildi");
      setEski("");
      setYeni("");
      setYeni2("");
      kapat();
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBekle(false);
    }
  };
  return (
    <Pencere
      acik={acik}
      kapat={kapat}
      baslik="Şifre değiştir"
      alt={
        <>
          <Dugme onClick={kapat}>Vazgeç</Dugme>
          <Dugme tur="birincil" onClick={kaydet} disabled={bekle || !eski || !yeni}>
            <Check size={16} aria-hidden /> Kaydet
          </Dugme>
        </>
      }
    >
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void kaydet(); }}>
        <Alan etiket="Mevcut şifre">
          <input type="password" autoComplete="current-password" className={girdiSinif} value={eski} onChange={(e) => setEski(e.target.value)} />
        </Alan>
        <Alan etiket="Yeni şifre">
          <input type="password" autoComplete="new-password" className={girdiSinif} value={yeni} onChange={(e) => setYeni(e.target.value)} />
        </Alan>
        <Alan etiket="Yeni şifre (tekrar)">
          <input type="password" autoComplete="new-password" className={girdiSinif} value={yeni2} onChange={(e) => setYeni2(e.target.value)} />
        </Alan>
        {hata && <p className="text-sm text-kotu" role="alert">{hata}</p>}
        <button type="submit" hidden />
      </form>
    </Pencere>
  );
}
