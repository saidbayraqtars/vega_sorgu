# Vega Bulut — Web arayüzü

Vite + React 19 + TypeScript + Tailwind CSS 4 · ikonlar `lucide-react` · grafikler Apache ECharts 6 (tembel yüklenir) · sürükle-bırak `@dnd-kit`.
Sunucu sözleşmesi: [`../docs/API.md`](../docs/API.md). Sunucuda eksik/hatalı bulunanlar: [`API-ISTEKLERI.md`](API-ISTEKLERI.md).

## Geliştirme

```bash
# 1) Sunucu (ayrı terminal)
cd cloud && npm install
npm run demo        # demo firması + 3 yıllık örnek veri
npm start           # http://localhost:8080

# 2) Arayüz
cd web && npm install
npm run dev         # http://localhost:5173 — /api istekleri :8080'e proxy'lenir
```

Başka bir sunucuya proxy için: `VITE_API_HEDEF=http://sunucu:8080 npm run dev`.
Kullanıcılar: `demo / demo123` (yönetici) · `izleyici / izleyici123` · `admin / admin123` (sistem yöneticisi).

## Derleme

```bash
npm run build       # tsc + vite → web/dist (sunucu ../web/dist'i otomatik servis eder)
npm run size        # ilk yükleme JS bütçesi (≤ 250 KB gzip) denetimi
npm run lint        # ESLint
npm run typecheck   # TypeScript
```

Sunucu `web/dist`'i **açılışta** algılar: ilk derlemeden sonra sunucuyu yeniden başlatın.
Çıktı yalnız kendi kökünden yükler (CSP: `script-src 'self'`); yazı tipi (Inter) pakete gömülüdür, dış istek yoktur.

## Testler (Playwright)

```bash
npx playwright install chromium    # ilk kez
npm run build && (cd ../cloud && npm start)   # demo sunucu çalışıyor olmalı
npm run test:e2e                   # tümü (~4-6 dk; 1.085 raporun hepsi 8 paralel grupta açılır)
npx playwright test --grep-invert "tüm raporlar"   # hızlı set (~25 sn)
```

Farklı adres: `VB_URL=http://localhost:8080 npm run test:e2e`. Önceden kurulu Chromium ile (indirme yapmadan):
`PW_CHROMIUM=/yol/chromium npm run test:e2e`.
Testler: giriş/çıkış ve hatalı şifre · Durum bölümleri · pano kutu ekle/sırala/grafik/sil kalıcılığı · katalog araması ·
izleyici (salt görüntüleme) rolü + uyarı rozeti · sözleşme (ölçüt birimleri, "ilk N" seçenekleri, dönemsiz raporlar) ·
tüm rapor kimlikleri (yakalanmamış hata / konsol hatası yok) · 390×844 ve 1440×900 ekran görüntüleri + koyu tema → `screenshots/`.

## Tasarım kararları

- Trend, kümülatif ve ısı/mevsim kutuları kendi dönemi yoksa genel dönemi değil **raporun varsayılan dönemini** kullanır
  (genel dönem "Bu ay" iken aylık trend tek sütuna düşüyordu); kutudaki rozet kullanılan dönemi gösterir.
- Yatay çubuk grafikte "Diğer" çubuğu diğerlerini ezip etiketleri kestiği için grafiğin altında ayrı satırdır.
- Tercihler (tema, dönem ve özel aralık, firma seçimi — "Tümü" dahil) sunucuda saklanır; tarayıcıda yalnız ilk boyama için tema tutulur.

## Yapı

```
src/
  lib/          api (fetch sarmalayıcı), types (API tipleri), bicim (tr-TR biçim), arama (Türkçe katlama),
                csv (BOM + ";"), ikonlar (lucide ad → bileşen, TEK eşleme dosyası), yonlendirici (küçük SPA router)
  state/        uygulama (oturum, meta, firma/dönem, tema, 60 sn sürüm yoklaması), rapor (yanıt önbelleği),
                panolar (iyimser güncelleme + 800 ms gecikmeli kayıt)
  charts/       EChart (tembel yükleme, tema değişince yeniden oluşturma), secenekler (sonuç → ECharts seçeneği)
  components/   Kabuk (üst çubuk, ray, alt sekmeler), sonuc/ (tüm sonuç türleri için ortak çizim + tablo),
                saglik, buyume, CariPanel, KatalogGezgini, ui (ortak parçalar)
  pages/        Giris, Durum, Panolar, Raporlar, RaporGoruntuleyici, Uyarilar, Ayarlar, Yonetim
```

## Tasarım kararları

- **Önce ikon:** her menü/kutu/düğme lucide ikonu taşır; yalnız ikon olan düğmelerde `aria-label` + `title` vardır.
  Sunucunun gönderdiği ikon adları `src/lib/ikonlar.ts`'de statik eşlenir (bilinmeyen ad → `Circle`).
- **Renk anlamı:** yeşil iyi, amber dikkat, kırmızı kötü, gri nötr. Değişim rengi raporun `iyi` yönüne göre (`asagi` → artış kırmızı).
- **Dönem:** pano kutusu kendi dönemi yoksa genel dönemi izler. İstisna: zaman yapılı raporlar
  (trend, kümülatif, ısı/mevsim) kısa genel dönemde tek sütuna düşeceği için raporun varsayılan dönemini kullanır;
  kutu rozetinde hangi dönemin kullanıldığı görünür.
- **Veri tazeliği:** `/api/surum` 60 sn'de bir (sekme gizliyken durur); `veriSurumu` değişince tüm önbellek temizlenir,
  görünür kutular eski veriyi göstermeye devam ederken yenilenir, "Veriler güncellendi" bildirimi çıkar.
- **Hata yalıtımı:** her kutu kendi iskeleti, "veri yok" ve hata hâlini (yeniden dene) gösterir; `HataSiniri` bir kutunun hatasının sayfayı çökertmesini engeller.
- **Yatay çubuk grafikte "Diğer"** ölçeği ezmemesi için çubuk olarak değil, grafiğin altında satır olarak gösterilir.
