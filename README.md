# Arctos ERP — Smart Discovery Dashboard

SQL Server (Arctos ERP) veritabanına bağlanan, dönem tablolarını otomatik keşfeden ve günlük nakit/visa işlemlerini gösteren localhost dashboard uygulaması.

## Smart Workflow

1. **Bağlantı & Keşif** — SQL Server bilgilerini girin. Sistem otomatik olarak `TBLCARIHAREKETLERI` ile biten tüm tabloları keşfeder.
2. **Dönem Seçimi** — Keşfedilen tablolar arasından aktif döneminizi seçin.
3. **Dashboard** — Seçilen dönem tablosundan günlük nakit (IZAHAT=83) ve visa (IZAHAT=13) işlemlerini görüntüleyin.

## Kurulum

### Backend
```bash
cd server
npm install
npm run dev
```
Backend `http://localhost:3001` adresinde çalışır.

### Frontend
```bash
cd client
npm install
npm run dev
```
Frontend `http://localhost:5173` adresinde çalışır.

## API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| POST | `/api/connect` | Bağlan + tablo keşfi (TBLCARIHAREKETLERI) |
| GET | `/api/status` | Bağlantı durumu |
| POST | `/api/disconnect` | Bağlantıyı kes |
| GET | `/api/summary?date=YYYY-MM-DD&table=TABLO_ADI` | Günlük özet (Nakit + Visa toplamları) |
| GET | `/api/details?date=YYYY-MM-DD&table=TABLO_ADI` | Günlük işlem detayları |

## Veritabanı Mantığı

- **Tablo Keşfi:** `INFORMATION_SCHEMA.TABLES` üzerinden `%TBLCARIHAREKETLERI` pattern ile arama
- **Nakit:** `IZAHAT = 83`
- **Visa:** `IZAHAT = 13`
- **Tutar:** `ALACAK` kolonu
- **Tarih:** `ISLEMTARIHI` kolonu

## Güvenlik

- Tablo adı her istekte frontend'den gönderilir (global state riski yok)
- Tablo adı `INFORMATION_SCHEMA` üzerinden doğrulanır (SQL Injection koruması)
- Tarih parametresi parametreli sorgu ile gönderilir
- Yalnızca localhost kullanımı içindir
