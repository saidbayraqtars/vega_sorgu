import { Bell } from "lucide-react";
import { sorgu } from "../lib/api";
import type { Uyari } from "../lib/types";
import { useVeri } from "../state/rapor";
import { useUygulama } from "../state/uygulama";
import { HataKutusu, Ikon, Kart, KutuIskelet, cx, renkSinif } from "../components/ui";
import { UyariSatiri, seviyeBilgi } from "./Durum";

export function Uyarilar() {
  const { firmaParam } = useUygulama();
  const { veri, hata, yenile } = useVeri<{ uyarilar: Uyari[]; ozet: Record<string, number> }>(`/uyarilar${sorgu({ firma: firmaParam })}`);
  return (
    <div className="flex flex-col gap-3" data-testid="uyarilar-sayfasi">
      <h1 className="flex items-center gap-2 text-xl font-extrabold">
        <Bell size={24} className="text-marka" aria-hidden /> Uyarılar
      </h1>
      {hata && !veri ? (
        <Kart className="p-4"><HataKutusu mesaj={hata.message} yenile={yenile} /></Kart>
      ) : !veri ? (
        <KutuIskelet yukseklik="h-64" />
      ) : !veri.uyarilar.length ? (
        <Kart className="flex items-center gap-3 p-5 text-iyi">
          <Ikon ad="BadgeCheck" boyut={28} /> <span className="text-lg font-semibold">Her şey yolunda — uyarı yok</span>
        </Kart>
      ) : (
        (["kritik", "uyari", "bilgi"] as const).map((sv) => {
          const liste = veri.uyarilar.filter((u) => u.seviye === sv);
          if (!liste.length) return null;
          const s = seviyeBilgi[sv];
          const r = renkSinif(s.renk);
          return (
            <Kart key={sv} className="p-3 sm:p-4" data-testid={`uyari-grup-${sv}`}>
              <h2 className={cx("mb-2 flex items-center gap-2 font-bold", r.yazi)}>
                <Ikon ad={s.ikon} boyut={20} /> {s.ad}
                <span className={cx("rounded-full px-2 text-sm", r.zemin)}>{liste.length}</span>
              </h2>
              <div className="flex flex-col gap-1">
                {liste.map((u) => (
                  <UyariSatiri key={u.id} u={u} />
                ))}
              </div>
            </Kart>
          );
        })
      )}
    </div>
  );
}
