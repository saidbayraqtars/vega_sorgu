// Grafik türü → ikon ve kısa ad
import { ChartArea, ChartBar, ChartColumn, ChartLine, ChartPie, SquareStack, Grid3x3, ArrowLeftRight, Table, Gauge, Rocket, Scale, Layers, Hash, ChartNoAxesCombined, type LucideIcon } from "lucide-react";
import type { GrafikTuru } from "./types";

export const GRAFIK: Record<GrafikTuru, { ad: string; ikon: LucideIcon }> = {
  sayi: { ad: "Sayı", ikon: Hash },
  cizgi: { ad: "Çizgi", ikon: ChartLine },
  alan: { ad: "Alan", ikon: ChartArea },
  sutun: { ad: "Sütun", ikon: ChartColumn },
  cubuk: { ad: "Çubuk", ikon: ChartBar },
  pasta: { ad: "Halka", ikon: ChartPie },
  agac: { ad: "Ağaç", ikon: SquareStack },
  isi: { ad: "Isı haritası", ikon: Grid3x3 },
  pareto: { ad: "Pareto", ikon: ChartNoAxesCombined },
  karsilastir: { ad: "Karşılaştır", ikon: ArrowLeftRight },
  tablo: { ad: "Tablo", ikon: Table },
  gosterge: { ad: "Gösterge", ikon: Gauge },
  buyume: { ad: "Büyüme", ikon: Rocket },
  bilanco: { ad: "Bilanço", ikon: Scale },
  coklu: { ad: "Çoklu", ikon: Layers },
};
