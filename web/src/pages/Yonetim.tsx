// Sistem yöneticisi: firmalar (kiracılar)
import { useState } from "react";
import { Building2, Plus, Eye, Power, Database, Trash2, Save } from "lucide-react";
import { api } from "../lib/api";
import { sayi } from "../lib/bicim";
import type { KopruDurumu } from "../lib/types";
import { useVeri } from "../state/rapor";
import { useUygulama } from "../state/uygulama";
import { useYon } from "../lib/yonlendirici";
import { panolarSifirlaBellek } from "../state/panolar";
import { Alan, Anahtar, Dugme, HataKutusu, IkonDugme, Kart, KutuIskelet, Pencere, Rozet, cx, girdiSinif } from "../components/ui";
import { AnahtarGoster, KopruDurumRozeti } from "./Ayarlar";

type Firma = { id: number; kod: string; ad: string; aktif: boolean; olusturma: string; kopru: KopruDurumu; kullaniciSayisi: number; veriSurumu: number; satir: number; demo: boolean };

export function Yonetim() {
  const { kullanici, benYenile, bildir } = useUygulama();
  const { git } = useYon();
  const { veri, hata, yenile } = useVeri<{ firmalar: Firma[] }>("/yonetim/firmalar");
  const [yeniAcik, setYeniAcik] = useState(false);
  const [sil, setSil] = useState<Firma | null>(null);
  const [silOnay, setSilOnay] = useState("");
  const [sonuc, setSonuc] = useState<{ anahtar: string; firma: string } | null>(null);
  const [bekle, setBekle] = useState<number | null>(null);

  if (kullanici?.rol !== "super") return <Kart className="p-4"><HataKutusu mesaj="Bu sayfa yalnız sistem yöneticisi içindir." /></Kart>;

  const gorunum = async (f: Firma) => {
    await api("/yonetim/gorunum", { method: "POST", govde: { firmaId: f.id } });
    panolarSifirlaBellek();
    await benYenile();
    git("/");
  };
  const islem = async (id: number, fn: () => Promise<unknown>, mesaj: string) => {
    setBekle(id);
    try {
      await fn();
      bildir(mesaj);
      yenile();
    } catch (e) {
      bildir((e as Error).message);
    } finally {
      setBekle(null);
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="yonetim-sayfasi">
      <div className="flex items-center gap-2">
        <h1 className="flex flex-1 items-center gap-2 text-xl font-extrabold">
          <Building2 size={24} className="text-marka" aria-hidden /> Yönetim
        </h1>
        <Dugme tur="birincil" onClick={() => setYeniAcik(true)}>
          <Plus size={18} aria-hidden /> Yeni firma
        </Dugme>
      </div>
      {kullanici.gorunenFirma && (
        <p className="text-sm text-soluk">
          Görüntülenen firma: <b className="text-yazi">{kullanici.gorunenFirma.ad}</b>
        </p>
      )}
      {hata && !veri ? (
        <HataKutusu mesaj={hata.message} yenile={yenile} />
      ) : !veri ? (
        <KutuIskelet />
      ) : (
        <Kart className="ince-kaydirma overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-kart2 text-left text-soluk">
              <tr>
                <th className="px-3 py-2">Kod</th>
                <th className="px-3 py-2">Ad</th>
                <th className="px-3 py-2">Köprü</th>
                <th className="px-3 py-2 text-right">Kullanıcı</th>
                <th className="px-3 py-2 text-right">Satır</th>
                <th className="px-3 py-2 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {veri.firmalar.map((f) => (
                <tr key={f.id} className={cx("border-t border-cizgi", !f.aktif && "opacity-60")}>
                  <td className="px-3 py-2 font-mono">{f.kod}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 font-semibold">
                      {f.ad} {f.demo && <Rozet renk="mor">Demo</Rozet>} {!f.aktif && <Rozet renk="kritik">Pasif</Rozet>}
                    </div>
                  </td>
                  <td className="px-3 py-2"><KopruDurumRozeti durum={f.kopru.durum} /></td>
                  <td className="rakam px-3 py-2 text-right">{sayi(f.kullaniciSayisi)}</td>
                  <td className="rakam px-3 py-2 text-right">{sayi(f.satir)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-0.5">
                      <IkonDugme etiket="Bu firmayı görüntüle" onClick={() => void gorunum(f)} data-testid="firma-gorunum">
                        <Eye size={18} aria-hidden />
                      </IkonDugme>
                      <IkonDugme etiket={f.aktif ? "Pasif yap" : "Aktif yap"} disabled={bekle === f.id} onClick={() => void islem(f.id, () => api(`/yonetim/firmalar/${f.id}`, { method: "PUT", govde: { aktif: !f.aktif } }), f.aktif ? "Firma pasif" : "Firma aktif")}>
                        <Power size={18} className={f.aktif ? "text-iyi" : ""} aria-hidden />
                      </IkonDugme>
                      {(f.demo || f.satir === 0) && (
                        <IkonDugme etiket="Demo verisini yeniden yükle" disabled={bekle === f.id} onClick={() => void islem(f.id, () => api(`/yonetim/firmalar/${f.id}/demo`, { method: "POST", govde: {} }), "Demo verisi yüklendi")}>
                          <Database size={18} className={cx(bekle === f.id && "animate-pulse")} aria-hidden />
                        </IkonDugme>
                      )}
                      <IkonDugme etiket="Sil" className="hover:text-kotu" onClick={() => { setSil(f); setSilOnay(""); }}>
                        <Trash2 size={18} aria-hidden />
                      </IkonDugme>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Kart>
      )}

      <YeniFirmaPenceresi acik={yeniAcik} kapat={() => setYeniAcik(false)} olustu={(anahtar, firma) => { setYeniAcik(false); setSonuc({ anahtar, firma }); yenile(); }} />

      <Pencere acik={!!sonuc} kapat={() => setSonuc(null)} baslik={`${sonuc?.firma || ""} — köprü anahtarı`} alt={<Dugme tur="birincil" onClick={() => setSonuc(null)}>Tamam</Dugme>}>
        {sonuc && <AnahtarGoster anahtar={sonuc.anahtar} sunucu={window.location.origin} />}
      </Pencere>

      <Pencere
        acik={!!sil}
        kapat={() => setSil(null)}
        baslik="Firmayı sil"
        alt={
          <>
            <Dugme onClick={() => setSil(null)}>Vazgeç</Dugme>
            <Dugme tur="tehlike" disabled={silOnay !== sil?.kod} onClick={() => { const f = sil!; setSil(null); void islem(f.id, () => api(`/yonetim/firmalar/${f.id}`, { method: "DELETE", govde: { onay: silOnay } }), "Firma silindi"); }}>
              <Trash2 size={16} aria-hidden /> Kalıcı olarak sil
            </Dugme>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p>
            <b>{sil?.ad}</b> ve tüm verisi kalıcı olarak silinecek. Bu işlem geri alınamaz.
          </p>
          <Alan etiket={`Onaylamak için firma kodunu yazın: ${sil?.kod}`}>
            <input className={girdiSinif} value={silOnay} onChange={(e) => setSilOnay(e.target.value)} autoCapitalize="none" />
          </Alan>
        </div>
      </Pencere>
    </div>
  );
}

function YeniFirmaPenceresi({ acik, kapat, olustu }: { acik: boolean; kapat: () => void; olustu: (anahtar: string, firma: string) => void }) {
  const [f, setF] = useState({ kod: "", ad: "", yoneticiKullanici: "", yoneticiSifre: "", yoneticiAd: "", demo: false });
  const [hata, setHata] = useState<string | null>(null);
  const [bekle, setBekle] = useState(false);
  const kaydet = async () => {
    setHata(null);
    if (!f.kod || !f.ad) return setHata("Kod ve ad gerekli.");
    setBekle(true);
    try {
      const r = await api<{ kopruAnahtari: string; firma: { ad: string } }>("/yonetim/firmalar", {
        method: "POST",
        govde: { kod: f.kod, ad: f.ad, demo: f.demo, ...(f.yoneticiKullanici ? { yoneticiKullanici: f.yoneticiKullanici, yoneticiSifre: f.yoneticiSifre, yoneticiAd: f.yoneticiAd } : {}) },
      });
      setF({ kod: "", ad: "", yoneticiKullanici: "", yoneticiSifre: "", yoneticiAd: "", demo: false });
      olustu(r.kopruAnahtari, r.firma.ad);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setBekle(false);
    }
  };
  return (
    <Pencere acik={acik} kapat={kapat} baslik="Yeni firma" alt={<><Dugme onClick={kapat}>Vazgeç</Dugme><Dugme tur="birincil" onClick={kaydet} disabled={bekle}><Save size={16} aria-hidden /> Oluştur</Dugme></>}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void kaydet(); }}>
        <div className="grid grid-cols-[8rem_1fr] gap-2">
          <Alan etiket="Kod">
            <input className={girdiSinif} value={f.kod} autoCapitalize="none" onChange={(e) => setF({ ...f, kod: e.target.value })} placeholder="firma1" />
          </Alan>
          <Alan etiket="Ad">
            <input className={girdiSinif} value={f.ad} onChange={(e) => setF({ ...f, ad: e.target.value })} />
          </Alan>
        </div>
        <Alan etiket="Yönetici kullanıcı adı">
          <input className={girdiSinif} value={f.yoneticiKullanici} autoCapitalize="none" onChange={(e) => setF({ ...f, yoneticiKullanici: e.target.value })} />
        </Alan>
        <div className="grid grid-cols-2 gap-2">
          <Alan etiket="Yönetici şifresi">
            <input type="password" autoComplete="new-password" className={girdiSinif} value={f.yoneticiSifre} onChange={(e) => setF({ ...f, yoneticiSifre: e.target.value })} />
          </Alan>
          <Alan etiket="Yönetici adı">
            <input className={girdiSinif} value={f.yoneticiAd} onChange={(e) => setF({ ...f, yoneticiAd: e.target.value })} />
          </Alan>
        </div>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <Anahtar acik={f.demo} degistir={(v) => setF({ ...f, demo: v })} etiket="Demo verisi yükle" /> Demo verisi yükle
        </label>
        {hata && <p className="text-sm text-kotu" role="alert">{hata}</p>}
        <button type="submit" hidden />
      </form>
    </Pencere>
  );
}
