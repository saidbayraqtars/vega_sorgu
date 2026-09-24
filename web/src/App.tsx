import { useEffect } from "react";
import { oturumOlayi } from "./lib/api";
import { Yonlendirici, eslestir, useYon } from "./lib/yonlendirici";
import { UygulamaSaglayici, useUygulama } from "./state/uygulama";
import { panolarSifirlaBellek } from "./state/panolar";
import { Kabuk } from "./components/Kabuk";
import { CariSaglayici } from "./components/CariPanel";
import { HataKutusu, HataSiniri, Kart, KutuIskelet } from "./components/ui";
import { Giris } from "./pages/Giris";
import { Durum } from "./pages/Durum";
import { Panolar } from "./pages/Panolar";
import { Raporlar } from "./pages/Raporlar";
import { RaporGoruntuleyici } from "./pages/RaporGoruntuleyici";
import { Uyarilar } from "./pages/Uyarilar";
import { AyarlarSayfasi } from "./pages/Ayarlar";
import { Yonetim } from "./pages/Yonetim";

function Sayfa() {
  const { yol } = useYon();
  let p: Record<string, string> | null;
  if (yol === "/" || yol === "") return <Durum />;
  if (yol === "/pano") return <Panolar />;
  if ((p = eslestir("/pano/:id", yol))) return <Panolar id={p.id} />;
  if (yol === "/raporlar") return <Raporlar />;
  if ((p = eslestir("/rapor/:id", yol))) return <RaporGoruntuleyici key={p.id} id={p.id} />;
  if (yol === "/uyarilar") return <Uyarilar />;
  if (yol === "/ayarlar") return <AyarlarSayfasi />;
  if (yol === "/yonetim") return <Yonetim />;
  return (
    <Kart className="p-4">
      <HataKutusu mesaj="Sayfa bulunamadı" />
    </Kart>
  );
}

function Icerik() {
  const { kullanici, meta, metaHata, metaYenile } = useUygulama();
  const { yol, git } = useYon();

  // Firma seçmemiş sistem yöneticisi → /yonetim
  useEffect(
    () =>
      oturumOlayi((durum) => {
        if (durum === 409) git("/yonetim");
      }),
    [git],
  );
  useEffect(() => {
    if (kullanici?.rol === "super" && !kullanici.gorunenFirma && yol !== "/yonetim") git("/yonetim", { degistir: true });
  }, [kullanici, yol, git]);
  useEffect(() => {
    if (kullanici === null) panolarSifirlaBellek();
  }, [kullanici]);

  if (kullanici === undefined)
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <img src="/logo.svg" alt="Yükleniyor" width={56} height={56} className="animate-pulse" />
      </div>
    );
  if (kullanici === null) return <Giris />;

  const firmaGerekmez = yol === "/yonetim";
  return (
    <Kabuk>
      <HataSiniri sifirla={yol}>
        {firmaGerekmez ? (
          <Sayfa />
        ) : !kullanici.gorunenFirma ? (
          <KutuIskelet />
        ) : metaHata && !meta ? (
          <Kart className="p-4">
            <HataKutusu mesaj={metaHata} yenile={() => void metaYenile()} />
          </Kart>
        ) : !meta ? (
          <KutuIskelet yukseklik="h-96" />
        ) : (
          <Sayfa />
        )}
      </HataSiniri>
      <Bildirim />
    </Kabuk>
  );
}

function Bildirim() {
  const { bildirim } = useUygulama();
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6">
      {bildirim && (
        <div className="pointer-events-auto rounded-2xl bg-yazi px-4 py-2.5 text-sm font-semibold text-zemin shadow-xl" data-testid="bildirim">
          {bildirim}
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <Yonlendirici>
      <UygulamaSaglayici>
        <CariSaglayici>
          <Icerik />
        </CariSaglayici>
      </UygulamaSaglayici>
    </Yonlendirici>
  );
}
