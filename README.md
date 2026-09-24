# Vega — Arctos/Vega ERP için bulut finans paneli

Müşterinin sunucusundaki Arctos/Vega (VEGADB) verisini **köprü** ile 15 dakikada bir kendi VPS'inize
taşır; şirketin **büyüme yüzdesini**, **finansal sağlık skorunu**, **anlık finansal durumunu**, 90 günlük
**nakit projeksiyonunu** ve **1.085 raporu** sade, simgelerle anlatan bir panelde gösterir.

```
Müşteri SQL Server ──(Vega Köprü, salt-okunur, yalnız dışarı HTTPS)──► VPS: Vega Bulut ──► Panel (tarayıcı)
```

| | |
|---|---|
| **Büyüme Endeksi** | Net ciro %40 · brüt kâr %30 · tahsilat %20 · aktif müşteri %10; yıllık karşılaştırma, enflasyondan arındırılmış reel büyüme, ivme, 3 aylık tahmin, yıl sonu tahmini |
| **Finansal Sağlık Skoru** | 0–100, A–E: likidite · kârlılık · büyüme · tahsilat & döngü · risk; "neden bu skor?" açıklamalarıyla |
| **Anlık durum** | Kasa, banka, döviz, alacak/borç, çek/senet, stok; operasyonel bilanço, cari/asit-test oranları, DSO/DPO/DIO |
| **Nakit projeksiyonu** | Vade takvimi (kesin) + olağan akış (mevsim düzeltmeli) — "nakit ne zaman sıkışır?" |
| **Uyarılar** | 20+ açıklanabilir kural: nakit açığı, vadesi geçen çek, tahsilat gerilemesi, marj düşüşü… |
| **Raporlar** | 35 ölçü × 16 boyut × 11 görünüm + 46 özel analiz; her biri özelleştirilebilir panolara eklenir |

## Dizinler

| Dizin | İçerik |
|---|---|
| [`cloud/`](cloud/) | **Vega Bulut** — VPS sunucusu: alım API'si, analiz motoru, rapor kataloğu, panel API'si |
| [`bridge/`](bridge/) | **Vega Köprü** çekirdeği — SQL keşfi, çıkarım, artımlı eşitleme, komut satırı |
| [`electron/`](electron/) | Köprünün Windows tepsi uygulaması (eski "Vega Sorgu" masaüstü uygulamasının yerini alır) |
| `web/` | Panel arayüzü (React, ayrı geliştirilir) — görev tanımı: [docs/ARAYUZ-PROMPT.md](docs/ARAYUZ-PROMPT.md) |
| [`shared/`](shared/) | Köprü ↔ bulut veri sözleşmesi |
| [`deploy/`](deploy/) | Docker + Caddy (otomatik HTTPS), systemd, yedekleme |
| [`docs/`](docs/) | Belgeler |

## Hızlı başlangıç (demo)

```bash
cd cloud && npm install
npm run demo      # demo firması + örnek veri
npm start         # http://localhost:8080 → demo / demo123 · admin / admin123
npm test          # 44 test: motor Arctos formüllerine karşı, 1.085 raporun tamamı, HTTP uçları
```

Canlı kurulum: **[docs/KURULUM.md](docs/KURULUM.md)** (VPS'te `docker compose up -d --build`).

## Belgeler

- [KURULUM.md](docs/KURULUM.md) — VPS, alan adı/HTTPS, firma açma, yedekleme, güncelleme, sürüm yayınlama
- [KOPRU.md](docs/KOPRU.md) — köprü kurulumu, sunucu modu, eşitleme protokolü, sorun giderme
- [ALGORITMA.md](docs/ALGORITMA.md) — uçtan uca analiz algoritması: formüller, ağırlıklar, eşikler
- [MIMARI.md](docs/MIMARI.md) — bileşenler, güvenlik, veri akışı, ölçek
- [RAPORLAR.md](docs/RAPORLAR.md) — rapor kataloğu (koddan üretilir)
- [API.md](docs/API.md) — panel API sözleşmesi
- [ARCTOS-VEGADB.md](docs/ARCTOS-VEGADB.md) — Arctos/Vega veritabanı notları

## Köprü uygulaması (Windows)

```bat
start.bat              :: geliştirme: tepsi uygulaması + ayar penceresi
build.bat              :: yerel kurulum dosyası: dist\VegaKopru-Setup-x.y.z.exe
release.bat [patch]    :: GitHub Releases'a yayınla (kurulu köprüler kendiliğinden güncellenir)
```

> Yeni köprü sürümü yayınlandığında eski **Vega Sorgu** masaüstü kurulumları otomatik güncellemeyle
> köprüye dönüşür (SQL ayarları korunur; raporlar artık web panelindedir). VPS hazır olmadan yayınlamayın.
