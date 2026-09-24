# Vega Bulut — HTTP API Sözleşmesi (v2)

Arayüz (web) ile bulut sunucusu (`cloud/`) arasındaki sözleşme. Tüm uçlar `/api` altında, gövdeler JSON'dur.

- **Kimlik:** `POST /api/auth/giris` başarılı olunca `vb_oturum` adlı **httpOnly** çerez yazılır. Sonraki tüm isteklerde tarayıcı çerezi otomatik yollar (`fetch(..., { credentials: "same-origin" })`).
- **Hata biçimi:** HTTP durum kodu + `{ "hata": "Türkçe açıklama" }`. `401` → oturum yok/bitmiş (giriş ekranına dön), `403` → yetki yok, `409` → sistem yöneticisi henüz firma seçmemiş.
- **Değiştiren istekler** (POST/PUT/DELETE) aynı kökten gelmeli (`Origin` = sunucu); `Content-Type: application/json`.
- **Sayılar** ham JS sayısıdır (TL, adet, oran). Oranlar/yüzdeler aksi belirtilmedikçe **kesir**dir (0.25 = %25).
  Bir değerin yanında **`birim`** alanı varsa (rapor sonuçları, sağlık ölçütleri) kural tektir:
  `"%"` → değer zaten yüzdedir (25.3 = %25,3) · `"puan"` → yüzde puanıdır (−9.3 = −9,3 puan) · `"x"` → kat · `"gün"` → gün · `"TL"`, `"adet"`.
- **Tarihler** `"YYYY-MM-DD"` metnidir (Türkiye saati). Zaman damgaları ISO 8601.
- **Firma seçimi:** veri uçları `?firma=0101,0103` kabul eder (4 haneli firma kodları). Verilmezse son 400 günde hareketi olan firmalar (etkin firmalar) birlikte (konsolide) hesaplanır. `?firma=hepsi` → kapanmış firmalar dahil hepsi.
- **Dönem:** rapor uçları `?donem=<kod>` alır; `ozel` için ayrıca `&bas=YYYY-MM-DD&bit=YYYY-MM-DD`.

Dönem kodları: `bugun, dun, bu_hafta, gecen_hafta, bu_ay, gecen_ay, son30, son90, bu_ceyrek, bu_yil, gecen_yil, son12, tumu, ozel`
Kırılım kodları: `gun, hafta, ay, ceyrek, yil`

---

## 1. Oturum

| Uç | Gövde / Parametre | Yanıt |
|---|---|---|
| `POST /api/auth/giris` | `{ kullanici, sifre }` | `{ kullanici: Kullanici }` (+ çerez). Hatalı → 401, çok deneme → 429 |
| `POST /api/auth/cikis` | — | `{ tamam: true }` |
| `GET /api/auth/ben` | — | `{ kullanici: Kullanici }` veya 401 |
| `POST /api/auth/sifre` | `{ eski, yeni }` | `{ tamam: true }` |
| `PUT /api/auth/tercihler` | `Tercihler` (yalnız gönderilen alanlar değişir; geçersiz değerler yok sayılır) | `{ tercihler }` |

```ts
type Kullanici = {
  id: number; kullanici: string; ad: string;
  rol: "super" | "admin" | "user";        // super = sistem yöneticisi, admin = firma yöneticisi, user = izleyici
  tercihler: Tercihler;
  firma: { id: number; kod: string; ad: string } | null;          // kullanıcının bağlı olduğu kiracı
  gorunenFirma: { id: number; kod: string; ad: string } | null;   // super için seçili kiracı
};
type Tercihler = {
  tema?: "acik" | "koyu" | "sistem";
  donem?: string;                        // hazır dönem kodu ya da "ozel"
  donemBas?: string | null;              // "ozel" için YYYY-AA-GG (null → temizle)
  donemBit?: string | null;
  firmalar?: string[];                   // 4 haneli kodlar · ["hepsi"] = kapanmış firmalar dahil tümü · [] = etkin firmalar
  anaPano?: number;
};
```

## 2. Açılış ve tazelik

`GET /api/meta` — açılışta bir kez:
```jsonc
{
  "firma": { "id": 1, "kod": "demo", "ad": "Demo Ticaret A.Ş." },   // kiracı (müşteri hesabı)
  "bugun": "2026-09-24",
  "firmalar": [ { "kod": "0101", "ad": "DEMO MERKEZ", "unvan": "...", "aktif": true } ],  // Arctos firmaları
  "donemler": [ { "kod": "bu_ay", "ad": "Bu ay", "ikon": "Calendar" }, ... ],
  "kirilimlar": [ { "kod": "ay", "ad": "Ay" }, ... ],
  "kategoriler": [ { "id": "satis", "ad": "Satış", "ikon": "ShoppingCart", "renk": "blue" }, ... ],
  "raporSayisi": 1085,
  "veriSurumu": 12,
  "kopru": KopruDurumu,
  "ayarlar": { "enflasyon": 25, "sektor": "toptan", "syncDakika": 15 },
  "rol": "admin"
}
```

```ts
type KopruDurumu = {
  durum: "guncel" | "gecikmeli" | "kopuk" | "bekleniyor" | "yok" | "demo";
  sonEsitleme: string | null;   // ISO
  sonGorulme: string | null;    // köprünün son yoklaması
  dakika: number | null;        // son eşitlemeden bu yana
  aralikDk: number;             // eşitleme aralığı (varsayılan 15)
  anahtarSayisi: number;
};
```

`GET /api/surum[?firma=]` — **60 sn'de bir yoklayın**; `veriSurumu` değişince ekrandaki verileri yeniden çekin (sürüm yalnız eşitleme gerçekten veri değiştirdiğinde artar; son eşitleme zamanı için `kopru.sonEsitleme` kullanın):
`{ veriSurumu: number, esitleniyor: boolean, bekleyenIstek: boolean, kopru: KopruDurumu, uyariOzet: { kritik, uyari, bilgi } }`
— `uyariOzet` uyarı rozeti içindir (önbellekten gelir, ucuzdur); `firma` parametresini diğer isteklerle aynı gönderin.

`POST /api/guncelle` — "Şimdi güncelle" düğmesi. Köprü ≤ 60 sn içinde eşitler. `{ tamam, mesaj }`

## 3. Durum (ana ekran)

`GET /api/durum[?firma=...]` — tek çağrıda ana ekranın tamamı:

```jsonc
{
  "tarih": "2026-09-24",
  "firmalar": [ { "kod": "0101", "ad": "DEMO MERKEZ" } ],        // hesaba katılan firmalar
  "saglik": Saglik,
  "buyume": Buyume,
  "durum": {                                   // anlık finansal durum (TL)
    "kasa": 258583, "kasaDoviz": { "EUR": 35383 },               // döviz kendi biriminde
    "banka": 14545440, "bankaVarlik": 19931311, "bankaKredi": 5385871, "bankaDoviz": { "EUR": 126425 },
    "doviz": { "EUR": 160437 }, "dovizTL": null,                  // TCMB kuru varsa TL karşılığı
    "likit": 20332209,                         // kasa + artı banka bakiyeleri (+ döviz TL)
    "netNakit": 14946339,                      // kasa + banka (kredi dahil net)
    "alacak": 39470402, "borc": 21083373, "musteriSayisi": 243, "tedarikciSayisi": 64,
    "cekAlinan": 9872454, "cekAlinanAdet": 431, "cekVerilen": 8123000, "cekVerilenAdet": 150,
    "senetAlinan": 4691733, "senetVerilen": 743527,
    "stok": 20132077, "stokVar": true,
    "varliklar": { "kasa": 0, "banka": 0, "doviz": 0, "alacak": 0, "cekSenet": 0, "stok": 0, "toplam": 0 },
    "yukumlulukler": { "borc": 0, "cekSenet": 0, "kredi": 0, "kasaAcik": 0, "toplam": 0 },
    "netIsletmeSermayesi": 27411969,
    "oranlar": { "cari": 1.34, "asitTest": 1.09, "nakit": 0.25 }
  },
  "oranlar": { "dso": 71.8, "dpo": 56.9, "dio": 61.5, "ccc": 76.3, "nakitGun": 41.2,   // gün
               "tahsilatOrani90": 101.1, "marj": 29.96,                                  // yüzde (%)
               "marjTrend": 0.4,                                                          // yüzde puanı
               "ilk5Pay": 0.19, "vadesiGecenOran": 0.37,                                  // kesir
               "kaldirac": 0.21 },                                                        // kat
  "buAy": {                                    // ay başından bugüne
    "satis":    { "simdi": 0, "gecenYil": 0, "onceki": 0, "yoy": 0.16, "pop": 0.27 },
    "tahsilat": { ... }, "kar": { ... }, "siparis": { ... }
  },
  "bugun": { "satis": 0, "tahsilat": 0, "kasaNet": 0, "fatura": 0 },
  "spark": [ /* son 30 günün günlük net cirosu, 30 sayı */ ],
  "projeksiyon": {
    "baslangic": 20332209, "gun": 90,
    "minKesin": { "tarih": "2026-10-02", "deger": 18000000 }, "minBeklenen": { ... },
    "ilkAcikTarih": null,                      // nakit eksiye düşerse ilk tarih
    "son": { "kesin": 17351076, "beklenen": 20378039 },
    "vadesiGecenAlinan": 1074298,
    "seri": [ { "t": "2026-09-24", "kesin": 20332209, "beklenen": 20332209 }, ... ]   // 3 günde bir
  },
  "uyarilar": [ Uyari ], "uyariOzet": { "kritik": 1, "uyari": 4, "bilgi": 2 },
  "kopru": KopruDurumu, "veriSurumu": 12, "kurlar": null
}
```

```ts
type Saglik = {
  skor: number | null;            // 0-100
  not: "A" | "B" | "C" | "D" | "E" | null;
  etiket: string;                 // "Çok iyi" | "İyi" | "Orta" | "Zayıf" | "Kritik" | "Yetersiz veri"
  renk: "iyi" | "orta" | "zayif" | "kritik" | "notr";
  sutunlar: Array<{               // 5 sütun
    id: "likidite" | "karlilik" | "buyume" | "dongu" | "risk"; ad: string; ikon: string; agirlik: number;
    skor: number | null; not: string | null; etiket: string; renk: string; kapsam: number;
    olcutler: Array<{ id: string; ad: string; ikon: string;
                      deger: number | null; birim: "%" | "puan" | "x" | "gün";   // % → 29.96 · puan → −9.3 (genel birim kuralı)
                      skor: number | null; aciklama: string; ideal: string }>;
  }>;
  olumlu: Olcut[]; olumsuz: Olcut[];       // en etkili 4'er ölçüt ("neden bu skor?")
  guven: "yuksek" | "orta" | "dusuk" | "yok"; kapsam: number;
};

type Buyume = {
  ufuk: "ttm" | "ytd" | "3a" | null;   // hangi karşılaştırma kullanıldı
  ufukAd: string;                       // "Son 12 ay, önceki 12 aya göre"
  yuzde: number | null;                 // BİRLEŞİK büyüme (kesir) — manşet rakam
  reel: number | null;                  // enflasyondan arındırılmış
  enflasyon: number | null;             // ayarlardaki yıllık TÜFE %
  bilesenler: Array<{ id: "ciro" | "kar" | "tahsilat" | "musteri"; ad: string; ikon: string; agirlik: number;
                      simdi: number; onceki: number; yuzde: number | null }>;
  ivme: { deger: number; durum: "hizlaniyor" | "yavasliyor" | "dengeli" } | null;   // deger kesir: −0.093 = −9,3 puan
  detay: { ay: Karsi, ayOnceki: Karsi, yil: Karsi, ttm: Karsi, son90: Karsi, trend: number | null };
  tahmin: { yontem: string; aylar: Array<{ k: "YYYY-MM"; deger: number; alt: number; ust: number }> } | null;
  yilSonu?: { deger: number; gecenYil: number; yuzde: number | null };
  guven: "yuksek" | "orta" | "dusuk";
};
type Karsi = { bas: string; bit: string; simdi: number; onceki: number; yuzde: number | null };

type Uyari = {
  id: string; seviye: "kritik" | "uyari" | "bilgi"; ikon: string;   // ikon: lucide adı
  baslik: string; mesaj: string; deger?: number;
  rapor: string | null;            // tıklanınca açılacak rapor id'si
};
```

`GET /api/uyarilar[?firma=]` → `{ uyarilar: Uyari[], ozet: { kritik, uyari, bilgi } }`

"Veriler güncel değil" (`id: "veri_eski"`; 60 dk'dan eski eşitleme → uyari, 3 saatten eski → kritik) her istekte güncel
hesaplanır: köprü sustuğunda veri sürümü değişmediği hâlde `/uyarilar`, `/durum` ve `/surum.uyariOzet`'te görünür.
Demo firmalarda üretilmez.

## 4. Rapor kataloğu ve çalıştırma

`GET /api/raporlar` → `{ kategoriler: Kategori[], raporlar: RaporTanimi[] }` (~1.085 rapor; arama/filtre istemcide)

```ts
type Kategori = { id: string; ad: string; ikon: string; renk: string };
type RaporTanimi = {
  id: string;                 // ör. "satis.top.cari", "net_ciro.trend.ay", "ozel.saglik"
  ad: string;                 // "Satış (KDV dahil) — Müşteri Sıralaması"
  kisa: string;               // "En iyi müşteri" (kutu başlığı için)
  ikon: string;               // lucide-react ikon adı (PascalCase)
  kategori: string;           // Kategori.id
  tur: SonucTuru;             // beklenen sonuç türü
  grafik: GrafikTuru;         // varsayılan grafik
  grafikler: GrafikTuru[];    // kullanıcının seçebileceği grafikler
  donem: string;              // varsayılan dönem kodu
  birim: "TL" | "adet" | "%" | "gün" | "x";
  iyi: "yukari" | "asagi" | "notr";   // artış iyi mi? (değişim renkleri)
  aciklama: string;
  olcu: string | null; boyut: string | null;
  gorunum: "kpi"|"trend"|"yoy"|"kumulatif"|"isi"|"mevsim"|"top"|"pay"|"karsilastir"|"pareto"|"dagilim"|"ozel";
  parametreler: {                       // hangi seçiciler gösterilecek (yalnız işe yarayanlar true)
    donem: boolean;                     // false → rapor dönem kullanmaz (anlık bakiye / sabit pencere); yanıtta donem: null
    kirilim: boolean;                   // gün/hafta/ay/çeyrek/yıl seçilebilir
    n: boolean;                         // "ilk N" satır seçilebilir
    nVarsayilan: number | null;         // n gönderilmezse uygulanan (ör. sıralama 10, pareto 30, tablolar 100)
    nSecenekler: number[] | null;       // seçicide gösterilecek değerler (ör. [5,10,20,50] · [25,50,100,250,500])
  };
};
type SonucTuru = "kpi" | "seri" | "kategori" | "matris" | "tablo" | "coklu" | "saglik" | "buyume" | "durum" | "projeksiyon";
type GrafikTuru = "sayi" | "cizgi" | "alan" | "sutun" | "cubuk" | "pasta" | "agac" | "isi" | "pareto" | "karsilastir"
                | "tablo" | "gosterge" | "buyume" | "bilanco" | "coklu";
```

`GET /api/rapor/:id?donem=&bas=&bit=&n=&kirilim=&firma=` →

```jsonc
{
  "rapor": { "id", "ad", "kisa", "ikon", "kategori", "birim", "iyi", "aciklama", "grafik", "grafikler" },
  "donem": { "kod": "son12", "ad": "Son 12 ay", "bas": "2025-09-01", "bit": "2026-09-24", "gun": 389 },   // dönemsiz raporda null
  "n": 10,                                                // yalnız parametreler.n raporlarında: uygulanan satır sayısı
  "sonuc": Sonuc,
  "veriSurumu": 12
}
```
`iyi`: `"yukari"` (artış iyi, yeşil) · `"asagi"` (azalış iyi — ör. iade, kasa çıkışı) · `"notr"`.

### Sonuç türleri

**kpi** — tek sayı + karşılaştırma + mini grafik
```json
{ "tur": "kpi", "birim": "TL", "iyi": "yukari", "deger": 15348909.66, "onceki": 12038539.84, "gecenYil": 13180786.49,
  "degisim": { "onceki": 0.27, "gecenYil": 0.16, "tip": "oran" },
  "karsilastirma": { "onceki": { "ad": "Önceki dönem", "bas": "...", "bit": "..." }, "gecenYil": { ... } },
  "seri": [ { "k": "2026-09-01", "ad": "1 Eyl", "v": 771275.26 } ] }
```
`degisim.tip = "puan"` ise (birim `%`) değişim yüzde puandır (2.1 = +2,1 puan), aksi hâlde kesirdir.

**seri** — zaman serisi (bir veya birden çok çizgi)
```json
{ "tur": "seri", "birim": "TL", "kirilim": "ay",
  "seriler": [ { "id": "simdi", "ad": "Son 12 ay", "veri": [ { "k": "2025-09", "ad": "Eyl 2025", "v": 15621888.58, "devam": true } ] },
               { "id": "gecenYil", "ad": "Geçen yıl", "kesikli": true, "veri": [ ... ] } ],
  "toplam": 200374722.25, "oncekiToplam": 180000000, "degisim": 0.11, "not": null }
```
- `devam: true` → kova henüz bitmedi (bu ay); soluk/çizgili göster.
- `kesikli: true` → kesikli çizgi (geçen yıl / tahmin). `bant: true` → güven aralığı sınırı (alt/üst, alan olarak).
- Değer `null` olabilir (veri yok) → boşluk.

**kategori** — boyut kırılımı (sıralama, pay, karşılaştırma, pareto, dağılım)
```json
{ "tur": "kategori", "birim": "TL", "boyut": { "id": "cari", "ad": "Müşteri" },
  "satirlar": [ { "k": "0101:215", "ad": "NEHİR ENERJİ MARKET", "v": 7332497.17, "pay": 0.05 } ],
  "diger": { "k": "__diger", "ad": "Diğer (243)", "v": 119827659.98, "pay": 0.81 },
  "toplam": 147659200.48, "adet": 248 }
```
- **karsilastir** satırları ayrıca: `onceki, fark, degisim` (+ kök: `karsilastirma` dönemi, `artan`, `azalan`). Grafik: sıfır ekseninde artı/eksi çubuklar.
- **pareto** satırları ayrıca: `kum` (kümülatif pay), `sinif` (`A|B|C`) + kök: `abc: { A: { adet, v }, B, C }`.
- `sirali: true` → satırları sırasıyla (haftanın günü, ay, saat) dikey sütun olarak çizin.
- `boyut.id === "cari"` ise `k` = `"<firma>:<cariId>"` → tıklanınca `GET /api/cari/<k>`.

**matris** — ısı haritası
```json
{ "tur": "matris", "birim": "TL", "x": [ { "k": "2026-06-22", "ad": "22 Haz haftası" } ], "y": [ { "k": 0, "ad": "Pzt" } ],
  "hucreler": [ [0, 5, 312869.89] ] }
```
`hucreler`: `[xIndex, yIndex, deger]`.

**tablo**
```json
{ "tur": "tablo", "kolonlar": [ { "id": "vade", "ad": "Vade", "tip": "tarih" }, { "id": "tutar", "ad": "Tutar", "tip": "tl" } ],
  "satirlar": [ { "vade": "2026-10-02", "tutar": 4804.81, "...": "..." } ], "toplam": { "tutar": 9872454.27 }, "baslik": "..." }
```
Kolon `tip`: `metin | sayi | tl | yuzde (kesir) | yuzdeSayi (zaten yüzde) | tarih | etiket (rozet)`.
"İlk N" uygulanan tablolarda `adet` = kısaltılmadan önceki toplam satır sayısı ("100 / 431 gösteriliyor"); `toplam` tüm satırların toplamıdır.
`n` sayısı rapordaki satır sayısıdır (çarpan yok); `n` 3–500 aralığına kırpılır.

**coklu** — birden çok parça (üstte grafik, altta tablo gibi)
```json
{ "tur": "coklu", "parcalar": [ { "baslik": "Vade dilimleri", "tur": "kategori", "grafik": "sutun", "...": "..." },
                                { "baslik": "Müşteri bazında", "tur": "tablo", "...": "..." } ] }
```

**saglik** → `{ tur: "saglik", ...Saglik }` · **buyume** → `{ tur: "buyume", ...Buyume }`
**durum** → `{ tur: "durum", kasa, banka, cari, portfoy, stok, varliklar, yukumlulukler, netIsletmeSermayesi, likit, netNakit, oranlar, doviz, dovizTL }`
**projeksiyon** → `{ tur: "projeksiyon", baslangic, gun, seri: [{ t, kesin, beklenen, giris, cikis }], minKesin, minBeklenen, ilkAcikTarih, vadesiGecenAlinan, gunlukTahsilat, gunlukOdeme, son }`

`GET /api/cari/:anahtar` (anahtar `"0101:215"`) → `{ kart, bakiye, sonHareket, hareketler: [{ tarih, izahat, islem, evrak, borc, alacak, vade }], aylik: [{ ay, satis, tahsilat }], urunler: [{ stok_id, ad, tutar, miktar }] }`

## 5. Panolar (özelleştirilebilir ekranlar)

| Uç | Gövde | Yanıt |
|---|---|---|
| `GET /api/panolar` | — | `{ panolar: Pano[] }` (ilk çağrıda 3 varsayılan pano oluşur) |
| `POST /api/panolar` | `{ ad, ikon, widgets }` | `{ id, panolar }` |
| `PUT /api/panolar/:id` | `{ ad?, ikon?, sira?, widgets? }` | `{ panolar }` |
| `DELETE /api/panolar/:id` | — | `{ panolar }` |
| `POST /api/panolar/sifirla` | — | varsayılan panolara dön |

```ts
type Pano = { id: number; ad: string; ikon: string; sira: number; widgets: Kutu[] };
type Kutu = {
  id: string;                 // istemci üretir (uuid)
  rapor: string;              // RaporTanimi.id
  boyut: "s" | "m" | "l";     // s: 1 sütun, m: 2 sütun, l: tam genişlik (4 sütunluk ızgarada)
  grafik?: GrafikTuru;        // rapor.grafikler içinden
  donem?: string; bas?: string; bit?: string;   // yoksa panonun/genel dönem seçicinin dönemi
  kirilim?: string; n?: number; baslik?: string;
};
```
Sunucu kutuları doğrular (bilinmeyen rapor / geçersiz grafik → 400). En fazla 12 pano, pano başına 60 kutu.

## 6. Firma yöneticisi (`rol: admin`)

| Uç | Açıklama |
|---|---|
| `GET /api/ayarlar` | `{ ayarlar, varsayilan, sektorler: [{kod, ad}] }` |
| `PUT /api/ayarlar` | `{ enflasyon?: number\|null, sektor?, syncDakika?, firmalar?: string[]\|null, izahat?: {SATIS:[21],...}, personelTipleri?: number[] }` |
| `GET /api/kullanicilar` | `{ kullanicilar: [{ id, kullanici, ad, rol, aktif, sonGiris, olusturma }] }` |
| `POST /api/kullanicilar` | `{ kullanici, sifre, ad, rol: "admin"\|"user" }` |
| `PUT /api/kullanicilar/:id` | `{ ad?, rol?, aktif?, sifre? }` |
| `DELETE /api/kullanicilar/:id` | — |
| `GET /api/kopru` | `{ durum: KopruDurumu, anahtarlar: [{id, etiket, created_at, last_seen, agent, revoked}], esitlemeler: [{sync_id, started_at, finished_at, status, chunks, rows, bytes, message}], olaylar: [{at, level, msg}], veri: {tablo: satır}, sunucu }` |
| `POST /api/kopru/anahtar` | `{ etiket }` → `{ anahtar: "vk_...", uyari }` (**yalnız bir kez gösterilir**) |
| `DELETE /api/kopru/anahtar/:id` | anahtarı iptal et |
| `POST /api/kopru/tam-esitleme` | köprü tüm veriyi yeniden gönderir |

## 7. Sistem yöneticisi (`rol: super`)

| Uç | Açıklama |
|---|---|
| `GET /api/yonetim/firmalar` | `{ firmalar: [{ id, kod, ad, aktif, olusturma, kopru, kullaniciSayisi, veriSurumu, satir, demo }] }` |
| `POST /api/yonetim/firmalar` | `{ kod, ad, yoneticiKullanici?, yoneticiSifre?, yoneticiAd?, demo?: boolean }` → `{ firma, yonetici, kopruAnahtari }` |
| `PUT /api/yonetim/firmalar/:id` | `{ ad?, aktif? }` |
| `DELETE /api/yonetim/firmalar/:id` | `{ onay: "<firma kodu>" }` |
| `POST /api/yonetim/firmalar/:id/demo` | demo verisini (yeniden) yükle |
| `POST /api/yonetim/gorunum` | `{ firmaId: number \| null }` → oturum o firmanın verisini görür |
| `GET/POST /api/yonetim/kullanicilar` | tüm kullanıcılar |

## 8. Köprü protokolü (arayüz kullanmaz)

`/api/kopru/v1/*` — `Authorization: Bearer vk_...`. Ayrıntı: [KOPRU.md](KOPRU.md).
