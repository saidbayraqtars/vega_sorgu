// Her sonuç türünü tablo biçimine çevirir (tablo görünümü + CSV indirme ortak kullanır).
import { olcutDegeri } from "../../lib/bicim";
import type { Kolon, Sonuc } from "../../lib/types";

export type TabloVeri = { kolonlar: Kolon[]; satirlar: Record<string, unknown>[]; toplam?: Record<string, number> | null; boyutId?: string };

export function birimTipi(birim: string | undefined): Kolon["tip"] {
  if (birim === "TL") return "tl";
  if (birim === "%") return "yuzdeSayi";
  return "sayi";
}

export function tabloyaDonustur(s: Sonuc, birimVarsayilan?: string): TabloVeri | null {
  const birim = (s as { birim?: string }).birim || birimVarsayilan;
  const vt = birimTipi(birim);
  switch (s.tur) {
    case "tablo":
      return { kolonlar: s.kolonlar, satirlar: s.satirlar, toplam: s.toplam };
    case "kpi": {
      const satirlar = [
        { ad: "Bu dönem", v: s.deger },
        { ad: s.karsilastirma?.onceki?.ad || "Önceki dönem", v: s.onceki },
        { ad: s.karsilastirma?.gecenYil?.ad || "Geçen yıl", v: s.gecenYil },
      ];
      return { kolonlar: [{ id: "ad", ad: "Dönem", tip: "metin" }, { id: "v", ad: "Değer", tip: vt }], satirlar };
    }
    case "seri": {
      const ana = s.seriler[0];
      if (!ana) return { kolonlar: [], satirlar: [] };
      const kolonlar: Kolon[] = [{ id: "ad", ad: "Dönem", tip: "metin" }, ...s.seriler.map((x) => ({ id: `s_${x.id}`, ad: x.ad, tip: vt }))];
      const satirlar = ana.veri.map((d, i) => {
        const r: Record<string, unknown> = { ad: d.ad };
        for (const x of s.seriler) r[`s_${x.id}`] = x.veri[i]?.v ?? null;
        return r;
      });
      return { kolonlar, satirlar };
    }
    case "kategori": {
      const ornek = s.satirlar[0] || {};
      const kolonlar: Kolon[] = [{ id: "ad", ad: s.boyut?.ad || "Ad", tip: "metin" }, { id: "v", ad: "Değer", tip: vt }];
      if ("onceki" in ornek) kolonlar.push({ id: "onceki", ad: "Önceki", tip: vt }, { id: "fark", ad: "Fark", tip: vt }, { id: "degisim", ad: "Değişim", tip: "yuzde" });
      if ("pay" in ornek) kolonlar.push({ id: "pay", ad: "Pay", tip: "yuzde" });
      if ("kum" in ornek) kolonlar.push({ id: "kum", ad: "Kümülatif", tip: "yuzde" });
      if ("sinif" in ornek) kolonlar.push({ id: "sinif", ad: "Sınıf", tip: "etiket" });
      if ("ciro" in ornek) kolonlar.push({ id: "ciro", ad: "Ciro", tip: "tl" });
      if ("aciklama" in ornek) kolonlar.push({ id: "aciklama", ad: "Açıklama", tip: "metin" });
      const satirlar: Record<string, unknown>[] = [...s.satirlar];
      if (s.diger && s.diger.v) satirlar.push(s.diger);
      const toplam = typeof s.toplam === "number" ? { v: s.toplam } : null;
      return { kolonlar, satirlar, toplam, boyutId: s.boyut?.id };
    }
    case "matris": {
      const kolonlar: Kolon[] = [{ id: "ad", ad: "", tip: "metin" }, ...s.x.map((x, i) => ({ id: `x${i}`, ad: x.ad, tip: vt }))];
      const satirlar = s.y.map((y) => ({ ad: y.ad }) as Record<string, unknown>);
      for (const [xi, yi, v] of s.hucreler) if (satirlar[yi]) satirlar[yi][`x${xi}`] = v;
      return { kolonlar, satirlar };
    }
    case "projeksiyon":
      return {
        kolonlar: [
          { id: "t", ad: "Tarih", tip: "tarih" }, { id: "kesin", ad: "Kesin", tip: "tl" }, { id: "beklenen", ad: "Beklenen", tip: "tl" },
          { id: "giris", ad: "Giriş", tip: "tl" }, { id: "cikis", ad: "Çıkış", tip: "tl" },
        ],
        satirlar: s.seri,
      };
    case "durum": {
      const ad: Record<string, string> = { kasa: "Kasa", banka: "Banka", doviz: "Döviz", alacak: "Alacak", cekSenet: "Çek/senet", stok: "Stok", borc: "Borç", kredi: "Kredi", kasaAcik: "Kasa açığı", toplam: "Toplam" };
      const satirlar = [
        ...Object.entries(s.varliklar || {}).map(([k, v]) => ({ grup: "Varlık", ad: ad[k] || k, v })),
        ...Object.entries(s.yukumlulukler || {}).map(([k, v]) => ({ grup: "Yükümlülük", ad: k === "cekSenet" ? "Verilen çek/senet" : ad[k] || k, v })),
        { grup: "Sonuç", ad: "Net işletme sermayesi", v: s.netIsletmeSermayesi },
      ];
      return { kolonlar: [{ id: "grup", ad: "Grup", tip: "etiket" }, { id: "ad", ad: "Kalem", tip: "metin" }, { id: "v", ad: "Tutar", tip: "tl" }], satirlar };
    }
    case "saglik":
      return {
        kolonlar: [{ id: "sutun", ad: "Sütun", tip: "etiket" }, { id: "ad", ad: "Ölçüt", tip: "metin" }, { id: "deger", ad: "Değer", tip: "metin" }, { id: "skor", ad: "Skor", tip: "sayi" }, { id: "aciklama", ad: "Açıklama", tip: "metin" }],
        satirlar: s.sutunlar.flatMap((c) => c.olcutler.map((o) => ({ sutun: c.ad, ad: o.ad, deger: olcutDegeri(o), skor: o.skor, aciklama: o.aciklama }))),
      };
    case "buyume": {
      const ad: Record<string, string> = { ay: "Bu ay (geçen yıl)", ayOnceki: "Bu ay (önceki ay)", yil: "Yıl başından", ttm: "Son 12 ay", son90: "Son 90 gün" };
      const satirlar = Object.entries(s.detay || {})
        .filter(([k, v]) => k in ad && v && typeof v === "object")
        .map(([k, v]) => ({ ad: ad[k], ...(v as object) }));
      return {
        kolonlar: [{ id: "ad", ad: "Dönem", tip: "metin" }, { id: "simdi", ad: "Şimdi", tip: "tl" }, { id: "onceki", ad: "Önceki", tip: "tl" }, { id: "yuzde", ad: "Değişim", tip: "yuzde" }],
        satirlar,
      };
    }
    case "coklu":
      return null;
  }
}
