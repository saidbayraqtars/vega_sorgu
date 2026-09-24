// Tembel yüklenen ECharts sarmalayıcısı. Tema değişince grafik yeniden oluşturulur.
import { useEffect, useRef, useState } from "react";
import type { EChartsCoreOption, ECharts } from "echarts/core";
import { useUygulama } from "../state/uygulama";
import { Iskelet } from "../components/ui";

type EchartsModul = typeof import("./echarts-yukle").default;
let yukleme: Promise<EchartsModul> | null = null;
export function echartsYukle(): Promise<EchartsModul> {
  if (!yukleme) yukleme = import("./echarts-yukle").then((m) => m.default);
  return yukleme;
}

export type SecenekUretici = (koyu: boolean) => EChartsCoreOption;

export function EChart({
  secenek, yukseklik = 260, onTikla, etiket,
}: { secenek: SecenekUretici; yukseklik?: number | string; onTikla?: (p: { dataIndex: number; seriesIndex?: number; name?: string; data?: unknown }) => void; etiket?: string }) {
  const kap = useRef<HTMLDivElement>(null);
  const grafik = useRef<ECharts | null>(null);
  const { koyu } = useUygulama();
  const [hazir, setHazir] = useState(false);
  const [hata, setHata] = useState(false);
  const tiklaRef = useRef(onTikla);
  tiklaRef.current = onTikla;

  // Oluştur / tema değişince yeniden oluştur
  useEffect(() => {
    let iptal = false;
    let gozlemci: ResizeObserver | null = null;
    echartsYukle().then(
      (ec) => {
        if (iptal || !kap.current) return;
        const g = ec.init(kap.current, undefined, { renderer: "canvas", locale: "EN" });
        grafik.current = g;
        g.on("click", (p) => tiklaRef.current?.(p as never));
        gozlemci = new ResizeObserver(() => g.resize());
        gozlemci.observe(kap.current);
        setHazir(true);
      },
      () => !iptal && setHata(true),
    );
    return () => {
      iptal = true;
      gozlemci?.disconnect();
      grafik.current?.dispose();
      grafik.current = null;
      setHazir(false);
    };
  }, [koyu]);

  useEffect(() => {
    if (!hazir || !grafik.current) return;
    try {
      grafik.current.setOption(secenek(koyu), { notMerge: true, lazyUpdate: true });
    } catch (e) {
      console.warn("Grafik çizilemedi:", (e as Error).message);
    }
  }, [hazir, secenek, koyu]);

  return (
    <div className="relative w-full" style={{ height: yukseklik }}>
      <div ref={kap} className="absolute inset-0" role="img" aria-label={etiket || "Grafik"} data-grafik />
      {!hazir && !hata && <Iskelet className="absolute inset-0" />}
      {hata && <div className="absolute inset-0 flex items-center justify-center text-sm text-kotu">Grafik yüklenemedi</div>}
    </div>
  );
}
