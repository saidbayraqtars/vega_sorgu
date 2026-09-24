# Görev: "Vega Bulut" web arayüzünü `web/` klasörüne sıfırdan yaz

Bu belgeyi eksiksiz oku; ardından `docs/API.md`'yi baştan sona oku. Arka uç (sunucu) hazır ve çalışıyor; senin işin **yalnızca ön yüz**.

## 1. Ürün ve kullanıcı

Vega Bulut, Türk KOBİ'lerinin kullandığı **Arctos / VegaWin (Vega ERP)** muhasebe-ticaret programının verisini müşterinin sunucusundan bir "köprü" programıyla 15 dakikada bir buluta (VPS) taşır ve işletme sahibine sade bir panel sunar. Kullanıcı: bilgisayarla arası çok iyi olmayan, telefondan da bakan firma sahibi / muhasebeci. Sahibin isteği aynen şu:

> "Arayüz aşırı basit olacak. Yazılar yerine net anlaşılabilir simgeler koyacağız. Grafikler özelleştirilebilir, istediğini ekrana getirebilecek. En önemlisi tüm verilere göre şirketin büyüme yüzdesini ve anlık finansal durumunu gösterecek."

Sunucu şunları zaten hesaplıyor: **Finansal Sağlık Skoru (0-100, A-E)**, **Büyüme Endeksi** (nominal + enflasyondan arındırılmış reel), **anlık finansal durum** (kasa, banka, alacak, borç, çek/senet, stok, net işletme sermayesi), **90 günlük nakit projeksiyonu**, **uyarılar** ve **~1.085 rapor** (katalog). Senin işin bunları çok sade, ikon ağırlıklı, özelleştirilebilir bir arayüzle göstermek.

## 2. Depo, dal, çalıştırma

- Depo: `github.com/saidbayraqtars/vega_sorgu` · dal: `claude/wonderful-volta-xvcbqw` (yeni bir dal açıp oraya da çalışabilirsin).
- Sunucu `cloud/` klasöründe (Node.js ≥ 22.13):
  ```bash
  cd cloud && npm install
  npm run demo      # demo firması + 3 yıllık örnek veri (~230 bin satır)
  npm start         # http://localhost:8080
  ```
  Kullanıcılar: `demo / demo123` (firma yöneticisi) · `izleyici / izleyici123` (salt izleyici) · `admin / admin123` (sistem yöneticisi).
- **Yalnız `web/` klasörüne yaz.** `cloud/`, `shared/`, `bridge/`, `docs/API.md` dosyalarını değiştirme. API'de eksik/hatalı bir şey görürsen `web/API-ISTEKLERI.md` dosyasına yaz.
- Derleme çıktısı `web/dist/` olmalı: sunucu `../web/dist`'i otomatik servis eder (SPA geri dönüşü dahil). Yani `npm run build` sonrası `http://localhost:8080` arayüzü açar.
- Geliştirme: Vite dev sunucusu `/api` isteklerini `http://localhost:8080`'e proxy'lesin. Her istek göreli `/api/...` yolu ve `credentials: "same-origin"` ile yapılmalı (oturum httpOnly çerezde).

## 3. Teknoloji (zorunlu / önerilen)

- **Vite + React 19**, TypeScript önerilir. **Tailwind CSS**. İkonlar: **lucide-react**. Grafikler: **Apache ECharts 6** (`echarts/core` ile yalnız kullanılan grafik türleri; grafik modülü **tembel yüklensin** — `import()`). Sürükle-bırak: `@dnd-kit` (veya eşdeğeri). Durum yönetimi için ekstra kütüphane şart değil (React context + hook'lar; istersen TanStack Query).
- Sunucunun **Content-Security-Policy**'si: `script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; img-src 'self' data: blob:`. Bu yüzden **CDN, Google Fonts, dış istek YOK**. Yazı tipini pakete göm (ör. `@fontsource-variable/inter`).
- Bütçe: ilk yükleme JS ≤ 250 KB (gzip); ECharts ayrı parça.

## 4. Tasarım ilkeleri (en önemli kısım)

1. **Önce ikon, sonra kelime.** Her menü, kutu, düğme büyük bir lucide ikonu taşır; metin 1-3 kelime. Uzun açıklamalar yalnız ipucu (tooltip) veya "?" açılır balonunda. Sunucu her rapor/kategori/uyarı için `ikon` alanında lucide adını verir (liste §9).
2. **Büyük rakam, az süs.** Kart başına tek ana rakam; ikincil bilgi küçük ve soluk.
3. **Renk anlamı tutarlı:** yeşil iyi, amber dikkat, kırmızı kötü, gri nötr. Değişim renklendirmesinde raporun `iyi` alanına uy (`yukari`: artış yeşil; `asagi`: artış kırmızı — ör. iade, kasa çıkışı; `notr`: gri). Sağlık/sütun renkleri `renk` alanından (`iyi|orta|zayif|kritik|notr`).
4. **Türkçe, resmi hitap ("siz").** Tüm metinler Türkçe.
5. **Mobil öncelikli:** telefonda alt sekme çubuğu (5 ikon: Durum, Panolar, Raporlar, Uyarılar, Ayarlar/Diğer); masaüstünde sol ikon rayı (üzerine gelince etiket). 360 px genişlikte her şey kullanılabilir; sayfa yatay kaymaz (tablolar kendi kartı içinde kayar).
6. **Açık + koyu tema** (varsayılan: sistem). Seçim `PUT /api/auth/tercihler { tema }` ile saklanır.
7. **Erişilebilirlik:** yalnız ikon olan her düğmede `aria-label` + `title`; klavye odak halkaları; AA kontrast.
8. **Biçimlendirme (tr-TR):** `1.234.567 ₺`; kısa: `850 B ₺`, `1,2 Mn ₺`, `3,4 Mr ₺`; yüzde `%12,5` (API'de kesir 0.125 gelir; birimi `%` olan ölçüler zaten yüzdedir); değişim `▲ %16` / `▼ %4`; puan `+2,1 puan`; tarih `24.09.2026`; göreli zaman `12 dk önce`, `3 sa önce`.
9. **Boş/hata durumları:** her kutu kendi iskelet (skeleton) yükleyicisini, "veri yok" ve hata hâlini (yeniden dene ikonu) gösterir; bir kutunun hatası sayfayı çökertmez (Error Boundary).

## 5. Ekranlar

### 5.1 Giriş
Logo, kullanıcı adı, şifre, "Giriş" düğmesi. 401 → "Kullanıcı adı veya şifre hatalı", 429 → bekleme mesajı. Oturum varsa (`GET /api/auth/ben` 200) doğrudan uygulamaya.

### 5.2 Üst çubuk (her sayfada)
- Kiracı adı (`/api/meta` → `firma.ad`).
- **Firma seçici** (Arctos firmaları, `meta.firmalar`): çoklu seçim; varsayılan `aktif: true` olanlar (hiç parametre göndermeden). "Tümü (kapananlar dahil)" → `firma=hepsi`. Seçim tüm veri isteklerine `?firma=0101,0103` olarak eklenir ve tercih olarak saklanır.
- **Dönem seçici** (ikonlu çipler, `meta.donemler`; "ozel" seçilince tarih aralığı). Panolardaki kutular kendi dönemi yoksa bunu kullanır.
- **Eşitleme durumu**: nokta rengi `kopru.durum`'a göre (`guncel` yeşil, `gecikmeli` amber, `kopuk` kırmızı, `bekleniyor`/`yok` gri, `demo` mor) + "12 dk önce". Yanında 🔄 düğmesi → `POST /api/guncelle` (mesajı göster; `/api/surum`'da `bekleyenIstek`/`esitleniyor` iken döner ikon).
- Kullanıcı menüsü: tema, şifre değiştir, çıkış.

### 5.3 Durum (ana sayfa `/`) — `GET /api/durum`
- **Sağlık göstergesi**: 0-100 yarım daire gösterge, ortada skor + not (A-E) + etiket; altında 5 sütun (ikon + mini çubuk + skor). Tıklayınca yan panel: her sütunun ölçütleri (ikon, ad, değer+birim, skor çubuğu, `aciklama`, `ideal`) ve "Neden?" bölümü (`olumlu` / `olumsuz`). `guven` düşükse küçük uyarı ikonu.
- **Büyüme kartı**: kocaman `+%33,8` (`buyume.yuzde`), altında `Reel +%7,0` (`reel` varsa; yoksa "Enflasyon girilmedi" ipucu + Ayarlar bağlantısı), ivme ikonu (`hizlaniyor` ↗, `yavasliyor` ↘, `dengeli` →), 4 bileşen çipi (ikon + %), `yilSonu` tahmini. Ufuk açıklaması (`ufukAd`) ipucunda. Tıklayınca `ozel.buyume` raporu.
- **Finansal durum kutuları** (ikon + büyük rakam): Kasa, Banka (altında küçük "kredi"), Alacak, Borç, Alınan çek/senet, Verilen çek/senet, Stok (`stokVar` false ise gizle), **Net işletme sermayesi**. Döviz varsa küçük çipler (`EUR 160.437 €`; `dovizTL` varsa TL karşılığı). Her kutu ilgili rapora gider (ör. Kasa → `ozel.kasa_durumu`, Alacak → `ozel.alacak_yaslandirma`, Çek → `ozel.cek_alinan`).
- **Bu ay şeridi**: Satış, Tahsilat, Kâr, Sipariş — değer + geçen yıla göre ▲▼ (`buAy.*.yoy`) + önceki aya göre küçük ok.
- **Nakit projeksiyonu** mini grafiği: `projeksiyon.seri` (kesin düz, beklenen kesikli), sıfır çizgisi, en düşük nokta işareti; `ilkAcikTarih` varsa kırmızı uyarı.
- **Uyarılar**: en fazla 3 (seviyeye göre ikon/renk); "Tümü" → Uyarılar sayfası.
- **Oran çipleri**: DSO (tahsil süresi), DPO, nakit yeterliliği (gün), tahsilat oranı — ikon + değer, ipucunda anlamı.

### 5.4 Panolar (`/pano`, `/pano/:id`) — özelleştirilebilir ekran
- Sekmeler: `GET /api/panolar` (ikon + ad). İlk girişte sunucu 3 varsayılan pano oluşturur.
- Izgara: masaüstü 4 sütun, tablet 2, telefon 1. Kutu boyutu `s`=1, `m`=2, `l`=4 sütun (telefonda hepsi tam genişlik).
- Her kutu: başlık (rapor ikonu + `kisa` + küçük dönem rozeti) + gövde (sonuç türüne göre çizim, §6). Kutu, görünür olunca (`IntersectionObserver`) `GET /api/rapor/:id` ister: kutunun `donem/bas/bit/kirilim/n` değerleri, yoksa genel dönem; genel firma seçimi.
- **Düzenleme modu** (kalem ikonu): sürükle-bırak sıralama; kutu menüsü: grafik türü (raporun `grafikler`'i, ikonlarla), boyut S/M/L, dönem (genel/özel), ilk N, başlık, sil. "+" kutusu → katalog çekmecesi (arama + kategori ikonları + önizleme) → kutu ekle. Kayıt: `PUT /api/panolar/:id` (800 ms gecikmeli, iyimser güncelleme). Yeni pano (ad + küçük ikon seçici), pano sil, "Varsayılana dön" (`POST /api/panolar/sifirla`).

### 5.5 Raporlar (`/raporlar`)
- Kategori ızgarası (büyük ikon + ad + rapor sayısı), `GET /api/raporlar` (bir kez al, bellekte tut).
- Arama: Türkçe duyarsız (İ/i, I/ı, Ş/s, Ğ/g, Ç/c, Ö/o, Ü/u katlama); `ad`, `kisa`, `aciklama` üzerinde.
- Görünüm filtresi ikonları: Özet sayı (kpi), Trend, Geçen yılla, Kümülatif, Sıralama (top), Pay, Karşılaştırma, ABC, Isı/Mevsim, Dağılım, Özel.
- Rapor kartı: ikon + `kisa` (kalın) + `ad` (soluk). Tıklayınca görüntüleyici.

### 5.6 Rapor görüntüleyici (`/rapor/:id?donem=…`)
- Başlık: ikon + `ad` + "?" (açıklama). Denetimler `parametreler`'e göre: dönem, kırılım (gün/hafta/ay/çeyrek/yıl), ilk N (5/10/20/50), grafik türü (ikonlar). Parametreler URL'de (paylaşılabilir).
- Büyük grafik + altında veri tablosu (grafik türlerinde) + **CSV indir** (istemci tarafı, UTF-8 BOM, `;` ayraç — Türkçe Excel uyumu).
- "Panoya ekle" (pano + boyut seç) → ilgili panoya kutu ekle.
- `sonuc.not` doluysa bilgi şeridi göster.

### 5.7 Uyarılar (`/uyarilar`) — `GET /api/uyarilar`
Seviyeye göre gruplar (kritik/uyari/bilgi; ikon + renk). Her satır: ikon, `baslik`, `mesaj`; `rapor` varsa tıklanınca o rapor açılır.

### 5.8 Cari detay (yan panel)
Kategori sonuçlarında `boyut.id === "cari"` ise satır anahtarı `k` = `"0101:215"`; tablolarda `firma` + `id` alanı olan satırlar. Tıklanınca `GET /api/cari/:anahtar`: kart bilgisi, bakiye, 12 aylık satış↔tahsilat mini grafiği, son hareketler tablosu, en çok aldığı ürünler.

### 5.9 Ayarlar (`/ayarlar`) — `rol` `admin` veya `super`
- **Genel**: yıllık enflasyon (%) — "reel büyüme bununla hesaplanır" açıklamasıyla; sektör (`GET /api/sektorler`); eşitleme aralığı (5-240 dk); gösterilecek firmalar.
- **Kullanıcılar**: liste, ekle, düzenle (ad, rol Yönetici/İzleyici, aktif, şifre sıfırla), sil.
- **Köprü**: durum kartı; anahtar listesi (etiket, oluşturma, son görülme, ajan sürümü/makine, iptal); **"Yeni anahtar"** → anahtar YALNIZ BİR KEZ gösterilir (kopyala düğmesi) + kurulum adımları (sunucu adresi `sunucu` alanından); eşitleme geçmişi tablosu; ajan olayları; "Tam eşitleme iste".
- **İzahat eşleme** (gelişmiş, katlanır): `SATIS, SATIS_IADE, ALIS, TAHSILAT, TEDIYE, DEVIR` için sayı etiket girişleri; `ozel.izahat_dagilimi` raporuna bağlantı.
- `rol: user` bu sayfada yalnız tema + şifre görür.

### 5.10 Yönetim (`/yonetim`) — yalnız `rol: super`
Firmalar tablosu (kod, ad, köprü durumu rozeti, kullanıcı sayısı, satır, demo); "Yeni firma" (kod, ad, yönetici kullanıcı/şifre, demo kutusu) → dönen `kopruAnahtari`'nı bir kez göster; eylemler: "Bu firmayı görüntüle" (`POST /api/yonetim/gorunum` → `/api/auth/ben`'i yenile, Durum'a git), aktif/pasif, demo yeniden yükle, sil (kod yazarak onay). Firma seçmemiş sistem yöneticisi veri uçlarından **409** alır → `/yonetim`'e yönlendir.

## 6. Sonuç türü → çizim (her kutu ve görüntüleyici aynı bileşeni kullanır)

| `sonuc.tur` / grafik | Çizim |
|---|---|
| `kpi` / `sayi` | Büyük değer; "önceki" ve "geçen yıl" değişim rozetleri (`degisim.tip` `puan` ise puan); `seri` ile alt kısımda kıvılcım (sparkline) |
| `seri` / `cizgi` `alan` `sutun` | x = `veri[].ad`; her `seriler` öğesi bir seri; `kesikli` → kesikli çizgi; `bant` → alt/üst arası gölgeli alan; `devam: true` → son nokta/sütun soluk; negatif değerler desteklenir; y ekseni kısa TL biçimi |
| `kategori` / `cubuk` | Yatay çubuklar; değer + pay etiketi; `diger` gri çubuk; `sirali: true` ise dikey sütun (`sutun`) |
| `kategori` / `pasta` | Halka (donut); ortada `toplam`; `diger` dilimi |
| `kategori` / `agac` | Treemap |
| `kategori` / `karsilastir` | Sıfır eksenli ıraksak yatay çubuklar (`fark`); renk: işaret × `iyi`; ipucunda `v`, `onceki`, `degisim` |
| `kategori` / `pareto` | Çubuk (`v`, A/B/C'ye göre renk) + sağ eksende kümülatif çizgi (`kum` %0-100); üstte `abc` özeti |
| `matris` / `isi` | Isı haritası (`x`, `y`, `hucreler` = `[xi, yi, v]`) |
| `tablo` | Kolon `tip`'ine göre biçim (`tl`, `sayi`, `yuzde` kesir, `yuzdeSayi`, `tarih`, `etiket` rozet, `metin`); `toplam` satırı; sıralanabilir başlıklar; 50 satırdan sonra "daha fazla" |
| `coklu` | `parcalar`'ı sırayla, her biri kendi `tur`/`grafik`'iyle, alt başlıkla |
| `saglik` / `gosterge` | Sağlık göstergesi (Durum sayfasındakiyle aynı bileşen) |
| `buyume` | Büyüme kartı + bileşenler + `detay` (ay/yıl/ttm/son90) tablosu + `tahmin` grafiği |
| `durum` / `bilanco` | Varlıklar ve yükümlülükler iki yığılmış yatay çubuk + net işletme sermayesi + oranlar |
| `projeksiyon` | `seri`: kesin (düz) + beklenen (kesikli), sıfır çizgisi, `minKesin` işareti, günlük giriş/çıkış ipucu |

Grafik paleti: açık/koyu temada okunabilir 8 renkli kategorik palet + anlam renkleri (iyi/orta/kötü). ECharts'ı tema değişince yeniden oluştur.

## 7. Veri tazeliği
`GET /api/surum` her 60 sn; üst çubuktaki eşitleme durumunu (nokta, "12 dk önce") her yoklamada yanıttaki `kopru` alanından güncelle. `veriSurumu` yalnız eşitleme veriyi gerçekten değiştirdiğinde artar; değişince önbellekteki tüm rapor yanıtlarını geçersiz kıl, görünür kutuları yenile ve küçük bildirim göster ("Veriler güncellendi"). Sekme gizliyken yoklamayı durdur. 401 → giriş ekranı.

## 8. Kabul kriterleri
1. `npm run build` hatasız; `web/dist` üretilir; `cloud` sunucusu arayüzü `http://localhost:8080`'de servis eder.
2. ESLint/TypeScript temiz.
3. Playwright testleri (`web/tests/`, `npm run test:e2e`), demo sunucuya karşı:
   - giriş/çıkış; hatalı şifre mesajı,
   - Durum sayfasındaki tüm bölümler görünür,
   - panoya kutu ekle → yeniden yükle → kutu duruyor; sırala/sil/grafik türü değiştir kalıcı,
   - katalogda "müşteri" araması sonuç verir,
   - **`/api/raporlar`'daki TÜM rapor kimliklerini görüntüleyicide aç**: yakalanmamış hata / konsol hatası yok, grafik veya tablo görünür (uzun test; paralel/gruplu çalıştırılabilir),
   - 390×844 (telefon) ve 1440×900 ekran görüntüleri: Durum, Pano, Rapor, Ayarlar; koyu tema görüntüsü → `web/screenshots/`.
4. İlk yükleme JS ≤ 250 KB gzip; ECharts tembel yüklenir.
5. `web/README.md`: geliştirme, derleme, test komutları.

## 9. Sunucunun kullandığı lucide ikon adları (hepsi `lucide-react` 1.x'te mevcut)

Dinamik ikon için tüm kütüphaneyi (`icons`) içe aktarma — paket şişer. Bu adlarla statik bir eşlem kur, bilinmeyen ad için `Circle` kullan:

AlarmClock, AlertTriangle, ArrowDownCircle, ArrowDownRight, ArrowDownToLine, ArrowLeftRight, ArrowUpCircle, ArrowUpDown, Award, BadgeCheck, BadgeDollarSign, BadgePercent, BarChart3, Bell, Boxes, Building, Building2, Calculator, Calendar, CalendarCheck, CalendarCheck2, CalendarClock, CalendarDays, CalendarMinus, CalendarMinus2, CalendarRange, CalendarSearch, CheckCheck, ClipboardCheck, ClipboardList, Clock, Coins, Container, Crown, Database, Droplets, Euro, FileText, FileWarning, FileX, Gauge, GitCompareArrows, Grid3x3, Group, HandCoins, Heart, HeartPulse, History, Hourglass, Infinity, Landmark, Layers, LayoutDashboard, LayoutGrid, LineChart, ListOrdered, ListTree, LogOut, MapPin, Minus, Moon, Package, PackageCheck, PackageMinus, PackagePlus, PackageSearch, PackageX, Percent, PieChart, PiggyBank, Receipt, RefreshCcw, RefreshCw, Repeat, Rocket, Scale, ScatterChart, Scroll, ScrollText, Send, Settings, Shapes, ShieldAlert, ShieldCheck, ShoppingBasket, ShoppingCart, Skull, Snail, Sparkles, Sprout, Sun, Sunset, Tag, Telescope, Ticket, TicketX, Timer, TrendingDown, TrendingUp, TriangleAlert, Truck, Undo2, User, UserCheck, UserMinus, UserPlus, UserRound, UserRoundCheck, Users, Wallet, WalletCards, Warehouse, WifiOff, Zap, ZapOff

(İleride yeni ikon eklenirse sunucu yine lucide adı gönderir; eşleme dosyasını tek yerde tut.)

## 10. Teslim
`web/` altında commit'ler (+ `web/README.md`, `web/screenshots/`, varsa `web/API-ISTEKLERI.md`). Sunucu tarafında değişiklik gerekirse kod yazma; isteği `web/API-ISTEKLERI.md`'ye yaz.
