# Arctos / Vega ERP — Dashboard

SQL Server (Arctos/Vega ERP) veritabanına bağlanan, firma + dönem tablolarını dinamik keşfeden ve günlük nakit / visa / çek-senet hareketlerini gösteren localhost dashboard uygulaması.

## Akış

1. **Kurulum** — SQL Server bilgileri + 6 haneli PIN girilir; bilgiler şifrelenip `config.json`'a kaydedilir.
2. **PIN Girişi** — Sonraki açılışlarda yalnızca PIN ile bağlanılır.
3. **Firma & Dönem Seçimi** — `TBLFIRMA` / `TBLDONEM` üzerinden okunur.
4. **Dashboard** — Seçilen `F{firma}D{dönem}` tablolarından özet kartları ve işlem detayları gösterilir.

## Kurulum

### Backend
```bash
cd server
npm install
npm run dev      # http://localhost:3001
```

### Frontend (geliştirme)
```bash
cd client
npm install
npm run dev      # http://localhost:5173
```

### Tek dosya (exe) derleme
`build.bat` çalıştırılır: client build → `server/public` → `pkg` ile `VegaSorgu.exe`.

## API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET  | `/api/check-setup` | Kurulu mu? |
| POST | `/api/setup` | İlk kurulum (DB + PIN) |
| POST | `/api/login` | PIN ile bağlan |
| POST | `/api/reset` | Ayarları sıfırla |
| GET  | `/api/status` | Bağlantı durumu |
| POST | `/api/disconnect` | Bağlantıyı kes |
| GET  | `/api/summary?firmaNo=&donemNo=&startDate=&endDate=[&allTime=true]` | Günlük özet (cari + kasa nakit) |
| GET  | `/api/details?firmaNo=&donemNo=&type=&startDate=&endDate=[&allTime=true]` | İşlem detayları (`type`: `nakit` \| `visa` \| `cekSenet` \| `ciro` \| `allTime`) |
| GET  | `/api/stok?search=` | Stok arama |

## Veritabanı Mantığı (canlı DB ile doğrulanmıştır)

### Tablolar
| Tablo | Şablon | Önemli sütunlar | Not |
|-------|--------|-----------------|-----|
| Cari hareket | `F{firma}D{dönem}TBLCARIHAREKETLERI` | `TARIH`, `ISLEMTARIHI`, `BORC`, `ALACAK`, `IZAHAT` (nvarchar), `FIRMANO`, `EVRAKNO` | Cari ünvan için JOIN: **`ch.FIRMANO = c.IND`** |
| Cari kart | `F{firma}TBLCARI` | `IND`, `UNVAN`, `FIRMAADI` | Dönemden bağımsız |
| Kasa (nakit) | `F{firma}D{dönem}TBLKASA` | `TARIH`, `GELIR`, `GIDER`, `BELGEIZAHAT` (int), `SUBEADI` | Nakit = `SUM(GELIR) - SUM(GIDER)` |

### İzahat kodları (cari hareket `IZAHAT`)
- **13 / 14** — Visa Tahsilat / Ödeme-İade
- **21 / 22** — Gelen / Giden Çek
- **23 / 24** — Gelen / Giden Senet
- **103 / 104** — Cari Devir Giriş / Çıkış (yıl başı açılış; günlük ciroya değil genel duruma dahil)

### Hesaplamalar
- **Tutar (cari):** `ALACAK - BORC`
- **Nakit (kasa):** `GELIR - GIDER` (kasa izahatı koddan bağımsız; yön GELIR/GIDER ile belirlenir)
- **Tarih filtresi:** `TARIH` (belge/iş tarihi) üzerinden
- **Günlük Ciro:** izlenen kodlar, devir (103/104) hariç
- **Genel Finansal Durum:** izlenen kodların tüm zamanlar net toplamı (devir dahil)

## Güvenlik

- Tablo adı her istekte frontend'den gelen `firmaNo`/`donemNo` ile kurulur ve `INFORMATION_SCHEMA` üzerinden doğrulanır.
- Tarih parametreleri parametreli sorgu ile gönderilir.
- `config.json` parolayı PIN'den türetilen AES-256 anahtarıyla şifreler. **Not:** PIN 6 haneli olduğundan anahtar uzayı kısıtlıdır; yalnızca yerel/güvenli ortam içindir.
- Yalnızca localhost kullanımı içindir.
