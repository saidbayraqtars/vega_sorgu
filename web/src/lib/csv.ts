// İstemci tarafı CSV: UTF-8 BOM + ";" ayraç (Türkçe Excel uyumlu).

export type CsvKolon = { ad: string; deger: (satir: Record<string, unknown>) => unknown };

function hucre(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (typeof v === "number") s = Number.isFinite(v) ? String(Math.round(v * 100) / 100).replace(".", ",") : "";
  else if (typeof v === "boolean") s = v ? "Evet" : "Hayır";
  else s = String(v);
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvMetni(kolonlar: CsvKolon[], satirlar: Record<string, unknown>[]): string {
  const baslik = kolonlar.map((k) => hucre(k.ad)).join(";");
  const govde = satirlar.map((s) => kolonlar.map((k) => hucre(k.deger(s))).join(";"));
  return "﻿" + [baslik, ...govde].join("\r\n");
}

export function csvIndir(dosyaAdi: string, kolonlar: CsvKolon[], satirlar: Record<string, unknown>[]) {
  const blob = new Blob([csvMetni(kolonlar, satirlar)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = dosyaAdi.replace(/[\\/:*?"<>|]+/g, "_") + ".csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
