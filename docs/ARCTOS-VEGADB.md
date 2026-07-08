2# Arctos / Vega ERP — VegaDB Teknik Rehber

> Bu belge, **Arctos (Vega ERP)** masaüstü uygulamasının kullandığı **VegaDB** (MSSQL)
> veritabanının, Vega Sorgu uygulamasını Arctos ile **birebir tutarlı** hale getirmek
> için canlı SQL izleme (SQL Server Extended Events) ile çıkarılan yapısını ve
> **doğrulanmış** hesaplama formüllerini anlatır. İleride yeni ekran/rapor eklerken
> önce buraya bak; sayı tutmuyorsa "İzleyici ile Arctos SQL'i yakalama" bölümüyle
> Arctos'un gerçek sorgusunu çek ve karşılaştır.

Son güncelleme: 2026-07 · Doğrulama firması: **F0101 (ÖZDEMİRKAYA)** · DB: `Vegadb` @ `localhost` (sa)

---

## 1. Veritabanı adlandırma düzeni

VegaDB tek veritabanında **çok firma + çok dönem** tutar. Tablo adları desenlidir:

| Desen | Anlamı | Örnek |
|---|---|---|
| `TBL...` | Global (firma/dönemden bağımsız) | `TBLFIRMA`, `TBLDONEM`, `TBLKASATANIMLARI` |
| `F{firma}TBL...` | Firmaya özel, dönemden bağımsız (tanım/kart) | `F0101TBLCARI`, `F0101TBLBANKALAR`, `F0101TBLSTOKLAR` |
| `F{firma}D{donem}TBL...` | Firma + dönem (hareket tabloları) | `F0101D0015TBLKASA`, `F0101D0015TBLCARIHAREKETLERI` |
| `F{firma}D{donem}VARES...` | **VIEW** (rapor görünümleri) | `F0101D0015VARESALINANCEKLER` |
| `F{firma}D{donem}V...` | Diğer VIEW'lar | `F0101D0015VFATURABASLIKLAR` |

- `{firma}` = 4 haneli, sıfır dolgulu (F0101, F0103, F0106…). Uygulamada `firmaNo` = `'0' + TBLFIRMA.IND`.
- `{donem}` = 4 haneli, sıfır dolgulu (D0001…D0017). = `RIGHT('0000'+TBLDONEM.IND,4)`.
- **DİKKAT:** `VARES*` tabloları **VIEW**'dır. `INFORMATION_SCHEMA.TABLES` içinde `TABLE_TYPE='VIEW'`; varlık kontrolünde `TABLE_TYPE IN ('BASE TABLE','VIEW')` kullan yoksa görünmez.

### Firma → dönem indeksi eşlemesi (ÇOK ÖNEMLİ)

Aynı takvim yılı, **her firmada farklı dönem numarasına** düşebilir. `TBLDONEM` haritadır:

```sql
SELECT FIND AS firma, IND AS donemNo, DONEM AS yil FROM TBLDONEM ORDER BY FIND, IND
```

| Firma | 2024 | 2025 | 2026 |
|---|---|---|---|
| F0101 | D0015 | D0016 | D0017 |
| F0103 | D0013 | D0014 | **D0015** |
| F0106 | (yok) | (yok) | (yok) — en son D0009=2022 |

- **Dönem numarasını firmalar arası SABİTLEME.** Her firma için `TBLDONEM WHERE FIND=firma` ile yıl→dönem çöz.
- "Aktif/çalışma dönemi" merkezi bir tabloda **tutulmuyor** (`TBLCALISMADONEMI` tek/boş satır). Arctos'ta aktif dönem kullanıcının seçtiği dönemdir; uygulama da firma+dönem seçtirmeli.
- Vega Sorgu bunu doğru yapıyor (`loadFirmaDonem()` → TBLDONEM'i UI'a verir).

---

## 2. İzleyici ile Arctos SQL'i yakalama (SQL Server Extended Events)

Arctos bir Delphi uygulaması; sayıları **client tarafında** değil, çoğunlukla SQL sorgularıyla
üretir. Bu sorguları **birebir** yakalamak en güvenilir yöntemdir. Windows Perf Monitor SQL
metni yakalamaz; **SQL Profiler kurmaya gerek yok** — Extended Events saf T-SQL'dir.

**Akış:**
1. Session kur + başlat (Vegadb'ye giden tüm statement/rpc/batch'i ring buffer'a yaz):
```sql
IF EXISTS(SELECT 1 FROM sys.server_event_sessions WHERE name='vega_kasa_trace')
  DROP EVENT SESSION [vega_kasa_trace] ON SERVER;
CREATE EVENT SESSION [vega_kasa_trace] ON SERVER
  ADD EVENT sqlserver.sql_statement_completed(ACTION(sqlserver.client_app_name,sqlserver.sql_text) WHERE sqlserver.database_name=N'Vegadb'),
  ADD EVENT sqlserver.rpc_completed(ACTION(sqlserver.client_app_name,sqlserver.sql_text) WHERE sqlserver.database_name=N'Vegadb'),
  ADD EVENT sqlserver.sql_batch_completed(ACTION(sqlserver.client_app_name,sqlserver.sql_text) WHERE sqlserver.database_name=N'Vegadb')
  ADD TARGET package0.ring_buffer(SET max_memory=8192)
  WITH (MAX_DISPATCH_LATENCY=3 SECONDS, TRACK_CAUSALITY=ON);
ALTER EVENT SESSION [vega_kasa_trace] ON SERVER STATE=START;
```
2. Arctos'ta ilgili ekranı/işlemi yap (ör. kasa özeti, fatura, çek girişi).
3. Ring buffer'ı oku ve XML'i parçala:
```sql
SELECT CAST(t.target_data AS XML)
FROM sys.dm_xe_sessions s
JOIN sys.dm_xe_session_targets t ON t.event_session_address=s.address
WHERE s.name='vega_kasa_trace' AND t.target_name='ring_buffer';
```
4. Bitince: `DROP EVENT SESSION [vega_kasa_trace] ON SERVER;`

**İpuçları:**
- Arctos'un `client_app_name`'i: `Arctos|~|<no>|~|arc|&|<kullanıcı>`. Kendi Node uygulaman `node-mssql` görünür — ayırt etmek için filtre.
- Ring buffer ~1000 event'te döner; çok işlem birikirse aralarda oku.
- Parametreli sorgular `exec sp_executesql N'...',N'@P1 ...',<değerler>` biçiminde; parametre değerleri sonda.
- Doğrulama: yakalanan Arctos SQL'ini **aynen** çalıştır → uygulamanın formülüyle karşılaştır. Fark = bulunan bug.

Bu repoda örnek scriptler (session dışı, geçici kullanıldı): kur/başlat, ring parse. Aynı deseni tekrar kullan.

---

## 3. KASA — "Toplam Kasa Bakiyesi" (GERÇEK BUG kaynağıydı)

Arctos'un kasa özeti ekranı (sol-alt Toplam Kasa Bakiyesi) canlı yakalanan sorgu:

```sql
SELECT SUM((GELIR-GIDER)/KUR) AS TOPLAM, PARABIRIMI
FROM F{firma}D{donem}TBLKASA AS K
WHERE CASE WHEN K.BELGEIZAHAT = 15
           THEN (SELECT ISNULL(OZELKOD3,'') FROM F{firma}D{donem}TBLTAHSILBASLIK
                 WHERE IND = K.BELGELINK AND BELGETIPI = K.BELGEIZAHAT)
           ELSE '' END <> 'KREDIKASA'
  AND ISLEMTIPI = 1
GROUP BY PARABIRIMI
-- kasa/şube kırılımı için: AND K.KASAADI='...'  veya  AND K.SUBEADI='...'
```

**3 kural (hepsi bakiyeyi düşürür — bunlar yoksa kasa şişer):**

1. **`(GELIR-GIDER)/KUR`** — döviz kasada kendi biriminde. Bu DB'de tüm kasalar TL/KUR=1
   olduğu için sayısal etkisiz; ama döviz gelirse `/KUR` şart (biz eskiden yanlışlıkla `*KUR`).
2. **`ISLEMTIPI = 1`** — yalnız fiziksel nakit. `ISLEMTIPI = 2/3` = **virman / çek-senet
   transfer** satırları (ISLEM=-26/-28/-3, açıklamada banka/çek adı); bunlar nakit **değil**.
   *Kanıt:* F0103D0009 filtresiz 726.001 → doğru 346.754 (tip 2/3 net 379.247 fazlaydı).
   **Bu, asıl "kasa yanlış" bug'ının ana sebebiydi.**
3. **KREDIKASA hariç** — `BELGEIZAHAT=15` ve bağlı `TBLTAHSILBASLIK.OZELKOD3='KREDIKASA'`
   olan satırlar POS/kredi kartı tahsilatıdır, nakde sayılmaz. (Güncel dönemlerde 0 satır
   → etkisiz, ama formülde tut; `TBLTAHSILBASLIK` yoksa clause'u atla.)

**Ek yapı bilgisi:**
- Master `F{firma}TBLKASA` (dönemsiz) **BOŞ** → bakiye hazır saklanmaz, hep hareketten hesaplanır.
- **Açılış devri** dönem içinde normal hareket olarak durur (`"YYYY AÇILIŞ DEVRİ"`). Yani
  seçili dönemin `SUM(GELIR-GIDER)` neti devri **zaten içerir** → **dönemleri TOPLAMA** (çift sayar).
- KREDIKASA/kredi kartı POS taksitleri kasaya değil VISA portföyüne gider → nakdi bozmaz.

Vega Sorgu uygulaması: `KASA_NAKIT_VAL` + `kasaNakitWhere()` yardımcıları; `/api/home`,
`/api/summary`, `/api/details?type=nakit` bu formülü kullanır. Kasa sorgusunda alias **K** zorunlu.

---

## 4. BANKA — hesap bakiyesi

Arctos banka hareket ekranı (yürüyen bakiye):
```sql
SELECT ..., SUM((b.BORC/b.KUR) - (b.ALACAK/b.KUR)) AS BAKIYEC
FROM F{firma}D{donem}TBLBANKAHAREKETLERI a, F{firma}D{donem}TBLBANKAHAREKETLERI b
WHERE a.BANKANO=? AND a.BANKANO=b.BANKANO AND b.SIRALAMATARIHI <= a.SIRALAMATARIHI
GROUP BY ... ORDER BY a.SIRALAMATARIHI
```
Hesap bakiyesi = `SUM((BORC-ALACAK)/KUR)`. **ISLEMTIPI filtresi yok** (bankada kavram yok).

Hesap listesi filtresi: `WHERE MUSBANKA=0 AND (STATUS<>2 OR STATUS IS NULL)`.
- **`MUSBANKA=0`**: `MUSBANKA=1` = müşteri bankası (çek/POS için tanımlı), bizim varlığımız
  değil → banka toplamına GİRMEZ.
- `/KUR`: döviz hesap kendi biriminde.
- Not: Bu DB'de MUSBANKA=1 hesaplar hareketsiz olduğu için pratik etki ~0'dı; banka zaten
  neredeyse doğruydu. Yine de filtreler doğruluk/gelecek için eklendi.

Sıralama `SIRALAMATARIHI` iledir (TARIH değil).

---

## 5. ÇEK / SENET — portföy ve tutarlar

Çek/senet **TUTAR** toplamları hazır **VIEW**'lardan okunur (giriş tablolarında tutar yok):

| VIEW | İçerik | Anlam |
|---|---|---|
| `F{firma}D{donem}VARESALINANCEKLER` | Müşteriden alınan çek | **VARLIK** (elimizdeki) |
| `F{firma}D{donem}VARESVERILENCEKLER` | Verdiğimiz çek | **BORÇ** |
| `F{firma}D{donem}VARESALINANSENETLER` | Alınan senet | VARLIK |
| `F{firma}D{donem}VARESVERILENSENETLER` | Verilen senet | BORÇ |

Ortak kolonlar: **`TUTAR`** (decimal), **`VADE`**, **`TAHSILDURUMU`** (`'Tahsilat Yok'` =
portföyde/tahsil edilmemiş), `FIRMAADI/FIRMAKODU`, `BELGENO`, `BANKAADI`, `PARABIRIMI`, `KUR`,
`OZELKOD1-9`. `VERILEN*` ayrıca `HAREKETIND`, senet `BELGETIPI=11`.

Toplam: `SELECT SUM(TUTAR) FROM F{firma}D{donem}VARESALINANCEKLER`.

**Yazma yapısı (giriş akışı — bordrodan):**
- Alınan çek: `TBLCEKGIRIS` (BELGENO, BANKA, KESIDEEDEN, KESIDETARIHI, FIRMANO=cari, EVRAKNO,
  TAKIPNO; **tutar YOK**) + `TBLCEKPORTFOY` (KALAN, EVRAKNO, PORTFOYNO) + `TBLCEKHAREKETLERI`
  (BELGEIZAHAT=13, BELGEIND=EVRAKNO, ISLEMIND).
- Verilen senet: `TBLSENETCIKIS` (FIRMANO, BELGENO, EVRAKNO; TUTAR kolonu var ama NULL) +
  `TBLSAHSISENETPORTFOY` + `TBLSENETHAREKETLERI` (BELGEIZAHAT=11).
- Tutar giriş satırında değil; bordro (`TBLTOPLUCARIBORDROBASLIK/HAREKET`, `HAREKET.TUTAR`) ve
  portföy üzerinden gelir. `VARES*` view'ları birleştirip `TUTAR` üretir.

Vega Sorgu: `/api/home` → `cekAlinanTutar/cekVerilenTutar/senetAlinanTutar/senetVerilenTutar`
(SUM(TUTAR), `validateTableName(name, true)` ile view guard). Eski sürüm yalnız satır sayardı.

---

## 6. CARİ — bakiye ve hareket

Arctos cari kart bakiyesi (canlı):
```sql
SELECT SUM(ISNULL(BORC,0) - ISNULL(ALACAK,0))
FROM F{firma}D{donem}TBLCARIHAREKETLERI
WHERE FIRMANO = <cari.IND> AND ISNULL(OZELKOD,'') <> 'KREDIHESABI'
```
- **Pozitif bakiye = cari bize borçlu (alacağımız)**, negatif = biz borçluyuz.
- **`OZELKOD='KREDIHESABI'` satırları bakiyeye girmez.**
- Cari hareket ekranı: `/KUR` + yürüyen `BAKIYEC` (SIRALAMATARIHI), `WHERE OZELKOD5 <>
  'PERSONELCARI'` (personel cari hariç).

### IZAHAT kodları (TBLCARIHAREKETLERI.IZAHAT) — doğrulanmış

| IZAHAT | Anlam | Alan |
|---|---|---|
| 11 | Cari Çıkış / Tediye (ödedik) | BORC |
| 13 | Cari Giriş / **Tahsilat** (aldık) | ALACAK |
| 20 | **Alış** Faturası | ALACAK |
| 21 | **Satış** Faturası (ciro/gelir) | BORC |
| 22 | Alış İade | ALACAK |
| 23 | Satış İade | BORC |
| 103 / 104 | Cari Devir Giriş / Çıkış (yıl başı açılış) | — |

- Ciro = `SUM(BORC) WHERE IZAHAT=21`; Tahsilat = `SUM(ALACAK) WHERE IZAHAT=13`;
  Alış = `SUM(ALACAK) WHERE IZAHAT=20`.
- **NOT:** Eski `[13,14]=Visa`, `[21,22,23,24]=Çek/Senet` haritası YANLIŞTI. Çek/senet kendi
  tablolarında. Banka izahatları ayrı (72/73/83/84/113).

---

## 7. CARİ GİRİŞ/ÇIKIŞ BORDROSU — ödeme aracı yönlendirmesi

Tahsilat/tediye bordrosu ödeme aracını `TBLCARGIRHAREKET`/`TBLCARCIKHAREKET` (IZAHAT + PORTNO)
ile kodlar ve ilgili alt-sisteme postalar:

| Araç | Bordro kaydı | Postalandığı yer |
|---|---|---|
| **Nakit** | giriş IZAHAT=1, PORTNO=-1 | `TBLKASA` (BELGEIZAHAT=13, ISLEMTIPI=1) → kasa nakit |
| **Kredi kartı** | PORTNO=6 (visa) | `TBLBNKKARTANLASMAHAREKET` (POS anlaşma, SATISSEKLI=taksit), N taksit=N `TBLVISAPORTFOY` satırı → **kasaya girmez** |
| **Çek** | IZAHAT=2 | `TBLCEKGIRIS/CEKCIKIS` + BELGELINK |
| **Senet** | IZAHAT=3 | `TBLSENETGIRIS/SENETCIKIS` |

Sonuç: kredi kartı/çek/senet nakdi bozmaz; yalnız nakit kasa toplamına girer.

---

## 8. SATIŞ KÂRLILIK — kâr analizi

Arctos satış fatura kâr analizi (canlı yakalanan):
```sql
SELECT
  (SUM(GERCEKTOPLAM) - SUM(MIKTAR*AFIYATI) - SUM(ISNULL(MASRAF,0))) * 100
    / SUM(MIKTAR*AFIYATI)                                    AS KAR   -- maliyet üzeri %
FROM F{firma}D{donem}TBLSATFATHAREKET HAR
  INNER JOIN F{firma}TBLSTOKLAR STK ON HAR.STOKNO=STK.IND
  INNER JOIN F{firma}TBLBIRIMLEREX BRM ON HAR.BIRIMEX=BRM.IND
WHERE HAR.EVRAKNO=? AND HAR.STOKTIPI NOT IN (12,13,14)
-- Ciro (fatura toplamı): SUM(GERCEKTOPLAM) WHERE ISNULL(DETAY,0)=0
```

- **Ciro = `SUM(GERCEKTOPLAM)`**, `DETAY=0` (set ürün alt-satırı hariç).
- **Maliyet (COGS) = `SUM(MIKTAR * AFIYATI)`** — `AFIYATI` = satış satırındaki alış/maliyet fiyatı.
- **Kâr = Ciro − Maliyet − Masraf** (`MASRAF` düşülür).
- `STOKTIPI NOT IN (12,13,14)` = hizmet/masraf/promosyon satırları hariç.
- İki oran: **marj** = kâr/**ciro**×100 (satış üzeri); **karOrani** = kâr/**maliyet**×100
  (Arctos'un gösterdiği, markup on cost). İkisini de göster.
- Not: F0101D0015'te STOKTIPI 12/13/14 yok, DETAY hep 0, MASRAF=0 → bu veride fark yok (latent);
  masraf/hizmet/set ürün olan veride önemli.

Fatura → stok: `TBLSTOKHAREKETLERI` (GIREN/CIKAN=ENVANTER, BIRIMMALIYET; giriş faturasında
maliyet `AFIYATI/BIRIMMIKTAR`). İrsaliye/sipariş: `TBLALSIP*`/`TBLVERSIP*`/`TBLBELGELEME`.

---

## 9. Döviz / KUR

- Bu DB'de tüm kasa/banka `PARABIRIMI='TL'`, `KUR≈1`. Döviz kasaları yalnızca **hesap adında**
  belli (İÇ KASA EURO/DOLAR/STERLİN/FRANK, HALKBANK-STERLİN).
- `PARABIRIMI` bazen sembol (`€`,`$`,`£`,`₺`) kayıtlı → koda çevir.
- Arctos tutarları çoğu yerde `/KUR` ile kendi para birimine indirger (`GROUP BY PARABIRIMI`).
- Uygulamada `detectDoviz(ad, parabirimi)` döviz alanını isimden/sembolden çıkarır; döviz
  bakiyeleri TL toplamına karıştırılmaz, ayrı gösterilir.

---

## 10. Bağlantı / config

- Config: `%APPDATA%/vega-sorgu-desktop/config.json` (server/db/user/port + **şifreli parola**).
- Parola `AES-256-CBC`, sabit anahtar `APP_SECRET` v3 (makineden bağımsız). Eski v2 (hostname'e
  bağlı) config'ler ilk açılışta v3'e migrate edilir.
- Bu makinede SQL auth (`sa`) config'te şifreli **kayıtlı ve çalışıyor**; Windows auth gerekmez.
- Uygulama PIN'siz: açılışta `/api/bootstrap` ile config'ten otomatik bağlanır.
- Tablo adı doğrulama `validateTableName(name, includeViews=false)` — VARES* için `true` şart.

---

## 11. Özet — hangi rakam nereden

| Ekran / kart | Kaynak | Formül (özet) |
|---|---|---|
| Toplam/Günlük Nakit (Kasa) | `TBLKASA` | `SUM((GELIR-GIDER)/KUR)` · ISLEMTIPI=1 · KREDIKASA hariç |
| Banka bakiyesi/toplam | `TBLBANKAHAREKETLERI` + `TBLBANKALAR` | `SUM((BORC-ALACAK)/KUR)` · MUSBANKA=0 · STATUS<>2 |
| Çek/Senet portföy | `VARES{ALINAN\|VERILEN}{CEKLER\|SENETLER}` | `SUM(TUTAR)` (ALINAN=varlık, VERILEN=borç) |
| Cari bakiye | `TBLCARIHAREKETLERI` | `SUM(BORC-ALACAK)` · KREDIHESABI hariç |
| Ciro / Tahsilat / Alış | `TBLCARIHAREKETLERI` | IZAHAT 21(BORC) / 13(ALACAK) / 20(ALACAK) |
| Satış kârlılık | `TBLSATFATHAREKET` | ciro−maliyet(AFIYATI×MIKTAR)−masraf · STOKTIPI∉(12,13,14) · DETAY=0 |

> Yeni bir rakam ekleyeceksen: (1) Arctos'ta o ekranı aç, (2) İzleyici ile SQL'i yakala,
> (3) formülü buraya ekle, (4) uygulamada aynısını kur, (5) canlı veriyle karşılaştır.
