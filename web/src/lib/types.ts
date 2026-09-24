// API sözleşmesi tipleri (docs/API.md v2)

export type Rol = "super" | "admin" | "user";
export type Tema = "acik" | "koyu" | "sistem";

export type FirmaKisa = { id: number; kod: string; ad: string };

export type Tercihler = { tema?: Tema; donem?: string; firmalar?: string[]; anaPano?: number };

export type Kullanici = {
  id: number;
  kullanici: string;
  ad: string;
  rol: Rol;
  tercihler: Tercihler;
  firma: FirmaKisa | null;
  gorunenFirma: FirmaKisa | null;
};

export type KopruDurumKodu = "guncel" | "gecikmeli" | "kopuk" | "bekleniyor" | "yok" | "demo";

export type KopruDurumu = {
  durum: KopruDurumKodu;
  sonEsitleme: string | null;
  sonGorulme: string | null;
  dakika: number | null;
  aralikDk: number;
  anahtarSayisi: number;
};

export type ArctosFirma = { kod: string; ad: string; unvan?: string; aktif: boolean };
export type DonemTanimi = { kod: string; ad: string; ikon: string };
export type Kategori = { id: string; ad: string; ikon: string; renk: string };

export type Meta = {
  firma: FirmaKisa;
  bugun: string;
  firmalar: ArctosFirma[];
  donemler: DonemTanimi[];
  kirilimlar: { kod: string; ad: string }[];
  kategoriler: Kategori[];
  raporSayisi: number;
  veriSurumu: number;
  kopru: KopruDurumu;
  ayarlar: { enflasyon: number | null; sektor: string; syncDakika: number };
  rol: Rol;
};

export type Surum = { veriSurumu: number; esitleniyor: boolean; bekleyenIstek: boolean; kopru: KopruDurumu };

export type Renk = "iyi" | "orta" | "zayif" | "kritik" | "notr";
export type Iyi = "yukari" | "asagi" | "notr";

export type Olcut = {
  id: string;
  ad: string;
  ikon: string;
  deger: number | null;
  birim: string;
  skor: number | null;
  aciklama: string;
  ideal: string;
  sutun?: string;
  sutunAd?: string;
};

export type SaglikSutun = {
  id: string;
  ad: string;
  ikon: string;
  agirlik: number;
  skor: number | null;
  not: string | null;
  etiket: string;
  renk: Renk | string;
  kapsam: number;
  olcutler: Olcut[];
};

export type Saglik = {
  skor: number | null;
  not: string | null;
  etiket: string;
  renk: Renk | string;
  sutunlar: SaglikSutun[];
  olumlu: Olcut[];
  olumsuz: Olcut[];
  guven: "yuksek" | "orta" | "dusuk" | "yok";
  kapsam: number;
};

export type Karsi = { bas: string; bit: string; simdi: number; onceki: number; yuzde: number | null };

export type Buyume = {
  ufuk: string | null;
  ufukAd: string;
  yuzde: number | null;
  reel: number | null;
  enflasyon: number | null;
  bilesenler: { id: string; ad: string; ikon: string; agirlik: number; simdi: number; onceki: number; yuzde: number | null }[];
  ivme: { deger: number; durum: "hizlaniyor" | "yavasliyor" | "dengeli" } | null;
  detay?: Partial<Record<"ay" | "ayOnceki" | "yil" | "ttm" | "son90", Karsi>> & { trend?: number | null };
  tahmin: { yontem: string; aylar: { k: string; deger: number; alt: number; ust: number }[] } | null;
  yilSonu?: { deger: number; gecenYil: number; yuzde: number | null };
  guven: string;
};

export type Uyari = {
  id: string;
  seviye: "kritik" | "uyari" | "bilgi";
  ikon: string;
  baslik: string;
  mesaj: string;
  deger?: number;
  rapor: string | null;
};

export type BuAyKalem = { simdi: number; gecenYil: number; onceki: number; yoy: number | null; pop: number | null };

export type ProjeksiyonNokta = { t: string; kesin: number; beklenen: number; giris?: number; cikis?: number };

export type Projeksiyon = {
  baslangic: number;
  gun: number;
  minKesin: { tarih: string; deger: number } | null;
  minBeklenen: { tarih: string; deger: number } | null;
  ilkAcikTarih: string | null;
  son: { kesin: number; beklenen: number };
  vadesiGecenAlinan?: number;
  gunlukTahsilat?: number;
  gunlukOdeme?: number;
  seri: ProjeksiyonNokta[];
};

export type DovizMap = Record<string, number>;

export type FinansDurum = {
  kasa: number;
  kasaDoviz?: DovizMap;
  banka: number;
  bankaVarlik: number;
  bankaKredi: number;
  bankaDoviz?: DovizMap;
  doviz?: DovizMap;
  dovizTL: number | null;
  likit: number;
  netNakit: number;
  alacak: number;
  borc: number;
  musteriSayisi: number;
  tedarikciSayisi: number;
  cekAlinan: number;
  cekAlinanAdet: number;
  cekVerilen: number;
  cekVerilenAdet: number;
  senetAlinan: number;
  senetVerilen: number;
  stok: number;
  stokVar: boolean;
  varliklar: Record<string, number>;
  yukumlulukler: Record<string, number>;
  netIsletmeSermayesi: number;
  oranlar: { cari: number | null; asitTest: number | null; nakit: number | null };
};

export type DurumYanit = {
  tarih: string;
  firmalar: { kod: string; ad: string }[];
  saglik: Saglik;
  buyume: Buyume;
  durum: FinansDurum;
  oranlar: Record<string, number | null>;
  buAy: Record<"satis" | "tahsilat" | "kar" | "siparis", BuAyKalem>;
  bugun: { satis: number; tahsilat: number; kasaNet: number; fatura: number };
  spark: number[];
  projeksiyon: Projeksiyon;
  uyarilar: Uyari[];
  uyariOzet: { kritik: number; uyari: number; bilgi: number };
  kopru: KopruDurumu;
  veriSurumu: number;
  kurlar: unknown;
};

export type SonucTuru = "kpi" | "seri" | "kategori" | "matris" | "tablo" | "coklu" | "saglik" | "buyume" | "durum" | "projeksiyon";
export type GrafikTuru =
  | "sayi" | "cizgi" | "alan" | "sutun" | "cubuk" | "pasta" | "agac" | "isi" | "pareto" | "karsilastir"
  | "tablo" | "gosterge" | "buyume" | "bilanco" | "coklu";

export type Gorunum =
  | "kpi" | "trend" | "yoy" | "kumulatif" | "isi" | "mevsim" | "top" | "pay" | "karsilastir" | "pareto" | "dagilim" | "ozel";

export type RaporTanimi = {
  id: string;
  ad: string;
  kisa: string;
  ikon: string;
  kategori: string;
  tur: SonucTuru;
  grafik: GrafikTuru;
  grafikler: GrafikTuru[];
  donem: string;
  birim: string;
  aciklama: string;
  olcu: string | null;
  boyut: string | null;
  gorunum: Gorunum;
  parametreler: { donem: boolean; n?: boolean; kirilim?: boolean };
};

export type Katalog = { kategoriler: Kategori[]; raporlar: RaporTanimi[] };

export type SeriNokta = { k: string | number; ad: string; v: number | null; devam?: boolean };
export type Seri = { id: string; ad: string; veri: SeriNokta[]; kesikli?: boolean; bant?: boolean };

export type KategoriSatir = {
  k: string | number;
  ad: string;
  v: number;
  pay?: number;
  onceki?: number;
  fark?: number;
  degisim?: number | null;
  kum?: number;
  sinif?: "A" | "B" | "C";
  ikon?: string;
  aciklama?: string;
  [x: string]: unknown;
};

export type Kolon = { id: string; ad: string; tip: "metin" | "sayi" | "tl" | "yuzde" | "yuzdeSayi" | "tarih" | "etiket" | string };

export type Sonuc =
  | ({ tur: "kpi"; birim: string; iyi?: Iyi; deger: number | null; onceki: number | null; gecenYil: number | null;
      degisim?: { onceki: number | null; gecenYil: number | null; tip: "oran" | "puan" };
      karsilastirma?: Record<string, { ad: string; bas: string; bit: string }>;
      seri?: SeriNokta[] } & Ortak)
  | ({ tur: "seri"; birim: string; kirilim?: string; seriler: Seri[]; toplam?: number; oncekiToplam?: number; degisim?: number | null; yontem?: string } & Ortak)
  | ({ tur: "kategori"; birim: string; boyut?: { id: string; ad: string }; satirlar: KategoriSatir[]; diger?: KategoriSatir | null;
      toplam?: number; adet?: number; sirali?: boolean; karsilastirma?: { ad: string; bas: string; bit: string };
      artan?: number; azalan?: number; abc?: Record<"A" | "B" | "C", { adet: number; v: number }>; doviz?: DovizMap } & Ortak)
  | ({ tur: "matris"; birim: string; x: { k: unknown; ad: string }[]; y: { k: unknown; ad: string }[]; hucreler: [number, number, number | null][] } & Ortak)
  | ({ tur: "tablo"; kolonlar: Kolon[]; satirlar: Record<string, unknown>[]; toplam?: Record<string, number> | null } & Ortak)
  | ({ tur: "coklu"; parcalar: (Sonuc & { grafik?: GrafikTuru })[] } & Ortak)
  | ({ tur: "saglik" } & Saglik & Ortak)
  | ({ tur: "buyume" } & Buyume & Ortak)
  | ({ tur: "durum" } & DurumSonuc & Ortak)
  | ({ tur: "projeksiyon" } & Projeksiyon & Ortak);

type Ortak = { baslik?: string; not?: string | null; grafik?: GrafikTuru; iyi?: Iyi; birim?: string };

export type DurumSonuc = {
  kasa?: { tl: number; doviz?: DovizMap };
  banka?: { tl: number; varlik: number; kredi: number; doviz?: DovizMap };
  cari?: { alacak: number; borc: number; net: number; musteri: number; tedarikci: number };
  portfoy?: unknown;
  stok?: { deger: number; veriVar: boolean };
  varliklar: Record<string, number>;
  yukumlulukler: Record<string, number>;
  netIsletmeSermayesi: number;
  likit: number;
  netNakit: number;
  oranlar: { cari: number | null; asitTest: number | null; nakit: number | null };
  doviz?: DovizMap;
  dovizTL?: number | null;
};

export type RaporYanit = {
  rapor: { id: string; ad: string; kisa: string; ikon: string; kategori: string; birim: string; iyi?: Iyi; aciklama: string; grafik: GrafikTuru; grafikler: GrafikTuru[] };
  donem: { kod: string; ad: string; bas: string; bit: string; gun: number };
  sonuc: Sonuc;
  veriSurumu: number;
};

export type Boyut = "s" | "m" | "l";

export type Kutu = {
  id: string;
  rapor: string;
  boyut: Boyut;
  grafik?: GrafikTuru;
  donem?: string;
  bas?: string;
  bit?: string;
  kirilim?: string;
  n?: number;
  baslik?: string;
};

export type Pano = { id: number; ad: string; ikon: string; sira: number; widgets: Kutu[] };

export type RaporParam = { donem?: string; bas?: string; bit?: string; n?: number; kirilim?: string };
