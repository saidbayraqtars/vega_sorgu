# Vega Köprü (müşteri sunucusundaki ajan)

Müşterinin SQL Server'ındaki Arctos/Vega veritabanını (VEGADB) **salt-okunur** okur, kanonik veri
kümelerine çevirir ve 15 dakikada bir (ayarlanabilir) Vega Bulut'a HTTPS ile gönderir.
Yalnız **değişen** ay/kova parçaları gider (COUNT + CHECKSUM_AGG + SUM parmak izi).

- Yalnız dışarıya HTTPS bağlantısı gerekir; müşterinin ağında port açmaya gerek yoktur.
- Sorgular SQL Server 2008+ uyumludur; kurulumda olmayan kolonlar otomatik NULL gelir.
- Panelden "Şimdi güncelle" basılınca köprü ≤ 60 sn içinde eşitler.

## Kurulum (başsız / Windows hizmeti)

```bash
cd bridge && npm install
node src/cli.js kur --sunucu https://panel.ornek.com --anahtar vk_firma_xxx \
  --sql-sunucu SUNUCU\SQLEXPRESS --sql-kullanici vega_kopru --sql-sifre ****** --veritabani VEGADB
node src/cli.js test        # SQL + bulut bağlantısı
node src/cli.js bir-kez     # tek eşitleme
node src/cli.js calistir    # sürekli (Windows'ta NSSM ile hizmet yapın)
```

Salt-okunur SQL kullanıcısı: [sql/salt-okunur-kullanici.sql](sql/salt-okunur-kullanici.sql).
Masaüstü (tepsi simgeli) sürüm: kök dizindeki Electron uygulaması (`npm start`).

## Test

```bash
npm test                                            # birim testleri
MSSQL_E2E=1 MSSQL_SA_PASSWORD=... node --test test/e2e-mssql.test.js   # gerçek SQL Server ile uçtan uca
```
