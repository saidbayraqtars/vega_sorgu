# Vega Köprü (müşteri sunucusundaki ajan)

Müşterinin SQL Server'ındaki Arctos/Vega veritabanını (VEGADB) **salt-okunur** okur, kanonik veri
kümelerine çevirir ve 15 dakikada bir (ayarlanabilir) Vega Bulut'a HTTPS ile gönderir.
Yalnız **değişen** ay/kova parçaları gider (COUNT + CHECKSUM_AGG + SUM parmak izi).

- Yalnız dışarıya HTTPS bağlantısı gerekir; müşterinin ağında port açmaya gerek yoktur.
- Sorgular SQL Server 2008+ uyumludur; kurulumda olmayan kolonlar otomatik NULL gelir.
- Panelden "Şimdi güncelle" basılınca köprü ≤ 60 sn içinde eşitler.
- Aynı ayar klasöründe tek etkin eşitleyici (`kopru.kilit`): tepsi uygulaması ile sunucu modu çakışmaz.

Windows'ta normal kullanım **tepsi uygulamasıdır** (kök dizindeki `electron/`, kurulum:
`VegaKopru-Setup-x.y.z.exe`). Ayrıntılı belge: [../docs/KOPRU.md](../docs/KOPRU.md).

## Komut satırı (başsız / Linux / Electron'un desteklemediği eski Windows)

```bash
cd bridge && npm install --omit=dev
node src/cli.js kur --sunucu https://panel.ornek.com --anahtar vk_firma_xxx \
  --sql-sunucu "SUNUCU\SQLEXPRESS" --sql-kullanici vega_kopru --sql-sifre '******' --veritabani VEGADB
node src/cli.js test        # SQL + bulut bağlantısı
node src/cli.js bir-kez     # tek eşitleme (--tam: hepsini yeniden gönder)
node src/cli.js calistir    # sürekli (--servis: Windows görevi kipi, --gunluk dosya)
node src/cli.js durum
```

Salt-okunur SQL kullanıcısı: [sql/salt-okunur-kullanici.sql](sql/salt-okunur-kullanici.sql).

## Test

```bash
npm test                                            # birim testleri (kilit, izleyici modu, ayar yenileme)
MSSQL_E2E=1 MSSQL_SA_PASSWORD=... node --test test/e2e-mssql.test.js   # gerçek SQL Server ile uçtan uca
```
