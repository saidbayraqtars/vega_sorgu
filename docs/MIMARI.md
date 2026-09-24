# Mimari

```
 Müşteri ağı (Windows)                         İnternet                 VPS (Docker)
┌──────────────────────────────┐                                ┌──────────────────────────────────────┐
│ SQL Server — VEGADB          │                                │ Caddy (80/443, Let's Encrypt)        │
│   ▲ yalnız SELECT            │                                │   │                                  │
│   │ db_datareader kullanıcı  │   HTTPS, yalnız dışarı giden   │   ▼                                  │
│ Vega Köprü (tepsi / görev) ──┼──── 15 dk'da bir, gzip JSON ───┼─► Vega Bulut (Node 22, Express 5)    │
│   parmak izi → yalnız değişen│   Bearer vk_… anahtar          │     ├─ /api/kopru/v1  (alım)         │
│   ay/kova parçaları          │                                │     ├─ /api/…         (panel API)    │
└──────────────────────────────┘                                │     ├─ web/dist       (arayüz)       │
                                                                │     └─ /data                          │
 Kullanıcılar (tarayıcı / köprü penceresi)                     │         ├─ registry.db (kullanıcı,   │
┌──────────────────────────────┐        HTTPS, çerez oturumu    │         │   firma, anahtar, pano)    │
│ Panel: durum, panolar,       │◄───────────────────────────────┤         └─ tenants/<firma>.db        │
│ 1.085 rapor, uyarılar        │                                │             (her müşteri ayrı dosya) │
└──────────────────────────────┘                                └──────────────────────────────────────┘
```

## Bileşenler

| Dizin | Görev | Teknoloji |
|---|---|---|
| `shared/` | Köprü ile bulutun ortak sözleşmesi: 14 kanonik veri kümesi, kolonlar, parça anahtarları, döviz tespiti | Saf JS |
| `bridge/` | SQL keşfi, çıkarım sorguları (SQL Server 2008+), parmak izi, eşitleme motoru, kilit, komut satırı | Node ≥ 18, `mssql` |
| `electron/` | Köprünün Windows tepsi uygulaması: ayar/durum/günlük penceresi, sunucu modu (Zamanlanmış Görev), otomatik güncelleme | Electron 44 |
| `cloud/` | Alım API'si, kiracı depoları, analiz motoru, rapor kataloğu, panel API'si, yönetim | Node ≥ 22.13, Express 5, yerleşik `node:sqlite` |
| `web/` | Panel arayüzü: durum, panolar (sürükle-bırak), 1.085 raporluk katalog, uyarılar, ayarlar, yönetim; sözleşme [API.md](API.md) | Vite, React 19, TypeScript, Tailwind 4, ECharts 6 |
| `deploy/` | Dockerfile, docker-compose + Caddy, systemd birimi, yedek betiği | |

Eski masaüstü sürümü (`server/`, `client/`, `VegaSorgu.exe`) yeni sistemde kullanılmaz.

## Neden bu tasarım?

- **Köprü dışarı bağlanır, içeri bağlantı yok**: müşterinin güvenlik duvarında port açmak, VPN
  kurmak gerekmez; SQL Server internete hiç açılmaz. Bulut köprüye SQL göndermez — köprü yalnız
  kendi içindeki sabit sorguları çalıştırır (bulut ele geçirilse bile müşteri veritabanına yazılamaz).
- **Kanonik veri kümeleri**: Arctos'un yıl/firma bazlı yüzlerce tablosu (`F0101D0017TBL…`) köprüde
  sabit bir şemaya indirgenir; bulut Arctos sürüm farklarından etkilenmez, olmayan kolonlar `NULL` gelir.
- **Parmak izi ile artımlı eşitleme**: her (veri kümesi × firma × dönem × ay/kova) parçası için
  `COUNT + CHECKSUM_AGG(BINARY_CHECKSUM) + SUM`; bulut yalnız farklı olanları ister. 15 dakikalık
  turlar tipik olarak saniyenin altında biter; SQL Server'a yük bindirmez.
- **Kiracı başına ayrı SQLite dosyası**: firmalar arası veri sızıntısı yapısal olarak imkânsız;
  yedekleme, taşıma ve silme dosya düzeyinde; yerel derleme gerektirmeyen `node:sqlite`.
- **Sürüm tabanlı önbellek**: veri yalnız eşitlemede değişir; tüm hesaplar `(firma, veri sürümü,
  istek, gün)` ile önbelleklenir ve eşitleme sonrası ana ekran arka planda ısıtılır.
- **Açıklanabilir sonuçlar**: skorlar, büyüme ve uyarılar kara kutu değildir; her sayı kendi
  cümlesi, bileşenleri ve ilgili raporuyla gelir ([ALGORITMA.md](ALGORITMA.md)).

## Güvenlik

| Konu | Uygulama |
|---|---|
| Kullanıcı şifreleri | scrypt (N=16384, r=8, p=1, 16 bayt tuz); var olmayan kullanıcıda da aynı maliyet (zamanlama sızıntısı yok) |
| Oturum | 32 bayt rastgele belirteç, veritabanında SHA-256 özeti; `HttpOnly`, `SameSite=Lax`, HTTPS'te `Secure` çerez; 30 gün; şifre değişince tüm oturumlar düşer |
| CSRF | SameSite + durum değiştiren isteklerde `Origin` = `Host` denetimi |
| Kaba kuvvet | IP + kullanıcı başına 15 dakikada 10 hatalı giriş → 429 |
| Roller | `super` (VPS sahibi, tüm firmalar) · `admin` (firma yöneticisi: ayarlar, kullanıcılar, köprü anahtarları) · `user` (yalnız görüntüleme) |
| Kiracı yalıtımı | Her istek oturumun firmasına bağlı; firma verisi ayrı dosyada; başka firmanın kaydına erişim 404 |
| Köprü anahtarı | `vk_<firma>_<24 bayt>`; yalnız SHA-256 özeti saklanır, bir kez gösterilir, iptal edilebilir; firma pasifse geçersiz |
| Tarayıcı başlıkları | CSP (`default-src 'self'`, dış kaynak yok), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, HSTS (Caddy) |
| Girdi doğrulama | Kolon listesi ve satır uzunluğu sözleşmeye karşı; parametreli SQL; dönem/kırılım/rapor kimliği beyaz liste |
| Müşteri tarafı | Salt-okunur SQL kullanıcısı; ayar dosyasında şifre ve anahtar gizlenmiş; `sa`/sysadmin ile bağlanılırsa uyarı |

## Veri akışı ve sürümler

1. Köprü `manifest` gönderir → bulut `need/drop` döner (`sync_manifest` tablosunda tutulur).
2. Parçalar gelir; çok parçalıysa `stage` tablosunda bekler, son parça gelince tek işlemde değişir.
3. `commit`: kapsamdaki silinmiş parçalar düşer; veri değiştiyse **veri sürümü** artar, önbellek geçersizleşir,
   ana ekran arka planda yeniden hesaplanır.
4. Arayüz 60 sn'de bir `/api/surum` yoklar; sürüm değişince ekrandaki verileri yeniler.

## Ölçek

- Demo (3 firma, 3 yıl, ~232 bin satır): genel durum ~0,5 sn, rapor ortalaması ~20 ms, 1.085 raporun tamamı ~20 sn.
- Tek VPS'te onlarca firma: CPU yalnız eşitleme sonrası ilk isteklerde kullanılır; SQLite WAL ile
  okumalar yazmayı beklemez. Firma sayısı yüzleri aşarsa kiracılar birden çok VPS'e dağıtılabilir
  (her kiracı bağımsız bir dosyadır).
