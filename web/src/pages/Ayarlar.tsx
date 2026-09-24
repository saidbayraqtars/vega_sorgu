// Ayarlar: genel (enflasyon, sektör, eşitleme, firmalar, izahat), kullanıcılar, köprü. İzleyici yalnız tema + şifre görür.
import { useCallback, useEffect, useState } from "react";
import {
  SlidersHorizontal, Users, Cable, Save, Plus, Pencil, Trash2, KeyRound, Copy, Check, RefreshCw, ChevronDown, Ban, Sun, Moon, Monitor, Settings, ExternalLink,
} from "lucide-react";
import { api } from "../lib/api";
import { goreliZaman, sayi, tarihSaat } from "../lib/bicim";
import type { KopruDurumu, Tema } from "../lib/types";
import { useUygulama } from "../state/uygulama";
import { raporOnbellekTemizle, useVeri } from "../state/rapor";
import { Baglanti } from "../lib/yonlendirici";
import { Alan, Anahtar, Dugme, HataKutusu, IkonDugme, Kart, KutuIskelet, Pencere, Rozet, cx, girdiSinif } from "../components/ui";
import { SifrePenceresi } from "../components/Kabuk";

type Ayarlar = { enflasyon: number | null; sektor: string; syncDakika: number; firmalar: string[] | null; izahat: Record<string, number[]>; personelTipleri: number[] };
type AyarYanit = { ayarlar: Ayarlar; varsayilan: Ayarlar; sektorler: { kod: string; ad: string }[] };
type KullaniciSatir = { id: number; kullanici: string; ad: string; rol: "admin" | "user"; aktif: boolean; sonGiris: string | null; olusturma: string };
type KopruYanit = {
  durum: KopruDurumu;
  anahtarlar: { id: number; etiket: string; created_at: string; last_seen: string | null; agent: Record<string, unknown> | null; revoked: boolean }[];
  esitlemeler: { sync_id: string; started_at: string; finished_at: string | null; status: string; chunks: number; rows: number; bytes: number; message: string | null }[];
  olaylar: { at: string; level: string; msg: string }[];
  veri: Record<string, number>;
  sunucu: string;
};

const SEKMELER = [
  { id: "genel", ad: "Genel", ikon: SlidersHorizontal },
  { id: "kullanicilar", ad: "Kullanıcılar", ikon: Users },
  { id: "kopru", ad: "Köprü", ikon: Cable },
] as const;

export function AyarlarSayfasi() {
  const { kullanici } = useUygulama();
  const yonetici = kullanici?.rol === "admin" || kullanici?.rol === "super";
  const [sekme, setSekme] = useState<(typeof SEKMELER)[number]["id"]>("genel");
  return (
    <div className="flex flex-col gap-3" data-testid="ayarlar-sayfasi">
      <h1 className="flex items-center gap-2 text-xl font-extrabold">
        <Settings size={24} className="text-marka" aria-hidden /> Ayarlar
      </h1>
      <KisiselAyarlar />
      {yonetici && (
        <>
          <div className="flex gap-1 rounded-2xl bg-kart p-1" role="tablist" aria-label="Ayar bölümleri">
            {SEKMELER.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={sekme === s.id} onClick={() => setSekme(s.id)} className={cx("flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-semibold", sekme === s.id ? "bg-marka text-white dark:text-[#0b1020]" : "text-soluk hover:text-yazi")} data-testid={`ayar-sekme-${s.id}`}>
                <s.ikon size={18} aria-hidden />
                <span>{s.ad}</span>
              </button>
            ))}
          </div>
          {sekme === "genel" && <GenelAyarlar />}
          {sekme === "kullanicilar" && <KullaniciAyarlari />}
          {sekme === "kopru" && <KopruAyarlari />}
        </>
      )}
    </div>
  );
}

function KisiselAyarlar() {
  const { tema, setTema } = useUygulama();
  const [sifreAcik, setSifreAcik] = useState(false);
  const temalar: { kod: Tema; ad: string; ikon: typeof Sun }[] = [
    { kod: "acik", ad: "Açık", ikon: Sun },
    { kod: "koyu", ad: "Koyu", ikon: Moon },
    { kod: "sistem", ad: "Sistem", ikon: Monitor },
  ];
  return (
    <Kart className="flex flex-wrap items-center gap-3 p-3">
      <div className="flex rounded-xl bg-kart2 p-0.5" role="radiogroup" aria-label="Tema">
        {temalar.map((t) => (
          <button key={t.kod} type="button" role="radio" aria-checked={tema === t.kod} onClick={() => setTema(t.kod)} className={cx("flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm", tema === t.kod ? "bg-kart font-semibold shadow" : "text-soluk")}>
            <t.ikon size={16} aria-hidden /> {t.ad}
          </button>
        ))}
      </div>
      <Dugme onClick={() => setSifreAcik(true)}>
        <KeyRound size={16} aria-hidden /> Şifre değiştir
      </Dugme>
      <SifrePenceresi acik={sifreAcik} kapat={() => setSifreAcik(false)} />
    </Kart>
  );
}

/* ---------- Genel ---------- */

const IZAHAT_ADLARI: Record<string, string> = { SATIS: "Satış", SATIS_IADE: "Satış iadesi", ALIS: "Alış", TAHSILAT: "Tahsilat", TEDIYE: "Tediye (ödeme)", DEVIR: "Devir" };

function GenelAyarlar() {
  const { meta, metaYenile, bildir } = useUygulama();
  const { veri, hata, yenile } = useVeri<AyarYanit>("/ayarlar");
  const [f, setF] = useState<{ enflasyon: string; sektor: string; syncDakika: string; firmalar: string[] | null; izahat: Record<string, string> } | null>(null);
  const [kayit, setKayit] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [izahatAcik, setIzahatAcik] = useState(false);

  useEffect(() => {
    if (!veri) return;
    const a = veri.ayarlar;
    setF({
      enflasyon: a.enflasyon === null || a.enflasyon === undefined ? "" : String(a.enflasyon),
      sektor: a.sektor,
      syncDakika: String(a.syncDakika),
      firmalar: a.firmalar,
      izahat: Object.fromEntries(Object.entries(a.izahat || {}).map(([k, v]) => [k, v.join(", ")])),
    });
  }, [veri]);

  if (hata && !veri) return <HataKutusu mesaj={hata.message} yenile={yenile} />;
  if (!veri || !f) return <KutuIskelet />;

  const kaydet = async () => {
    setMesaj(null);
    const dk = Number(f.syncDakika);
    if (!Number.isFinite(dk) || dk < 5 || dk > 240) return setMesaj("Eşitleme aralığı 5-240 dakika olmalı.");
    const enf = f.enflasyon.trim() === "" ? null : Number(f.enflasyon.replace(",", "."));
    if (enf !== null && !Number.isFinite(enf)) return setMesaj("Enflasyon sayı olmalı.");
    const izahat: Record<string, number[]> = {};
    for (const [k, v] of Object.entries(f.izahat)) {
      const l = v.split(/[,;\s]+/).filter(Boolean).map(Number);
      if (l.some((x) => !Number.isInteger(x))) return setMesaj(`${IZAHAT_ADLARI[k] || k}: yalnız tam sayılar girin.`);
      izahat[k] = l;
    }
    setKayit(true);
    try {
      await api("/ayarlar", { method: "PUT", govde: { enflasyon: enf, sektor: f.sektor, syncDakika: dk, firmalar: f.firmalar && f.firmalar.length ? f.firmalar : null, izahat } });
      raporOnbellekTemizle();
      await metaYenile();
      yenile();
      bildir("Ayarlar kaydedildi");
    } catch (e) {
      setMesaj((e as Error).message);
    } finally {
      setKayit(false);
    }
  };

  const firmaDegistir = (kod: string) => {
    const mevcut = f.firmalar ?? (meta?.firmalar.filter((x) => x.aktif).map((x) => x.kod) || []);
    const s = new Set(mevcut);
    if (s.has(kod)) s.delete(kod);
    else s.add(kod);
    setF({ ...f, firmalar: [...s] });
  };

  return (
    <Kart className="flex flex-col gap-5 p-4" data-testid="genel-ayarlar">
      <Alan etiket="Yıllık enflasyon (%)" ipucu="Reel büyüme bununla hesaplanır. Boş bırakılırsa reel büyüme gösterilmez.">
        <input inputMode="decimal" className={cx(girdiSinif, "max-w-40")} value={f.enflasyon} onChange={(e) => setF({ ...f, enflasyon: e.target.value })} placeholder="ör. 32,5" data-testid="enflasyon" />
      </Alan>
      <Alan etiket="Sektör" ipucu="Sağlık skorundaki eşikler sektöre göre ayarlanır.">
        <select className={cx(girdiSinif, "max-w-xs")} value={f.sektor} onChange={(e) => setF({ ...f, sektor: e.target.value })}>
          {veri.sektorler.map((s) => (
            <option key={s.kod} value={s.kod}>
              {s.ad}
            </option>
          ))}
        </select>
      </Alan>
      <Alan etiket="Eşitleme aralığı (dakika)" ipucu="Köprünün veriyi buluta gönderme sıklığı (5-240).">
        <input type="number" min={5} max={240} className={cx(girdiSinif, "max-w-32")} value={f.syncDakika} onChange={(e) => setF({ ...f, syncDakika: e.target.value })} />
      </Alan>
      {meta && meta.firmalar.length > 1 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Gösterilecek firmalar</span>
          <label className="flex items-center gap-2 text-sm">
            <Anahtar acik={f.firmalar === null} degistir={(v) => setF({ ...f, firmalar: v ? null : meta.firmalar.filter((x) => x.aktif).map((x) => x.kod) })} etiket="Otomatik" />
            Otomatik (son 400 günde hareketi olanlar)
          </label>
          {f.firmalar !== null && (
            <div className="flex flex-wrap gap-2">
              {meta.firmalar.map((x) => {
                const s = f.firmalar!.includes(x.kod);
                return (
                  <button key={x.kod} type="button" aria-pressed={s} onClick={() => firmaDegistir(x.kod)} className={cx("inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm", s ? "border-marka bg-marka-yumusak font-semibold" : "border-cizgi")}>
                    {s && <Check size={14} aria-hidden />} {x.ad} <span className="text-soluk">{x.kod}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div className="rounded-xl border border-cizgi">
        <button type="button" onClick={() => setIzahatAcik((a) => !a)} aria-expanded={izahatAcik} className="flex min-h-12 w-full items-center gap-2 px-3 text-left text-sm font-semibold">
          <ChevronDown size={18} className={cx("transition", izahatAcik && "rotate-180")} aria-hidden />
          İzahat eşleme (gelişmiş)
        </button>
        {izahatAcik && (
          <div className="flex flex-col gap-3 border-t border-cizgi p-3">
            <p className="text-sm text-soluk">
              Arctos cari hareket izahat kodlarının hangi işleme karşılık geldiği. Virgülle ayırın.{" "}
              <Baglanti to="/rapor/ozel.izahat_dagilimi" className="inline-flex items-center gap-1 font-semibold text-marka underline">
                İzahat dağılımı <ExternalLink size={12} aria-hidden />
              </Baglanti>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.keys(IZAHAT_ADLARI).map((k) => (
                <Alan key={k} etiket={IZAHAT_ADLARI[k]}>
                  <input className={girdiSinif} value={f.izahat[k] ?? ""} onChange={(e) => setF({ ...f, izahat: { ...f.izahat, [k]: e.target.value } })} placeholder={(veri.varsayilan.izahat[k] || []).join(", ")} />
                </Alan>
              ))}
            </div>
          </div>
        )}
      </div>
      {mesaj && <p className="text-sm text-kotu" role="alert">{mesaj}</p>}
      <div>
        <Dugme tur="birincil" onClick={kaydet} disabled={kayit} data-testid="ayar-kaydet">
          <Save size={18} aria-hidden /> Kaydet
        </Dugme>
      </div>
    </Kart>
  );
}

/* ---------- Kullanıcılar ---------- */

function KullaniciAyarlari() {
  const { kullanici: ben, bildir } = useUygulama();
  const { veri, hata, yenile } = useVeri<{ kullanicilar: KullaniciSatir[] }>("/kullanicilar");
  const [duzen, setDuzen] = useState<KullaniciSatir | "yeni" | null>(null);
  const [sil, setSil] = useState<KullaniciSatir | null>(null);
  if (hata && !veri) return <HataKutusu mesaj={hata.message} yenile={yenile} />;
  if (!veri) return <KutuIskelet />;
  return (
    <Kart className="flex flex-col gap-3 p-3 sm:p-4" data-testid="kullanici-ayarlari">
      <div>
        <Dugme tur="birincil" onClick={() => setDuzen("yeni")}>
          <Plus size={18} aria-hidden /> Kullanıcı ekle
        </Dugme>
      </div>
      <ul className="flex flex-col divide-y divide-cizgi">
        {veri.kullanicilar.map((u) => (
          <li key={u.id} className="flex items-center gap-3 py-2">
            <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", u.aktif ? "bg-marka-yumusak text-marka" : "bg-notr-zemin text-notr")}>
              <Users size={18} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold">{u.ad || u.kullanici}</span>
                <Rozet renk={u.rol === "admin" ? "mor" : "notr"}>{u.rol === "admin" ? "Yönetici" : "İzleyici"}</Rozet>
                {!u.aktif && <Rozet renk="kritik">Pasif</Rozet>}
              </div>
              <div className="truncate text-xs text-soluk">
                {u.kullanici} · son giriş {goreliZaman(u.sonGiris)}
              </div>
            </div>
            <IkonDugme etiket="Düzenle" onClick={() => setDuzen(u)}>
              <Pencil size={18} aria-hidden />
            </IkonDugme>
            {u.id !== ben?.id && (
              <IkonDugme etiket="Sil" onClick={() => setSil(u)} className="hover:text-kotu">
                <Trash2 size={18} aria-hidden />
              </IkonDugme>
            )}
          </li>
        ))}
      </ul>
      {duzen && <KullaniciPenceresi k={duzen === "yeni" ? null : duzen} kendisi={duzen !== "yeni" && duzen.id === ben?.id} kapat={() => setDuzen(null)} bitti={() => { setDuzen(null); yenile(); }} />}
      <Pencere
        acik={!!sil}
        kapat={() => setSil(null)}
        baslik="Kullanıcıyı sil"
        alt={
          <>
            <Dugme onClick={() => setSil(null)}>Vazgeç</Dugme>
            <Dugme tur="tehlike" onClick={async () => {
              try {
                await api(`/kullanicilar/${sil!.id}`, { method: "DELETE" });
                bildir("Kullanıcı silindi");
                yenile();
              } catch (e) {
                bildir((e as Error).message);
              }
              setSil(null);
            }}>
              <Trash2 size={16} aria-hidden /> Sil
            </Dugme>
          </>
        }
      >
        <p>
          <b>{sil?.ad || sil?.kullanici}</b> silinecek. Emin misiniz?
        </p>
      </Pencere>
    </Kart>
  );
}

function KullaniciPenceresi({ k, kendisi, kapat, bitti }: { k: KullaniciSatir | null; kendisi: boolean; kapat: () => void; bitti: () => void }) {
  const { bildir } = useUygulama();
  const [kullanici, setKullanici] = useState(k?.kullanici || "");
  const [ad, setAd] = useState(k?.ad || "");
  const [rol, setRol] = useState<"admin" | "user">(k?.rol || "user");
  const [aktif, setAktif] = useState(k?.aktif ?? true);
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const kaydet = async () => {
    setHata(null);
    try {
      if (!k) {
        if (!kullanici || sifre.length < 6) return setHata("Kullanıcı adı ve en az 6 karakter şifre gerekli.");
        await api("/kullanicilar", { method: "POST", govde: { kullanici, sifre, ad, rol } });
        bildir("Kullanıcı eklendi");
      } else {
        if (sifre && sifre.length < 6) return setHata("Şifre en az 6 karakter olmalı.");
        await api(`/kullanicilar/${k.id}`, { method: "PUT", govde: { ad, ...(kendisi ? {} : { rol, aktif }), ...(sifre ? { sifre } : {}) } });
        bildir("Kullanıcı güncellendi");
      }
      bitti();
    } catch (e) {
      setHata((e as Error).message);
    }
  };
  return (
    <Pencere acik kapat={kapat} baslik={k ? "Kullanıcıyı düzenle" : "Yeni kullanıcı"} alt={<><Dugme onClick={kapat}>Vazgeç</Dugme><Dugme tur="birincil" onClick={kaydet}><Save size={16} aria-hidden /> Kaydet</Dugme></>}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void kaydet(); }}>
        <Alan etiket="Kullanıcı adı">
          <input className={girdiSinif} value={kullanici} disabled={!!k} autoCapitalize="none" onChange={(e) => setKullanici(e.target.value)} />
        </Alan>
        <Alan etiket="Ad soyad">
          <input className={girdiSinif} value={ad} onChange={(e) => setAd(e.target.value)} />
        </Alan>
        {!kendisi && (
          <Alan etiket="Rol">
            <div className="flex rounded-xl bg-kart2 p-0.5">
              {(["admin", "user"] as const).map((r) => (
                <button key={r} type="button" aria-pressed={rol === r} onClick={() => setRol(r)} className={cx("min-h-10 flex-1 rounded-lg text-sm", rol === r ? "bg-kart font-semibold shadow" : "text-soluk")}>
                  {r === "admin" ? "Yönetici" : "İzleyici"}
                </button>
              ))}
            </div>
          </Alan>
        )}
        {k && !kendisi && (
          <label className="flex items-center gap-3 text-sm font-semibold">
            <Anahtar acik={aktif} degistir={setAktif} etiket="Aktif" /> Aktif
          </label>
        )}
        <Alan etiket={k ? "Yeni şifre (sıfırlamak için)" : "Şifre"}>
          <input type="password" autoComplete="new-password" className={girdiSinif} value={sifre} onChange={(e) => setSifre(e.target.value)} />
        </Alan>
        {hata && <p className="text-sm text-kotu" role="alert">{hata}</p>}
        <button type="submit" hidden />
      </form>
    </Pencere>
  );
}

/* ---------- Köprü ---------- */

const durumRozet: Record<string, { renk: string; ad: string }> = {
  guncel: { renk: "iyi", ad: "Güncel" }, gecikmeli: { renk: "orta", ad: "Gecikmeli" }, kopuk: { renk: "kritik", ad: "Bağlantı yok" },
  bekleniyor: { renk: "notr", ad: "Bekleniyor" }, yok: { renk: "notr", ad: "Kurulmadı" }, demo: { renk: "mor", ad: "Demo verisi" },
};

export function KopruDurumRozeti({ durum }: { durum: string }) {
  const d = durumRozet[durum] || durumRozet.yok;
  return <Rozet renk={d.renk}>{d.ad}</Rozet>;
}

export function AnahtarGoster({ anahtar, sunucu }: { anahtar: string; sunucu: string }) {
  const [kopyalandi, setKopyalandi] = useState(false);
  const kopyala = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(anahtar);
      setKopyalandi(true);
      window.setTimeout(() => setKopyalandi(false), 2000);
    } catch {
      /* pano izni yok */
    }
  }, [anahtar]);
  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-xl bg-orta-zemin px-3 py-2 text-sm font-medium text-orta">Bu anahtar yalnız bir kez gösterilir. Şimdi kopyalayın.</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 rounded-xl bg-kart2 px-3 py-2.5 text-sm break-all select-all" data-testid="kopru-anahtari">
          {anahtar}
        </code>
        <IkonDugme etiket={kopyalandi ? "Kopyalandı" : "Kopyala"} onClick={kopyala} className="border border-cizgi">
          {kopyalandi ? <Check size={18} className="text-iyi" aria-hidden /> : <Copy size={18} aria-hidden />}
        </IkonDugme>
      </div>
      <div className="text-sm">
        <p className="mb-1 font-semibold">Kurulum</p>
        <ol className="list-decimal space-y-1 pl-5 text-soluk">
          <li>Vega Köprü programını Arctos sunucusuna kurun.</li>
          <li>
            Sunucu adresi: <code className="rounded bg-kart2 px-1 text-yazi">{sunucu}</code>
          </li>
          <li>Yukarıdaki anahtarı yapıştırın, SQL bağlantısını (salt-okunur kullanıcı) girin.</li>
          <li>“Test” ile bağlantıyı doğrulayın; ilk eşitleme birkaç dakika sürebilir.</li>
        </ol>
        <pre className="ince-kaydirma mt-2 overflow-x-auto rounded-xl bg-kart2 p-2 text-xs text-yazi">{`node src/cli.js kur --sunucu ${sunucu} --anahtar ${anahtar} \\\n  --sql-sunucu SUNUCU\\SQLEXPRESS --sql-kullanici vega_kopru --veritabani VEGADB`}</pre>
      </div>
    </div>
  );
}

function KopruAyarlari() {
  const { bildir } = useUygulama();
  const { veri, hata, yenile } = useVeri<KopruYanit>("/kopru");
  const [etiket, setEtiket] = useState("");
  const [yeniAcik, setYeniAcik] = useState(false);
  const [anahtar, setAnahtar] = useState<string | null>(null);
  if (hata && !veri) return <HataKutusu mesaj={hata.message} yenile={yenile} />;
  if (!veri) return <KutuIskelet />;
  const d = veri.durum;

  const olustur = async () => {
    try {
      const r = await api<{ anahtar: string }>("/kopru/anahtar", { method: "POST", govde: { etiket } });
      setAnahtar(r.anahtar);
      setEtiket("");
      yenile();
    } catch (e) {
      bildir((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="kopru-ayarlari">
      <Kart className="flex flex-wrap items-center gap-4 p-4">
        <Cable size={28} className="text-marka" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-bold">
            Köprü <KopruDurumRozeti durum={d.durum} />
          </div>
          <div className="text-sm text-soluk">
            Son eşitleme {goreliZaman(d.sonEsitleme)} · son görülme {goreliZaman(d.sonGorulme)} · her {d.aralikDk} dk
          </div>
        </div>
        <Dugme onClick={async () => { try { const r = await api<{ mesaj: string }>("/kopru/tam-esitleme", { method: "POST", govde: {} }); bildir(r.mesaj); } catch (e) { bildir((e as Error).message); } }}>
          <RefreshCw size={16} aria-hidden /> Tam eşitleme iste
        </Dugme>
      </Kart>

      <Kart className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <KeyRound size={20} className="text-marka" aria-hidden />
          <h2 className="flex-1 font-bold">Anahtarlar</h2>
          <Dugme tur="birincil" onClick={() => { setAnahtar(null); setYeniAcik(true); }} data-testid="yeni-anahtar">
            <Plus size={16} aria-hidden /> Yeni anahtar
          </Dugme>
        </div>
        {veri.anahtarlar.length ? (
          <ul className="flex flex-col divide-y divide-cizgi">
            {veri.anahtarlar.map((a) => (
              <li key={a.id} className={cx("flex items-center gap-3 py-2", a.revoked && "opacity-50")}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold">
                    {a.etiket || `Anahtar #${a.id}`} {a.revoked && <Rozet renk="kritik">İptal</Rozet>}
                  </div>
                  <div className="truncate text-xs text-soluk">
                    Oluşturma {tarihSaat(a.created_at)} · son görülme {goreliZaman(a.last_seen)}
                    {a.agent ? ` · ${[a.agent.surum || a.agent.version, a.agent.makine || a.agent.host].filter(Boolean).join(" / ")}` : ""}
                  </div>
                </div>
                {!a.revoked && (
                  <IkonDugme etiket="İptal et" className="hover:text-kotu" onClick={async () => { await api(`/kopru/anahtar/${a.id}`, { method: "DELETE" }); yenile(); }}>
                    <Ban size={18} aria-hidden />
                  </IkonDugme>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-soluk">Henüz anahtar yok.</p>
        )}
      </Kart>

      <Kart className="flex flex-col gap-2 p-4">
        <h2 className="font-bold">Eşitleme geçmişi</h2>
        {veri.esitlemeler.length ? (
          <div className="ince-kaydirma overflow-x-auto rounded-xl border border-cizgi">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-kart2 text-left text-soluk">
                <tr>
                  <th className="px-3 py-2">Başlangıç</th>
                  <th className="px-3 py-2">Durum</th>
                  <th className="px-3 py-2 text-right">Parça</th>
                  <th className="px-3 py-2 text-right">Satır</th>
                  <th className="px-3 py-2">Mesaj</th>
                </tr>
              </thead>
              <tbody>
                {veri.esitlemeler.map((s) => (
                  <tr key={s.sync_id} className="border-t border-cizgi">
                    <td className="rakam px-3 py-1.5 whitespace-nowrap">{tarihSaat(s.started_at)}</td>
                    <td className="px-3 py-1.5"><Rozet renk={s.status === "tamam" ? "iyi" : s.status === "hata" ? "kritik" : "notr"}>{s.status}</Rozet></td>
                    <td className="rakam px-3 py-1.5 text-right">{sayi(s.chunks)}</td>
                    <td className="rakam px-3 py-1.5 text-right">{sayi(s.rows)}</td>
                    <td className="max-w-xs truncate px-3 py-1.5 text-soluk">{s.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-soluk">Henüz eşitleme yok.</p>
        )}
      </Kart>

      <Kart className="flex flex-col gap-2 p-4">
        <h2 className="font-bold">Ajan olayları</h2>
        {veri.olaylar.length ? (
          <ul className="ince-kaydirma flex max-h-72 flex-col gap-1 overflow-y-auto text-sm">
            {veri.olaylar.map((o, i) => (
              <li key={i} className="flex gap-2">
                <span className="rakam shrink-0 text-soluk">{tarihSaat(o.at)}</span>
                <Rozet renk={o.level === "error" || o.level === "hata" ? "kritik" : o.level === "warn" || o.level === "uyari" ? "orta" : "notr"}>{o.level}</Rozet>
                <span className="min-w-0 break-words">{o.msg}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-soluk">Olay yok.</p>
        )}
        {veri.veri && (
          <p className="text-xs text-soluk">
            Bulutta: {Object.entries(veri.veri).filter(([k]) => k !== "chunks").map(([k, v]) => `${k} ${sayi(v)}`).join(" · ")}
          </p>
        )}
      </Kart>

      <Pencere
        acik={yeniAcik}
        kapat={() => setYeniAcik(false)}
        baslik={anahtar ? "Köprü anahtarı" : "Yeni anahtar"}
        alt={anahtar ? <Dugme tur="birincil" onClick={() => setYeniAcik(false)}><Check size={16} aria-hidden /> Tamam</Dugme> : <><Dugme onClick={() => setYeniAcik(false)}>Vazgeç</Dugme><Dugme tur="birincil" onClick={olustur}><Plus size={16} aria-hidden /> Oluştur</Dugme></>}
      >
        {anahtar ? (
          <AnahtarGoster anahtar={anahtar} sunucu={veri.sunucu} />
        ) : (
          <Alan etiket="Etiket" ipucu="ör. Merkez sunucu">
            <input className={girdiSinif} value={etiket} maxLength={60} onChange={(e) => setEtiket(e.target.value)} />
          </Alan>
        )}
      </Pencere>
    </div>
  );
}
