# Uçtan Uca Analiz Algoritması

Arctos/Vega ham tablolarından başlayıp **"şirket yüzde kaç büyüyor, finansal durumu şu an nasıl?"**
sorusunun tek ekranlık cevabına kadar olan zincir. Her adım koddadır (`cloud/src/engine/`) ve
testlerle Arctos'un kendi formüllerine karşı doğrulanır (`cloud/test/engine.test.js`).

```
 SQL Server (VEGADB)                    Vega Bulut
 ┌──────────────────┐  köprü   ┌───────────────────────────────────────────────────────────────┐
 │ TBLCARIHAREKET   │  (15 dk) │ 1 Kanonik veri ─► 2 Dönem/devir ─► 3 Ölçüler (35) ──► Raporlar │
 │ TBLKASAHAREKET   │ ───────► │                                     │                (1.085)   │
 │ TBLBANKAHAREKET  │          │ 4 Anlık durum (bilanço) ◄───────────┤                          │
 │ F…D…TBLSTOKHAR…  │          │ 5 Döngü oranları ◄──────────────────┤                          │
 │ VARES çek/senet  │          │ 6 Büyüme Endeksi ◄──────────────────┤                          │
 │ …                │          │ 7 Finansal Sağlık Skoru ◄── 4+5+6   │                          │
 └──────────────────┘          │ 8 Nakit projeksiyonu ◄── 4+portföy  │                          │
                               │ 9 Uyarılar ◄── hepsi                                           │
                               └───────────────────────────────────────────────────────────────┘
```

Önbellek: tüm sonuçlar `(firma, veri sürümü, istek, gün)` anahtarıyla saklanır; köprü yeni veri
getirmedikçe hiçbir şey yeniden hesaplanmaz. Genel durum ekranı ~0,5 sn'de, tek rapor ortalama ~20 ms'de hesaplanır.

---

## 1. Kanonik veri

Köprü, Arctos'un firma/dönem bazlı tablolarını (`F0101D0017TBLCARIHAREKET` vb.) 14 **kanonik veri
kümesine** çevirir (`shared/datasets.js`): `firma, donem, cari, stok, banka, cari_hareket,
kasa_hareket, banka_hareket, satis, alis, siparis, taksit, cek_senet, stok_durum`.

Alım sırasında türetilenler:

| Alan | Kural |
|---|---|
| `kasa_hareket.dv`, `banka.dv` | Hesap/kasa adından ya da para biriminden döviz tespiti (`EURO`, `DOLAR`, `€`, `STERLİN`…). Döviz hesapları TL toplamlarına **karışmaz**; kendi biriminde, TCMB kuru varsa TL karşılığıyla ayrıca gösterilir. |
| `kasa_hareket.devir`, `banka_hareket.devir` | Açıklamada `DEVİR/DEVR` ya da banka IZAHAT 113/114 → açılış devri satırı. |

## 2. Dönem ve devir (çift sayımı önleme)

Arctos her mali yılı ayrı **dönem** tablolarında tutar ve yeni dönemi önceki yılın kapanış
bakiyeleriyle **devir** satırlarıyla açar (genellikle 31 Aralık tarihli). Naif bir toplama devirleri
iki kez sayar. Kurallar:

- **Bakiyeler** (kasa, banka, cari) her tarih için *o tarihi kapsayan tek dönemden* okunur: dönem Y,
  kendi ilk satır tarihinden (devir, genelde (Y−1)-12-31) başlar ve bir sonraki dönem başlayana kadar
  sürer; başlangıç `[(Y−1)-12-25, Y-01-10]` aralığına sıkıştırılır (tek tük hatalı tarihler kapsamı
  bozmasın). Yeni yıl dönemi henüz açılmamışsa önceki dönem devam eder. Sonuç: 30 Aralık → 31 Aralık →
  1 Ocak bakiyeleri kesintisizdir (testle doğrulanır: günlük fark = o günün devir hariç gerçek hareketi,
  5 kuruş tolerans).
- **Akışlar** (ciro, tahsilat, ödeme…) tarih aralığıyla tüm dönemlerden okunur; devir IZAHAT'ları
  (103/104) ve devir satırları hariç tutulur.
- **Etkin dönem**: bugünü kapsayan en yeni dönem (önceden açılmış gelecek yıl dönemi seçilmez).

## 3. Ölçüler (Arctos formülleri)

| Ölçü | Formül (kaynak) |
|---|---|
| Satış | `SUM(BORC − ALACAK)`, IZAHAT 21 (cari hareket; KDV dahil) |
| Satış iadesi | IZAHAT 23 |
| Net ciro | Satış − iade |
| Tahsilat | `SUM(ALACAK − BORC)`, IZAHAT 13 + 83 |
| Tediye (ödeme) | IZAHAT 11 + 84 |
| Alış | IZAHAT 20 |
| Net satış (ürün) | Stok hareketlerinden `GERCEKTOPLAM`; `STOKTIPI ∉ {12,13,14}`, `DETAY = 0`, iptal hariç, iade eksi, döviz × KUR |
| Brüt kâr | Net satış − `MIKTAR × AFIYATI` − `MASRAF` (Arctos kâr analizi) |
| Kasa bakiyesi | `SUM(GELIR − GIDER) / KUR`, `ISLEMTIPI = 1`, `KREDIKASA` hariç, döviz kasalar ayrı |
| Banka bakiyesi | `SUM(BORC − ALACAK) / KUR`, `MUSBANKA = 0`, `STATUS ≠ 2` (pasif), döviz hesaplar ayrı; eksi bakiyeli hesaplar **kredi** |
| Cari bakiye | Müşteri bazında `SUM(BORC − ALACAK)`; `OZELKOD = 'KREDIHESABI'` ve personel (`OZELKOD5 = 'PERSONELCARI'` ya da `FIRMATIPI ∈ {11,12}`) hariç; artılar **alacak**, eksiler **borç** |
| Stok değeri | `SUM(ENVANTER) × MALIYET`, `BELGETIPI ≠ 67`, `IND ≥ 100`, `TIP ∉ {3,7,9}`, pasif hariç |
| Çek/senet portföyü | VARES görünümleri; alınan açık = durumu "Tahsilat Yok", verilen açık = "Ödenecek" |

IZAHAT eşlemesi firma ayarlarından değiştirilebilir (ör. satış irsaliyesini ciroya katmak için 27).
Toplam **35 ölçü**, **16 boyut** (müşteri, il, cari grubu, temsilci, ürün, sınıf, marka, tür, satıcı,
kasa, şube, banka hesabı, firma, haftanın günü, ay, saat) — ayrıntı: [RAPORLAR.md](RAPORLAR.md).

## 4. Anlık finansal durum (operasyonel bilanço)

Bugünün bakiyelerinden, muhasebe bilançosu beklenmeden:

| Varlıklar | Yükümlülükler |
|---|---|
| Kasa (TL, ≥ 0) | Tedarikçi borçları (cari eksi bakiyeler) |
| Banka (artı bakiyeli hesaplar) | Verilen çek/senet (açık) |
| Döviz (kasa + banka, TCMB kuruyla TL) | Banka kredileri (eksi bakiyeli hesaplar) |
| Müşteri alacakları | Kasa açığı (eksi kasa) |
| Alınan çek/senet (açık) | |
| Stok (maliyetle) | |

- **Likit** = kasa + banka + döviz · **Net nakit** = kasa + banka (kredi düşülmüş)
- **Net işletme sermayesi** = varlıklar − yükümlülükler
- **Cari oran** = varlıklar / yükümlülükler · **Asit-test** = (likit + alacak + alınan çek/senet) / yükümlülükler · **Nakit oranı** = likit / yükümlülükler

## 5. Döngü ve risk oranları

Hepsi son 365 gün (veri daha kısaysa mevcut günlere göre yıllıklandırılmış):

| Oran | Tanım |
|---|---|
| DSO — tahsil süresi | alacak / (yıllık satış / 365) |
| DPO — ödeme süresi | borç / (yıllık alış / 365) |
| DIO — stok süresi | stok / (yıllık satılan malın maliyeti / 365) |
| Nakit dönüşüm süresi | DSO + DIO − DPO |
| Nakit yeterliliği (gün) | likit / (son 90 günün tediye + kasa giderleri / 90) |
| Tahsilat oranı (90 gün) | tahsilat / satış, son 90 gün |
| Vadesi geçen alacak | **FIFO yaşlandırma**: her müşterinin bakiyesi en yeni faturalarına dağıtılır; vadesi geçmiş kısım / toplam alacak |
| Brüt marj ve eğilimi | son 365 gün marjı; son 90 gün marjı − geçen yılın aynı 90 günü (puan) |
| Zararına satış payı | son 90 günde kâr < 0 olan ürünlerin cirosu / toplam |
| Müşteri yoğunlaşması | ilk 5 müşterinin son 365 gün satış payı (+ HHI) |
| Satış oynaklığı | son 12 tam ayın aylık net cirosunun değişim katsayısı (σ/μ) |
| Kaldıraç | (banka kredisi + verilen çek/senet) / (likit + alacak + alınan çek/senet) |
| 30 gün vade karşılama | (likit + 30 günde tahsil edilecek çek/senet) / (30 günde ödenecek + vadesi geçmiş verilen) |

## 6. Büyüme Endeksi — "şirket yüzde kaç büyüyor?"

**Ufuk** (veri geçmişine göre; mevsimselliği dışlamak için yıllık karşılaştırma önceliklidir):

| Ufuk | Karşılaştırma | Koşul | Güven |
|---|---|---|---|
| `ttm` | son 365 gün ↔ önceki 365 gün | ~2 yıllık veri (45 gün tolerans) | yüksek |
| `ytd` | yıl başı→bugün ↔ geçen yılın aynı dönemi | geçen yıl başından beri veri ve YTD ≥ 60 gün | orta |
| `3a` | son 90 gün ↔ önceki 90 gün | son ~180 günü kapsayan veri | düşük (mevsim etkisi) |

**Bileşik büyüme** (aynı ufukta dört bileşen):

| Bileşen | Ağırlık | Taban eşiği |
|---|---:|---|
| Net ciro | %40 | 1.000 ₺ |
| Brüt kâr | %30 | 1.000 ₺ |
| Tahsilat | %20 | 1.000 ₺ |
| Aktif müşteri sayısı | %10 | 3 |

- Her bileşen büyümesi `g = (şimdi − önce) / |önce|` (taban eşiğin altındaysa hesaplanmaz; negatif
  tabanda işaret korunur) ve **[−%95, +%300]** aralığına kırpılır; eksik bileşenlerde ağırlıklar yeniden ölçeklenir.
- **Reel büyüme** = (1 + g) / (1 + TÜFE) − 1 (TÜFE firma ayarından; `3a` ufkunda 90 güne oranlanır).
- **İvme** = son 90 günün yıllık büyümesi − ufuk büyümesi; > +5 puan *hızlanıyor*, < −5 puan *yavaşlıyor*.
- **Eğilim**: son 24 ayın aylık net cirosunda log-ölçekli **Theil–Sen** eğimi (aykırı aylara dayanıklı), yıllıklandırılmış.
- **Tahmin** (3 ay): ≥ 24 ay veri → **Holt-Winters** (toplamsal eğilim ve 12 aylık mevsim); ≥ 6 ay → **Holt** (eğilim); hata payından alt/üst bant.
- **Yıl sonu tahmini** = YTD + geçen yılın kalan kısmı × (1 + g), g = (YTD büyümesi + son 90 günün yıllık büyümesi) / 2.
- Detay kartları: bu ay ↔ geçen yıl bu ay, bu ay ↔ geçen ay (aynı gün sayısı), YTD, TTM, son 90 gün.

## 7. Finansal Sağlık Skoru (0–100)

Beş sütun; her ölçüt **parçalı-doğrusal** çapa noktalarıyla 0–100 puana çevrilir, sütun puanı
ölçütlerin ortalamasıdır, genel skor sütunların ağırlıklı ortalamasıdır. Veri olmayan ölçüt/sütun
hesaba katılmaz (ağırlıklar yeniden ölçeklenir).

| Sütun | Ağırlık | Ölçüt → çapa noktaları (değer → puan) |
|---|---:|---|
| **Likidite** | %25 | Cari oran 0,5→0 · 1→45 · 1,5→75 · 2→90 · 3→100 · Asit-test 0,3→0 · 0,7→45 · 1→70 · 1,5→95 · 2→100 · Nakit yeterliliği (gün) 5→0 · 15→30 · 30→55 · 60→80 · 90→100 · 30 gün vade karşılama 0,5→0 · 1→50 · 1,5→80 · 2,5→100 |
| **Kârlılık** | %20 | Brüt marj (sektör eşikleriyle) · Marj eğilimi (puan) −5→0 · −2→35 · 0→60 · +2→85 · +4→100 · Zararına satış payı 0→100 · %2→80 · %10→30 · %20→0 |
| **Büyüme** | %20 | Reel büyüme (TÜFE yoksa nominal) −%30→0 · −%10→30 · 0→50 · +%10→75 · +%25→100 · Müşteri tabanı aynı ölçek · İvme −20→0 · −5→40 · 0→55 · +5→75 · +20→100 (puan) |
| **Tahsilat & Döngü** | %20 | DSO 15→100 · 30→85 · 60→60 · 90→35 · 150→0 · Tahsilat oranı %60→0 · %85→50 · %95→75 · %100→90 · %110→100 · Vadesi geçen alacak 0→100 · %10→75 · %25→45 · %50→0 · Nakit dönüşüm süresi 0→100 · 30→85 · 60→65 · 120→30 · 180→0 |
| **Risk** | %15 | İlk 5 müşteri payı %20→100 · %35→75 · %50→50 · %70→15 · %85→0 · Satış oynaklığı 0,1→100 · 0,25→75 · 0,4→50 · 0,6→20 · 0,8→0 · Kaldıraç 0→100 · 0,25→80 · 0,5→55 · 1→20 · 1,5→0 · Vadesi geçen alınan çek 0→100 · %5→70 · %15→35 · %30→0 |

Brüt marj eşikleri sektöre göredir (firma ayarı): ör. toptan %0 · %5 · %12 · %20, perakende %0 · %10 · %22 · %35,
hizmet %0 · %15 · %35 · %55 → 0 · 40 · 75 · 100 puan.

**Not**: ≥ 80 **A** (çok iyi) · 65–79 **B** (iyi) · 50–64 **C** (orta) · 35–49 **D** (zayıf) · < 35 **E** (kritik).

**"Neden bu skor?"**: her ölçütün etkisi `(puan − 50) × sütun ağırlığı / sütundaki ölçüt sayısı`
ile hesaplanır; en olumlu 4 ve en olumsuz 4 ölçüt, kendi cümlesiyle ekranda gösterilir
(ör. *"Alacakların %31'i vadesini geçmiş."*). **Güven**: büyüme ufku ve ölçüt kapsamına göre yüksek/orta/düşük.

## 8. Nakit projeksiyonu (90 gün)

İki şeffaf çizgi, başlangıç = bugünkü likit:

- **Vade takvimi (kesin)**: + portföydeki alınan çek/senet (vadesinde) + gelecek taksitler
  − verilen çek/senet (vadesi geçmişse bugün). Vadesi geçmiş alınan çek/senet katılmaz, **risk** olarak ayrı gösterilir.
- **Olağan akış (beklenen)**: günlük (son 90 günün tahsilatı − tediye ve kasa giderleri) / 90 ×
  **mevsim katsayısı** (geçen yıl önümüzdeki 90 günün günlük tahsilatı / geçen yıl önceki 90 günün; [0,6 – 1,6] aralığında).
- Çıktılar: en düşük nokta ve tarihi, ilk açık tarihi, dönem sonu değerleri.

## 9. Uyarılar (kural tabanlı, açıklanabilir)

| Seviye | Kural |
|---|---|
| kritik | Veri 3 saatten eski (1–3 saat: uyarı) · TL kasa eksi bakiyede · Kesin projeksiyon 30 gün içinde eksiye düşüyor · 7 gün içindeki ödemeler likiti aşıyor · Ödenmemiş vadesi geçmiş verilen çek/senet · Nakit yeterliliği < 15 gün |
| uyarı | Vadesi geçmiş tahsil edilmemiş çek/senet · 90 gün tahsilat oranı < %85 · Vadesi geçen alacak > %25 · Kredi limitini aşan müşteriler · Hareketsiz alacaklar · Bu ay satış (≥ 7. gün) geçen yıla göre > %15 geride · Reel küçülme > %10 · Brüt marj > 3 puan geriledi · Zararına satılan ürünler · Tek müşteri > %25 |
| bilgi | Büyüme yavaşlıyor · Sipariş girişi > %20 azaldı · Dün olağanüstü satış (son 8 aynı günün z-skoru ≥ 3) · Eksi stok · Maliyeti girilmemiş ürünler · Enflasyon oranı girilmemiş |

Her uyarı: başlık, cümle, değer, ilgili rapor kimliği (panelde tıklanınca açılır).

## 10. Segmentasyon

- **ABC (Pareto)**: cironun ilk %80'i A, sonraki %15'i B, kalanı C (müşteri ve ürün).
- **RFM**: son 365 gün; yakınlık (gün), sıklık (fatura), tutar (ciro) beşte-birlik puanlarıyla
  *Şampiyon · Sadık · Yeni · Potansiyel · Risk altında · Uykuda · Ortalama*.
- **Yeni / kayıp / geri dönen** müşteriler, **alacak yaşlandırma** (FIFO; 1-30, 31-60, 61-90, 90+ gün).

## 11. Doğrulama

`cloud/test/engine.test.js` motoru doğrudan SQL ile yazılmış Arctos formüllerine karşı sınar:
kasa/banka/cari bakiyeleri, kârlılık, devir sürekliliği, akışlarda devir dışlama, firma konsolidasyonu,
IZAHAT eşlemesi. `catalog.test.js` 1.085 raporun tamamını çalıştırır (hata, NaN/Infinity yok).
`bridge/test/e2e-mssql.test.js` gerçek SQL Server'dan köprüyle gelen verinin JS kahiniyle birebir
aynı olduğunu ve motor çıktılarının değişmediğini doğrular.
