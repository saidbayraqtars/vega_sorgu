// Sonuç türlerinden ECharts seçenekleri üretir (saf fonksiyonlar; ECharts'ı içe aktarmaz).
import type { EChartsCoreOption } from "echarts/core";
import { birimli, kisaSayi, kisaTarih, tarih, yuzde, degisim as degisimBicim } from "../lib/bicim";
import type { Iyi, KategoriSatir, ProjeksiyonNokta, Seri } from "../lib/types";

export type Palet = {
  kategorik: string[];
  iyi: string;
  orta: string;
  kotu: string;
  notr: string;
  yazi: string;
  soluk: string;
  cizgi: string;
  kart: string;
  marka: string;
};

export function palet(koyu: boolean): Palet {
  return koyu
    ? {
        kategorik: ["#8b93ff", "#38bdf8", "#fbbf24", "#34d399", "#f472b6", "#c4b5fd", "#2dd4bf", "#fb923c"],
        iyi: "#4ade80", orta: "#fbbf24", kotu: "#f87171", notr: "#6b7280",
        yazi: "#e7eaf3", soluk: "#9aa3b8", cizgi: "#283152", kart: "#141a2e", marka: "#8b93ff",
      }
    : {
        kategorik: ["#4f46e5", "#0284c7", "#d97706", "#059669", "#db2777", "#7c3aed", "#0d9488", "#ea580c"],
        iyi: "#16a34a", orta: "#d97706", kotu: "#dc2626", notr: "#9ca3af",
        yazi: "#111827", soluk: "#5b6474", cizgi: "#e2e7ef", kart: "#ffffff", marka: "#4f46e5",
      };
}

function temel(p: Palet): EChartsCoreOption {
  return {
    color: p.kategorik,
    animationDuration: 400,
    textStyle: { fontFamily: "Inter Variable, system-ui, sans-serif", color: p.soluk },
    tooltip: {
      backgroundColor: p.kart,
      borderColor: p.cizgi,
      textStyle: { color: p.yazi, fontSize: 13 },
      confine: true,
      extraCssText: "border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.18);",
    },
  };
}

function eksenStil(p: Palet) {
  return {
    axisLine: { lineStyle: { color: p.cizgi } },
    axisTick: { show: false },
    axisLabel: { color: p.soluk, fontSize: 11 },
    splitLine: { lineStyle: { color: p.cizgi, type: "dashed" as const } },
  };
}

function kisaAd(s: string, n = 22) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

const nokta = (renk: string) => `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${renk};margin-right:6px"></span>`;

/* ---------- Zaman serisi ---------- */

export function seriSecenek(p: Palet, seriler: Seri[], grafik: string, birim: string, kucuk = false): EChartsCoreOption {
  const ana = seriler.find((s) => !s.bant) || seriler[0];
  const xler = (ana?.veri || []).map((d) => d.ad);
  const alt = seriler.find((s) => s.bant && /alt/i.test(s.id));
  const ust = seriler.find((s) => s.bant && /ust/i.test(s.id));
  const normal = seriler.filter((s) => !s.bant);
  const series: unknown[] = [];
  let ci = 0;
  for (const s of normal) {
    const renk = p.kategorik[ci++ % p.kategorik.length];
    const sutunMu = grafik === "sutun" && !s.kesikli;
    const veri = s.veri.map((d) => ({
      value: d.v,
      itemStyle: d.devam ? { opacity: 0.45 } : undefined,
      symbol: d.devam ? "emptyCircle" : undefined,
      symbolSize: d.devam ? 7 : undefined,
    }));
    series.push({
      name: s.ad,
      type: sutunMu ? "bar" : "line",
      data: veri,
      smooth: false,
      connectNulls: false,
      showSymbol: xler.length <= 40,
      symbolSize: 5,
      barMaxWidth: 28,
      itemStyle: { color: renk, borderRadius: sutunMu ? [4, 4, 0, 0] : undefined },
      lineStyle: { width: s.kesikli ? 2 : 2.5, type: s.kesikli ? "dashed" : "solid", color: renk },
      areaStyle: grafik === "alan" && !s.kesikli ? { opacity: 0.16, color: renk } : undefined,
      z: s.kesikli ? 1 : 2,
    });
  }
  if (alt && ust) {
    const altV = alt.veri.map((d) => d.v);
    series.push(
      { name: alt.ad, type: "line", data: altV, stack: "bant", lineStyle: { opacity: 0 }, symbol: "none", tooltip: { show: false } },
      {
        name: ust.ad, type: "line", stack: "bant", symbol: "none", lineStyle: { opacity: 0 },
        areaStyle: { color: p.kategorik[1], opacity: 0.15 },
        data: ust.veri.map((d, i) => (d.v === null || altV[i] === null ? null : (d.v as number) - (altV[i] as number))),
        tooltip: { show: false },
      },
    );
  }
  const gorunenAdlar = normal.map((s) => s.ad);
  return {
    ...temel(p),
    grid: { left: 8, right: 12, top: normal.length > 1 && !kucuk ? 36 : 14, bottom: 8, containLabel: true },
    legend: normal.length > 1 && !kucuk ? { data: gorunenAdlar, top: 0, textStyle: { color: p.soluk }, icon: "roundRect", itemWidth: 14, itemHeight: 8 } : undefined,
    tooltip: {
      ...(temel(p).tooltip as object),
      trigger: "axis",
      formatter: (ps: { seriesName: string; value: number | null; color: string; axisValueLabel: string; dataIndex: number }[]) => {
        if (!ps.length) return "";
        const i = ps[0].dataIndex;
        let s = `<b>${ps[0].axisValueLabel}</b>`;
        for (const x of ps) if (gorunenAdlar.includes(x.seriesName) && x.value !== null && x.value !== undefined) s += `<br/>${nokta(x.color)}${x.seriesName}: <b>${birimli(x.value, birim)}</b>`;
        if (alt && ust && alt.veri[i]?.v != null) s += `<br/><span style="opacity:.75">Aralık: ${birimli(alt.veri[i].v, birim, true)} – ${birimli(ust.veri[i].v, birim, true)}</span>`;
        return s;
      },
    },
    xAxis: { type: "category", data: xler, boundaryGap: grafik === "sutun", ...eksenStil(p), splitLine: { show: false } },
    yAxis: { type: "value", ...eksenStil(p), axisLabel: { color: p.soluk, fontSize: 11, formatter: (v: number) => birimEksen(v, birim) } },
    series,
  };
}

function birimEksen(v: number, birim: string) {
  if (birim === "%") return `%${kisaSayi(v)}`;
  if (birim === "gün") return `${kisaSayi(v)} g`;
  return kisaSayi(v);
}

export function kivilcimSecenek(p: Palet, degerler: (number | null)[], renk?: string, etiketler?: string[], birim = "TL"): EChartsCoreOption {
  const r = renk || p.marka;
  return {
    animation: false,
    grid: { left: 0, right: 0, top: 2, bottom: 2 },
    tooltip: {
      ...(temel(p).tooltip as object),
      trigger: "axis",
      formatter: (ps: { dataIndex: number; value: number }[]) => `${etiketler?.[ps[0].dataIndex] ?? ""} <b>${birimli(ps[0].value, birim)}</b>`,
    },
    xAxis: { type: "category", show: false, data: degerler.map((_, i) => etiketler?.[i] ?? String(i)), boundaryGap: false },
    yAxis: { type: "value", show: false, scale: true },
    series: [{ type: "line", data: degerler, symbol: "none", lineStyle: { width: 2, color: r }, areaStyle: { color: r, opacity: 0.12 }, smooth: true }],
  };
}

/* ---------- Kategori ---------- */

export function cubukSecenek(p: Palet, satirlar: KategoriSatir[], diger: KategoriSatir | null | undefined, birim: string, dikey: boolean): EChartsCoreOption {
  // "Diğer" ölçeği ezmesin: yatay çubukta grafiğe katılmaz (altta metin olarak gösterilir)
  const tum = dikey && diger && diger.v ? [...satirlar, diger] : satirlar;
  const veri = tum.map((s, i) => ({
    value: s.v,
    itemStyle: { color: s.k === "__diger" ? p.notr : p.kategorik[dikey ? 0 : i === 0 ? 0 : 0], borderRadius: dikey ? [4, 4, 0, 0] : [0, 4, 4, 0] },
  }));
  const adlar = tum.map((s) => s.ad);
  const tooltip = {
    ...(temel(p).tooltip as object),
    trigger: "item",
    formatter: (x: { dataIndex: number }) => {
      const s = tum[x.dataIndex];
      return `<b>${s.ad}</b><br/>${birimli(s.v, birim)}${s.pay != null ? ` · ${yuzde(s.pay)}` : ""}${s.aciklama ? `<br/><span style="opacity:.75">${s.aciklama}</span>` : ""}`;
    },
  };
  if (dikey) {
    return {
      ...temel(p),
      tooltip,
      grid: { left: 8, right: 8, top: 22, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: adlar, ...eksenStil(p), splitLine: { show: false }, axisLabel: { color: p.soluk, fontSize: 11, interval: 0, hideOverlap: true, formatter: (s: string) => kisaAd(s, 12) } },
      yAxis: { type: "value", ...eksenStil(p), axisLabel: { color: p.soluk, fontSize: 11, formatter: (v: number) => birimEksen(v, birim) } },
      series: [{ type: "bar", data: veri, barMaxWidth: 40, label: { show: tum.length <= 12, position: "top", color: p.soluk, fontSize: 11, formatter: (x: { value: number }) => birimli(x.value, birim, true) } }],
    };
  }
  return {
    ...temel(p),
    tooltip,
    grid: { left: 8, right: 76, top: 4, bottom: 4, containLabel: true },
    xAxis: { type: "value", show: false },
    yAxis: { type: "category", inverse: true, data: adlar, ...eksenStil(p), axisLine: { show: false }, axisLabel: { color: p.yazi, fontSize: 12, width: 130, overflow: "truncate" } },
    series: [
      {
        type: "bar",
        data: veri,
        barMaxWidth: 22,
        barCategoryGap: "28%",
        label: {
          show: true,
          position: "right",
          color: p.soluk,
          fontSize: 11,
          fontWeight: 600,
          formatter: (x: { dataIndex: number }) => {
            const s = tum[x.dataIndex];
            return `${birimli(s.v, birim, true)}${s.pay != null ? `  ${yuzde(s.pay, 0)}` : ""}`;
          },
        },
        labelLayout: { hideOverlap: true },
      },
    ],
  };
}

export function pastaSecenek(p: Palet, satirlar: KategoriSatir[], diger: KategoriSatir | null | undefined, birim: string): EChartsCoreOption {
  const tum = diger && diger.v ? [...satirlar, diger] : satirlar;
  return {
    ...temel(p),
    tooltip: { ...(temel(p).tooltip as object), trigger: "item", formatter: (x: { dataIndex: number }) => `<b>${tum[x.dataIndex].ad}</b><br/>${birimli(tum[x.dataIndex].v, birim)} · ${yuzde(tum[x.dataIndex].pay ?? null)}` },
    series: [
      {
        type: "pie",
        radius: ["52%", "80%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: p.kart, borderWidth: 2, borderRadius: 4 },
        label: { show: false },
        data: tum.map((s, i) => ({ name: s.ad, value: Math.max(0, s.v), itemStyle: { color: s.k === "__diger" ? p.notr : p.kategorik[i % p.kategorik.length] } })),
      },
    ],
  };
}

export function agacSecenek(p: Palet, satirlar: KategoriSatir[], diger: KategoriSatir | null | undefined, birim: string): EChartsCoreOption {
  const tum = diger && diger.v ? [...satirlar, diger] : satirlar;
  return {
    ...temel(p),
    tooltip: { ...(temel(p).tooltip as object), formatter: (x: { dataIndex: number; name: string; value: number }) => `<b>${x.name}</b><br/>${birimli(x.value, birim)}` },
    series: [
      {
        type: "treemap",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        width: "100%",
        height: "100%",
        label: { show: true, formatter: (x: { name: string; value: number }) => `${x.name}\n${birimli(x.value, birim, true)}`, fontSize: 12, color: "#fff" },
        itemStyle: { borderColor: p.kart, borderWidth: 2, gapWidth: 2, borderRadius: 4 },
        data: tum.map((s, i) => ({ name: s.ad, value: Math.max(0, s.v), itemStyle: { color: s.k === "__diger" ? p.notr : p.kategorik[i % p.kategorik.length] } })),
      },
    ],
  };
}

export function karsilastirSecenek(p: Palet, satirlar: KategoriSatir[], birim: string, iyi: Iyi | undefined): EChartsCoreOption {
  const renk = (v: number) => (iyi === "notr" || !v ? p.notr : (v > 0) === (iyi !== "asagi") ? p.iyi : p.kotu);
  return {
    ...temel(p),
    tooltip: {
      ...(temel(p).tooltip as object),
      trigger: "item",
      formatter: (x: { dataIndex: number }) => {
        const s = satirlar[x.dataIndex];
        return `<b>${s.ad}</b><br/>Şimdi: <b>${birimli(s.v, birim)}</b><br/>Önceki: ${birimli(s.onceki ?? null, birim)}<br/>Fark: ${birimli(s.fark ?? null, birim)}${s.degisim != null ? ` (${degisimBicim(s.degisim)})` : ""}`;
      },
    },
    grid: { left: 8, right: 16, top: 4, bottom: 4, containLabel: true },
    xAxis: { type: "value", ...eksenStil(p), axisLabel: { color: p.soluk, fontSize: 11, formatter: (v: number) => birimEksen(v, birim) } },
    yAxis: { type: "category", inverse: true, data: satirlar.map((s) => s.ad), ...eksenStil(p), axisLine: { show: false }, axisLabel: { color: p.yazi, fontSize: 12, width: 120, overflow: "truncate" } },
    series: [
      {
        type: "bar",
        barMaxWidth: 20,
        data: satirlar.map((s) => ({ value: s.fark ?? 0, itemStyle: { color: renk(s.fark ?? 0), borderRadius: (s.fark ?? 0) >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] } })),
        markLine: { silent: true, symbol: "none", lineStyle: { color: p.soluk, type: "solid" }, data: [{ xAxis: 0 }], label: { show: false } },
      },
    ],
  };
}

export function paretoSecenek(p: Palet, satirlar: KategoriSatir[], birim: string): EChartsCoreOption {
  const sinifRenk = { A: p.kategorik[0], B: p.kategorik[2], C: p.notr };
  return {
    ...temel(p),
    tooltip: {
      ...(temel(p).tooltip as object),
      trigger: "axis",
      formatter: (ps: { dataIndex: number }[]) => {
        const s = satirlar[ps[0].dataIndex];
        return `<b>${s.ad}</b> <span style="opacity:.8">(${s.sinif || "-"})</span><br/>${birimli(s.v, birim)}<br/>Kümülatif: ${yuzde(s.kum ?? null)}`;
      },
    },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: satirlar.map((s) => s.ad), ...eksenStil(p), splitLine: { show: false }, axisLabel: { show: false } },
    yAxis: [
      { type: "value", ...eksenStil(p), axisLabel: { color: p.soluk, fontSize: 11, formatter: (v: number) => birimEksen(v, birim) } },
      { type: "value", min: 0, max: 100, ...eksenStil(p), splitLine: { show: false }, axisLabel: { color: p.soluk, fontSize: 11, formatter: "%{value}" } },
    ],
    series: [
      { type: "bar", barMaxWidth: 24, data: satirlar.map((s) => ({ value: s.v, itemStyle: { color: sinifRenk[s.sinif || "C"], borderRadius: [3, 3, 0, 0] } })) },
      { type: "line", yAxisIndex: 1, data: satirlar.map((s) => Math.round((s.kum ?? 0) * 1000) / 10), symbol: "none", lineStyle: { color: p.kotu, width: 2 }, markLine: { silent: true, symbol: "none", lineStyle: { color: p.soluk, type: "dashed" }, data: [{ yAxis: 80 }], label: { show: false } } },
    ],
  };
}

export function isiSecenek(p: Palet, x: { ad: string }[], y: { ad: string }[], hucreler: [number, number, number | null][], birim: string): EChartsCoreOption {
  const degerler = hucreler.map((h) => h[2]).filter((v): v is number => typeof v === "number");
  const min = degerler.length ? Math.min(...degerler) : 0;
  const max = degerler.length ? Math.max(...degerler) : 1;
  return {
    ...temel(p),
    tooltip: {
      ...(temel(p).tooltip as object),
      formatter: (h: { value: [number, number, number | null] }) => `<b>${y[h.value[1]]?.ad} · ${x[h.value[0]]?.ad}</b><br/>${birimli(h.value[2], birim)}`,
    },
    grid: { left: 8, right: 8, top: 8, bottom: 48, containLabel: true },
    xAxis: { type: "category", data: x.map((d) => d.ad), ...eksenStil(p), splitArea: { show: false }, axisLabel: { color: p.soluk, fontSize: 10, hideOverlap: true } },
    yAxis: { type: "category", data: y.map((d) => d.ad), inverse: true, ...eksenStil(p), axisLabel: { color: p.soluk, fontSize: 11 } },
    visualMap: {
      min, max, calculable: false, orient: "horizontal", left: "center", bottom: 0, itemHeight: 140, itemWidth: 10,
      inRange: { color: [p.kart === "#ffffff" ? "#eef2ff" : "#1e2542", p.kategorik[0]] },
      textStyle: { color: p.soluk, fontSize: 11 },
      formatter: (v: number) => birimEksen(v, birim),
    },
    series: [{ type: "heatmap", data: hucreler, itemStyle: { borderColor: p.kart, borderWidth: 2, borderRadius: 3 }, emphasis: { itemStyle: { borderColor: p.yazi } } }],
  };
}

/* ---------- Özel ---------- */

export function projeksiyonSecenek(p: Palet, seri: ProjeksiyonNokta[], minKesin: { tarih: string; deger: number } | null, kucuk = false): EChartsCoreOption {
  const xler = seri.map((d) => d.t);
  // Seri 3 günde bir örneklenebilir: en düşük noktanın tarihine en yakın (≤) örneği işaretle
  let minIdx = -1;
  if (minKesin) for (let i = 0; i < xler.length && xler[i] <= minKesin.tarih; i++) minIdx = i;
  return {
    ...temel(p),
    grid: { left: 8, right: 12, top: kucuk ? 10 : 34, bottom: 8, containLabel: true },
    legend: kucuk ? undefined : { top: 0, data: ["Kesin", "Beklenen"], textStyle: { color: p.soluk }, icon: "roundRect", itemWidth: 14, itemHeight: 8 },
    tooltip: {
      ...(temel(p).tooltip as object),
      trigger: "axis",
      formatter: (ps: { dataIndex: number }[]) => {
        const d = seri[ps[0].dataIndex];
        let s = `<b>${tarih(d.t)}</b><br/>${nokta(p.kategorik[0])}Kesin: <b>${birimli(d.kesin, "TL")}</b><br/>${nokta(p.kategorik[2])}Beklenen: <b>${birimli(d.beklenen, "TL")}</b>`;
        if (d.giris || d.cikis) s += `<br/><span style="color:${p.iyi}">▲ Giriş ${birimli(d.giris ?? 0, "TL", true)}</span> · <span style="color:${p.kotu}">▼ Çıkış ${birimli(d.cikis ?? 0, "TL", true)}</span>`;
        return s;
      },
    },
    xAxis: { type: "category", data: xler, boundaryGap: false, ...eksenStil(p), splitLine: { show: false }, axisLabel: { color: p.soluk, fontSize: 11, formatter: (t: string) => kisaTarih(t), hideOverlap: true } },
    yAxis: { type: "value", ...eksenStil(p), axisLabel: { color: p.soluk, fontSize: 11, formatter: (v: number) => kisaSayi(v) } },
    series: [
      {
        name: "Kesin",
        type: "line",
        data: seri.map((d) => d.kesin),
        symbol: "none",
        lineStyle: { width: 2.5, color: p.kategorik[0] },
        areaStyle: { color: p.kategorik[0], opacity: 0.08 },
        markLine: { silent: true, symbol: "none", lineStyle: { color: p.kotu, type: "solid", width: 1 }, data: [{ yAxis: 0 }], label: { show: false } },
        markPoint:
          minIdx >= 0 && minKesin
            ? { symbol: "pin", symbolSize: kucuk ? 30 : 40, itemStyle: { color: minKesin.deger < 0 ? p.kotu : p.orta }, label: { formatter: "min", fontSize: 10, color: "#fff" }, data: [{ coord: [minIdx, minKesin.deger] }] }
            : undefined,
      },
      { name: "Beklenen", type: "line", data: seri.map((d) => d.beklenen), symbol: "none", lineStyle: { width: 2, type: "dashed", color: p.kategorik[2] } },
    ],
  };
}

export function bilancoSecenek(p: Palet, varliklar: Record<string, number>, yukumlulukler: Record<string, number>): EChartsCoreOption {
  const vAd: Record<string, string> = { kasa: "Kasa", banka: "Banka", doviz: "Döviz", alacak: "Alacak", cekSenet: "Çek/senet", stok: "Stok" };
  const yAd: Record<string, string> = { borc: "Borç", cekSenet: "Verilen çek/senet", kredi: "Kredi", kasaAcik: "Kasa açığı" };
  const series: unknown[] = [];
  let i = 0;
  for (const [k, ad] of Object.entries(vAd)) {
    const v = varliklar[k];
    if (!v) continue;
    series.push({ name: ad, type: "bar", stack: "t", barMaxWidth: 34, data: [v, null], itemStyle: { color: p.kategorik[i++ % 8] }, label: { show: true, formatter: (x: { value: number }) => (x.value ? kisaSayi(x.value) : ""), color: "#fff", fontSize: 10 } , labelLayout: { hideOverlap: true } });
  }
  const kirmizi = ["#dc2626", "#f87171", "#b91c1c", "#fca5a5"];
  let j = 0;
  for (const [k, ad] of Object.entries(yAd)) {
    const v = yukumlulukler[k];
    if (!v) continue;
    series.push({ name: ad, type: "bar", stack: "t", barMaxWidth: 34, data: [null, v], itemStyle: { color: kirmizi[j++ % 4] }, label: { show: true, formatter: (x: { value: number }) => (x.value ? kisaSayi(x.value) : ""), color: "#fff", fontSize: 10 }, labelLayout: { hideOverlap: true } });
  }
  return {
    ...temel(p),
    legend: { bottom: 0, textStyle: { color: p.soluk, fontSize: 11 }, icon: "roundRect", itemWidth: 12, itemHeight: 8 },
    tooltip: { ...(temel(p).tooltip as object), trigger: "item", formatter: (x: { seriesName: string; value: number }) => `<b>${x.seriesName}</b><br/>${birimli(x.value, "TL")}` },
    grid: { left: 8, right: 16, top: 4, bottom: 56, containLabel: true },
    xAxis: { type: "value", ...eksenStil(p), axisLabel: { color: p.soluk, fontSize: 11, formatter: (v: number) => kisaSayi(v) } },
    yAxis: { type: "category", data: ["Varlıklar", "Yükümlülükler"], inverse: true, ...eksenStil(p), axisLine: { show: false }, axisLabel: { color: p.yazi, fontSize: 12, fontWeight: 600 } },
    series,
  };
}

export function aylikIkiliSecenek(p: Palet, aylik: { ay: string; satis: number; tahsilat: number }[]): EChartsCoreOption {
  return {
    ...temel(p),
    legend: { top: 0, textStyle: { color: p.soluk }, icon: "roundRect", itemWidth: 14, itemHeight: 8 },
    tooltip: { ...(temel(p).tooltip as object), trigger: "axis", valueFormatter: (v: number) => birimli(v, "TL") },
    grid: { left: 8, right: 8, top: 30, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: aylik.map((a) => kisaTarih(a.ay)), ...eksenStil(p), splitLine: { show: false } },
    yAxis: { type: "value", ...eksenStil(p), axisLabel: { color: p.soluk, fontSize: 11, formatter: (v: number) => kisaSayi(v) } },
    series: [
      { name: "Satış", type: "bar", data: aylik.map((a) => a.satis), itemStyle: { color: p.kategorik[0], borderRadius: [3, 3, 0, 0] }, barMaxWidth: 14 },
      { name: "Tahsilat", type: "bar", data: aylik.map((a) => a.tahsilat), itemStyle: { color: p.kategorik[3], borderRadius: [3, 3, 0, 0] }, barMaxWidth: 14 },
    ],
  };
}
