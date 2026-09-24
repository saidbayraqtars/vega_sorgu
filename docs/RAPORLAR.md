# Rapor Kataloğu — 1.085 rapor

> Bu belge `node cloud/scripts/raporlar-md.js` ile koddan üretilir; elle düzenlemeyin.
> Her rapor panelde bir kutu olarak panoya eklenebilir; grafik türü, dönem ve N (ilk kaç) kullanıcı tarafından değiştirilebilir.

Raporlar üç kaynaktan oluşur:

1. **Ölçü × görünüm** — 35 ölçünün her biri gösterge, eğilim, geçen yılla karşılaştırma, birikimli, ısı haritası, mevsimsellik görünümleriyle;
2. **Ölçü × boyut × görünüm** — ölçüler 16 boyutta (müşteri, ürün, il, temsilci, kasa, banka hesabı…) sıralama, pay, karşılaştırma, Pareto ve dağılım olarak;
3. **Özel analizler** — 46 rapor: sağlık skoru, büyüme endeksi, anlık bilanço, nakit projeksiyonu, yaşlandırma, RFM, ABC, vade takvimi, tahmin…

Toplam: 1.039 ölçü tabanlı + 46 özel = **1.085** rapor.

## Kategoriler

| Kategori | Simge | Rapor |
|---|---|---:|
| Genel Durum | `Gauge` | 10 |
| Satış | `ShoppingCart` | 138 |
| Kârlılık | `PiggyBank` | 206 |
| Müşteriler | `Users` | 49 |
| Ürünler | `Package` | 144 |
| Stok | `Warehouse` | 5 |
| Tahsilat & Alacak | `HandCoins` | 153 |
| Alış & Tedarik | `Truck` | 131 |
| Kasa | `Wallet` | 95 |
| Banka | `Landmark` | 63 |
| Çek & Senet | `Ticket` | 6 |
| Sipariş | `ClipboardList` | 82 |
| Veri Kontrolü | `ShieldCheck` | 3 |

## Görünümler

| Görünüm | Açıklama | Rapor |
|---|---|---:|
| Gösterge | Tek sayı; önceki dönem ve geçen yılın aynı dönemiyle değişim, mini grafik | 35 |
| Eğilim | Zaman serisi (gün · hafta · ay · çeyrek · yıl kırılımı) | 175 |
| Geçen yılla | Bu dönem ile geçen yılın aynı dönemi üst üste | 105 |
| Birikimli | Yıl başından birikimli toplam, geçen yılın eğrisiyle | 24 |
| Isı haritası | Haftanın günü × hafta: yoğun ve durgun günler | 24 |
| Mevsimsellik | Ay × yıl ısı haritası | 35 |
| Sıralama | Boyuta göre en yüksek N (ör. en çok satan 10 ürün) + diğerleri | 205 |
| Pay | Toplam içindeki paylar (pasta · ağaç haritası) | 125 |
| Karşılaştırma | Önceki döneme göre en çok artan / azalanlar | 205 |
| Pareto / ABC | Kümülatif pay ve A-B-C sınıfları | 22 |
| Dağılım | Haftanın günü, ay, saat gibi takvim kırılımları | 84 |
| Özel | Aşağıdaki özel analizler | 46 |

## Ölçüler (35)

| Ölçü | Birim | Kategori | Kırılabildiği boyutlar | Tanım |
|---|---|---|---|---|
| **Satış (KDV dahil)** `satis` | TL | Satış | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay, Saat | Satış faturalarının cariye yansıyan genel toplamı (IZAHAT 21, BORÇ). KDV dahildir. |
| **Satış İadesi** `satis_iade` | TL | Satış | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay, Saat | Satış iadelerinin cariye yansıyan tutarı (IZAHAT 23). |
| **Net Ciro (KDV dahil)** `net_ciro` | TL | Satış | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay, Saat | Satış − iade (KDV dahil). |
| **Satış Faturası Sayısı** `fatura_sayisi` | adet | Satış | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay, Saat | Dönemde kesilen farklı satış faturası sayısı. |
| **Ortalama Fatura Tutarı** `ort_fatura` | TL | Satış | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay, Saat | Satış tutarı / fatura sayısı (KDV dahil). |
| **Aktif Müşteri** `aktif_musteri` | adet | Müşteriler | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay, Saat | Dönemde en az bir satış faturası kesilen farklı müşteri sayısı. |
| **Müşteri Başına Satış** `musteri_basi` | TL | Müşteriler | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay, Saat | Satış / aktif müşteri sayısı. |
| **Tahsilat** `tahsilat` | TL | Tahsilat & Alacak | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay, Saat | Müşterilerden alınan ödemeler: cari giriş bordrosu (13) + havale (83). Nakit, çek, senet, kart, havale hepsi. |
| **Bordro Tahsilatı** `tahsilat_bordro` | TL | Tahsilat & Alacak | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay, Saat | Cari giriş bordrosuyla alınan tahsilatlar (IZAHAT 13). |
| **Havale Tahsilatı** `tahsilat_havale` | TL | Tahsilat & Alacak | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay, Saat | Bankaya gelen havale/EFT ile kapanan alacaklar (IZAHAT 83). |
| **Tahsilat Oranı** `tahsilat_orani` | % | Tahsilat & Alacak | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay, Saat | Tahsilat / satış × 100. %100'ün altı alacağın büyüdüğünü gösterir. |
| **Alış (KDV dahil)** `alis` | TL | Alış & Tedarik | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay, Saat | Alış faturalarının cariye yansıyan genel toplamı (IZAHAT 20, ALACAK). KDV dahildir. |
| **Ödeme (Tediye)** `tediye` | TL | Alış & Tedarik | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay, Saat | Tedarikçilere yapılan ödemeler: cari çıkış bordrosu (11) + banka ödemesi (84). |
| **Net Satış (KDV hariç)** `net_satis` | TL | Kârlılık | Müşteri, İl, Cari Grubu, Temsilci, Ürün, Ürün Sınıfı, Marka, Ürün Türü, Satış Personeli, Firma, Haftanın Günü, Ay | Satış faturası satırlarının toplamı (GERCEKTOPLAM). Hizmet/masraf/promosyon satırları ve iptaller hariç. |
| **Satılan Malın Maliyeti** `maliyet` | TL | Kârlılık | Müşteri, İl, Cari Grubu, Temsilci, Ürün, Ürün Sınıfı, Marka, Ürün Türü, Satış Personeli, Firma, Haftanın Günü, Ay | Σ miktar × AFIYATI (satış anındaki birim maliyet). |
| **Brüt Kâr** `brut_kar` | TL | Kârlılık | Müşteri, İl, Cari Grubu, Temsilci, Ürün, Ürün Sınıfı, Marka, Ürün Türü, Satış Personeli, Firma, Haftanın Günü, Ay | Net satış − maliyet − masraf (Arctos kâr analizi formülü). |
| **Brüt Kâr Marjı** `brut_marj` | % | Kârlılık | Müşteri, İl, Cari Grubu, Temsilci, Ürün, Ürün Sınıfı, Marka, Ürün Türü, Satış Personeli, Firma, Haftanın Günü, Ay | Brüt kâr / net satış × 100 (satış üzeri marj). |
| **Kâr Oranı (maliyet üzeri)** `kar_orani` | % | Kârlılık | Müşteri, İl, Cari Grubu, Temsilci, Ürün, Ürün Sınıfı, Marka, Ürün Türü, Satış Personeli, Firma, Haftanın Günü, Ay | Brüt kâr / maliyet × 100 — Arctos'un 'KAR' olarak gösterdiği oran. |
| **Satış Miktarı** `miktar` | adet | Ürünler | Müşteri, İl, Cari Grubu, Temsilci, Ürün, Ürün Sınıfı, Marka, Ürün Türü, Satış Personeli, Firma, Haftanın Günü, Ay | Satılan toplam miktar (birim karışık olabilir). |
| **Satılan Ürün Çeşidi** `urun_cesidi` | adet | Ürünler | Müşteri, İl, Cari Grubu, Temsilci, Ürün, Ürün Sınıfı, Marka, Ürün Türü, Satış Personeli, Firma, Haftanın Günü, Ay | Dönemde satılan farklı ürün sayısı. |
| **Fatura Başına Kalem** `sepet` | adet | Ürünler | Müşteri, İl, Cari Grubu, Temsilci, Ürün, Ürün Sınıfı, Marka, Ürün Türü, Satış Personeli, Firma, Haftanın Günü, Ay | Ortalama fatura satırı sayısı. |
| **Ortalama Birim Fiyat** `birim_fiyat` | TL | Ürünler | Müşteri, İl, Cari Grubu, Temsilci, Ürün, Ürün Sınıfı, Marka, Ürün Türü, Satış Personeli, Firma, Haftanın Günü, Ay | Net satış / miktar. |
| **Alış (KDV hariç, satır)** `alis_net` | TL | Alış & Tedarik | Müşteri, İl, Ürün, Ürün Sınıfı, Marka, Firma, Haftanın Günü, Ay | Alış faturası satırları toplamı (KDV hariç). |
| **Alış Miktarı** `alis_miktar` | adet | Alış & Tedarik | Müşteri, İl, Ürün, Ürün Sınıfı, Marka, Firma, Haftanın Günü, Ay | Alınan toplam miktar. |
| **Kasa Girişi** `kasa_giris` | TL | Kasa | Kasa, Şube, Firma, Haftanın Günü, Ay | Kasaya giren fiziksel nakit (ISLEMTIPI=1, açılış devri ve virman hariç). |
| **Kasa Çıkışı** `kasa_cikis` | TL | Kasa | Kasa, Şube, Firma, Haftanın Günü, Ay | Kasadan çıkan fiziksel nakit. |
| **Kasa Net Akışı** `kasa_net` | TL | Kasa | Kasa, Şube, Firma, Haftanın Günü, Ay | Kasa girişi − çıkışı (TL kasalar). |
| **Banka Girişi** `banka_giris` | TL | Banka | Banka Hesabı, Firma, Haftanın Günü, Ay | TL banka hesaplarına giren tutar (devir hariç). |
| **Banka Çıkışı** `banka_cikis` | TL | Banka | Banka Hesabı, Firma, Haftanın Günü, Ay | TL banka hesaplarından çıkan tutar. |
| **Banka Net Akışı** `banka_net` | TL | Banka | Banka Hesabı, Firma, Haftanın Günü, Ay | Banka girişi − çıkışı (TL hesaplar, müşteri bankaları hariç). |
| **Ticari Nakit Dengesi** `ticari_denge` | TL | Tahsilat & Alacak | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay, Saat | Müşteri tahsilatları − tedarikçi ödemeleri. Ticari faaliyetin ürettiği net nakit. |
| **Kasa Masrafları (cari dışı)** `kasa_gider_diger` | TL | Kasa | Kasa, Şube, Firma, Haftanın Günü, Ay | Kasadan tedarikçi ödemesi dışında çıkan nakit (masraf, maaş, avans vb.). |
| **Alınan Sipariş Tutarı** `siparis_tutar` | TL | Sipariş | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay | Müşterilerden alınan siparişlerin toplamı (iptaller hariç). Ciroya dönüşecek talebin öncü göstergesi. |
| **Sipariş Sayısı** `siparis_sayisi` | adet | Sipariş | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay | Alınan sipariş adedi (iptaller hariç). |
| **Ortalama Sipariş** `siparis_ort` | TL | Sipariş | Müşteri, İl, Cari Grubu, Temsilci, Firma, Haftanın Günü, Ay | Sipariş tutarı / sipariş sayısı. |

## Boyutlar (16)

| Boyut | Simge |
|---|---|
| Müşteri `cari` | `User` |
| İl `il` | `MapPin` |
| Cari Grubu `grup` | `Group` |
| Temsilci `temsilci` | `BadgeCheck` |
| Ürün `urun` | `Package` |
| Ürün Sınıfı `sinif` | `Shapes` |
| Marka `marka` | `Award` |
| Ürün Türü `tur` | `Layers` |
| Satış Personeli `satici` | `UserRound` |
| Kasa `kasa` | `Wallet` |
| Şube `sube` | `Building2` |
| Banka Hesabı `hesap` | `Landmark` |
| Firma `firma` | `Building` |
| Haftanın Günü `haftagunu` | `CalendarDays` |
| Ay `ayadi` | `CalendarRange` |
| Saat `saat` | `Clock` |

## Özel analizler (46)

| Rapor | Kimlik | Sonuç | Açıklama |
|---|---|---|---|
| **Finansal Sağlık Skoru** | `ozel.saglik` | Sağlık skoru | Likidite, kârlılık, büyüme, tahsilat ve risk ölçütlerinden 0-100 skor. |
| **Büyüme Endeksi** | `ozel.buyume` | Büyüme endeksi | Net ciro, brüt kâr, tahsilat ve müşteri tabanının yıllık büyümesi; enflasyondan arındırılmış reel büyüme. |
| **Anlık Finansal Durum** | `ozel.finansal_durum` | Bilanço | Kasa, banka, alacak, çek/senet ve stok varlıkları ile borç, verilen çek/senet ve kredi yükümlülükleri. |
| **Nakit Projeksiyonu (90 gün)** | `ozel.nakit_projeksiyonu` | Projeksiyon | Vade takvimine göre kesin ve geçmiş ortalamalara göre beklenen nakit seyri. |
| **Uyarılar** | `ozel.uyarilar` | Tablo | Kural tabanlı uyarıların tümü. |
| **Döngü ve Verimlilik Oranları** | `ozel.oranlar` | Tablo | DSO, DPO, DIO, nakit dönüşüm süresi, nakit yeterliliği, tahsilat oranı, yoğunlaşma. |
| **Bugünün Özeti** | `ozel.gun_ozeti` | Tablo | Bugün kesilen fatura, satış, tahsilat, kasa ve banka hareketleri. |
| **Aylık Kapanış Tablosu** | `ozel.ay_kapanis` | Tablo | Her ay için satış, tahsilat, alış, ödeme, brüt kâr ve marj. |
| **Yıl-Yıl Karşılaştırma** | `ozel.yil_karsilastirma` | Tablo | Bu yılın her ayı geçen yılın aynı ayıyla. |
| **Satış Tahmini (3 ay)** | `ozel.tahmin` | Zaman serisi | Holt-Winters (mevsimsel) veya Holt (eğilim) ile önümüzdeki 3 ayın net ciro tahmini. |
| **Kasa Bakiyeleri** | `ozel.kasa_durumu` | Kırılım | Kasa bazında nakit bakiye (Arctos 'Toplam Kasa Bakiyesi' formülü). Döviz kasaları kendi biriminde. |
| **Banka Hesap Bakiyeleri** | `ozel.banka_durumu` | Kırılım | Aktif hesapların bakiyesi (müşteri bankaları ve pasif hesaplar hariç). Eksi bakiye = kredi kullanımı. |
| **Kasa Bakiyesi Seyri** | `ozel.kasa_bakiye_seyri` | Zaman serisi | Dönem sonu bakiyeleri (açılış devri dahil, dönemler toplanmadan). |
| **Banka Bakiyesi Seyri** | `ozel.banka_bakiye_seyri` | Zaman serisi | Dönem sonu bakiyeleri (açılış devri dahil, dönemler toplanmadan). |
| **Likidite Seyri (Kasa + Banka)** | `ozel.likidite_seyri` | Zaman serisi | Kasa ve banka net bakiyelerinin toplamı. |
| **Döviz Pozisyonu** | `ozel.doviz` | Tablo | Döviz kasa ve hesapları kendi para biriminde (TL toplamına karışmaz). |
| **Alacak Yaşlandırma** | `ozel.alacak_yaslandirma` | Grafik + tablo | Açık alacaklar vadesine göre (FIFO: bakiye en yeni faturalara dağıtılır). |
| **Borçlu Müşteriler** | `ozel.borclu_musteriler` | Tablo | Bize borcu olan cariler (aktif dönem bakiyesi, KREDIHESABI ve personel hariç). |
| **Borçlu Olduğumuz Cariler** | `ozel.alacakli_tedarikciler` | Tablo | Tedarikçilere olan borçlar (eksi bakiyeler). |
| **Hareketsiz Alacaklar** | `ozel.hareketsiz_alacak` | Tablo | 90 günden uzun süredir hareketi olmayan ama bakiyesi olan müşteriler. |
| **Kredi Limiti Aşımı** | `ozel.limit_asimi` | Tablo | Bakiyesi cari kartındaki kredi limitini aşan müşteriler. |
| **Tahsil Süresi (DSO) Seyri** | `ozel.dso_seyri` | Zaman serisi | Her ay sonu: alacak / (son 90 günün satışı / 90). |
| **Alacak ve Borç Seyri** | `ozel.alacak_borc_seyri` | Zaman serisi | Ay sonları itibarıyla toplam ticari alacak ve borç. |
| **Alınan Çekler (Portföy)** | `ozel.cek_alinan` | Tablo | Alınan Çekler (Portföy): yalnız açık olanlar (VARES görünümü; alınanlarda 'Tahsilat Yok', verilenlerde 'Ödenecek'). |
| **Verilen Çekler (Ödenecek)** | `ozel.cek_verilen` | Tablo | Verilen Çekler (Ödenecek): yalnız açık olanlar (VARES görünümü; alınanlarda 'Tahsilat Yok', verilenlerde 'Ödenecek'). |
| **Alınan Senetler** | `ozel.senet_alinan` | Tablo | Alınan Senetler: yalnız açık olanlar (VARES görünümü; alınanlarda 'Tahsilat Yok', verilenlerde 'Ödenecek'). |
| **Verilen Senetler** | `ozel.senet_verilen` | Tablo | Verilen Senetler: yalnız açık olanlar (VARES görünümü; alınanlarda 'Tahsilat Yok', verilenlerde 'Ödenecek'). |
| **Vade Takvimi (Haftalık)** | `ozel.vade_takvimi` | Zaman serisi | Önümüzdeki 12 haftada tahsil edilecek ve ödenecek çek/senetler. |
| **Alınan Çekler — Banka Dağılımı** | `ozel.cek_banka` | Kırılım | Portföydeki alınan çeklerin keşideci bankalara dağılımı. |
| **Müşteri Segmentleri (RFM)** | `ozel.rfm` | Grafik + tablo | Son alış zamanı, alış sıklığı ve tutarına göre şampiyon, sadık, risk altında, uykuda… müşteriler. |
| **Yeni, Kayıp ve Geri Dönen Müşteriler** | `ozel.yeni_kayip` | Grafik + tablo | Dönemde ilk kez alan, önceki dönemde alıp bu dönemde almayan ve uzun aradan sonra dönen müşteriler. |
| **Müşteri Kârlılığı** | `ozel.musteri_karlilik` | Tablo | Müşteri bazında net satış, maliyet, brüt kâr ve marj. |
| **Ürün Kârlılığı** | `ozel.urun_karlilik` | Tablo | Ürün bazında net satış, maliyet, brüt kâr ve marj (Arctos kâr analizi). |
| **Ürün Sınıfı Kârlılığı** | `ozel.sinif_karlilik` | Tablo | Stok sınıfı (KOD2) bazında kârlılık. |
| **Zararına Satılan Ürünler** | `ozel.zararli_urunler` | Tablo | Satış tutarı maliyetinin altında kalan ürünler. |
| **Ürün Matrisi (Büyüme × Marj)** | `ozel.urun_matrisi` | Tablo | Her ürün için satış büyümesi (geçen yılın aynı dönemine göre) ve brüt marj: yıldızlar, nakit inekleri, sorunlular. |
| **Ürün ABC Analizi** | `ozel.abc_urun` | Grafik + tablo | Son 12 ayın net satışına göre A/B/C sınıfları. |
| **Müşteri ABC Analizi** | `ozel.abc_musteri` | Grafik + tablo | Son 12 ayın satışına göre A/B/C müşteri sınıfları. |
| **Stok Değeri** | `ozel.stok_degeri` | Kırılım | Depo envanteri (SUM(ENVANTER), rezerv hariç) × kart maliyeti, sınıf bazında. |
| **Eksi Stoklu Ürünler** | `ozel.eksi_stok` | Tablo | Depo envanteri eksiye düşmüş ürünler — giriş belgesi eksik olabilir. |
| **Kritik Seviyenin Altındakiler** | `ozel.kritik_stok` | Tablo | Kalanı kart kritik seviyesinin altında olan (sipariş verilmesi gereken) ürünler. |
| **Ölü Stok** | `ozel.olu_stok` | Tablo | Stoğu olduğu hâlde son 180 günde hiç satılmamış ürünler. |
| **Stok Devir Hızı** | `ozel.stok_devir` | Tablo | Son 90 günün satış miktarına göre kaç günlük stok olduğu ve devir hızı. |
| **Cari İzahat Dağılımı** | `ozel.izahat_dagilimi` | Tablo | Cari hareket kodlarının dağılımı ve hangi iş olayına eşlendiği (ayarlardan değiştirilebilir). |
| **Havale Mutabakatı (Banka 83 ↔ Cari 83)** | `ozel.havale_mutabakat` | Tablo | Banka havale girişleri ile cari havale tahsilatları kuruşu kuruşuna tutmalı (Kılavuz §36.10). |
| **Veri Kapsamı** | `ozel.veri_kapsami` | Tablo | Köprüden gelen veri kümeleri: satır sayısı, ilk ve son tarih. |

## Tüm raporlar

<details><summary><b>Genel Durum</b> — 10 rapor</summary>

| Rapor | Kimlik | Sonuç | Varsayılan dönem | Grafikler |
|---|---|---|---|---|
| Finansal Sağlık Skoru | `ozel.saglik` | Sağlık skoru | Bu ay | gosterge |
| Büyüme Endeksi | `ozel.buyume` | Büyüme endeksi | Bu ay | buyume |
| Anlık Finansal Durum | `ozel.finansal_durum` | Bilanço | Bu ay | bilanco, tablo |
| Nakit Projeksiyonu (90 gün) | `ozel.nakit_projeksiyonu` | Projeksiyon | Bu ay | cizgi |
| Uyarılar | `ozel.uyarilar` | Tablo | Bu ay | tablo |
| Döngü ve Verimlilik Oranları | `ozel.oranlar` | Tablo | Bu ay | tablo |
| Bugünün Özeti | `ozel.gun_ozeti` | Tablo | Bugün | tablo |
| Aylık Kapanış Tablosu | `ozel.ay_kapanis` | Tablo | Son 12 ay | tablo |
| Yıl-Yıl Karşılaştırma | `ozel.yil_karsilastirma` | Tablo | Bu yıl | tablo |
| Satış Tahmini (3 ay) | `ozel.tahmin` | Zaman serisi | Bu ay | cizgi, sutun, tablo |

</details>

<details><summary><b>Satış</b> — 138 rapor</summary>

| Rapor | Kimlik | Sonuç | Varsayılan dönem | Grafikler |
|---|---|---|---|---|
| Satış (KDV dahil) | `satis.kpi` | Gösterge | Bu ay | sayi |
| Satış (KDV dahil) — Günlük Trend | `satis.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Satış (KDV dahil) — Haftalık Trend | `satis.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Satış (KDV dahil) — Aylık Trend | `satis.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Satış (KDV dahil) — Çeyreklik Trend | `satis.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Satış (KDV dahil) — Yıllık Trend | `satis.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Satış (KDV dahil) — Geçen Yılla Günlük | `satis.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Satış (KDV dahil) — Geçen Yılla Haftalık | `satis.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Satış (KDV dahil) — Geçen Yılla Aylık | `satis.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Satış (KDV dahil) — Yıl Boyu Kümülatif | `satis.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Satış (KDV dahil) — Haftalık Isı Haritası | `satis.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Satış (KDV dahil) — Mevsimsellik | `satis.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Satış (KDV dahil) — Müşteri Sıralaması | `satis.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış (KDV dahil) — Müşteri Payları | `satis.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış (KDV dahil) — Müşteri Karşılaştırma | `satis.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Satış (KDV dahil) — Müşteri ABC (Pareto) | `satis.pareto.cari` | Kırılım | Son 12 ay | pareto, tablo |
| Satış (KDV dahil) — İl Sıralaması | `satis.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış (KDV dahil) — İl Payları | `satis.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış (KDV dahil) — İl Karşılaştırma | `satis.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Satış (KDV dahil) — Cari Grubu Sıralaması | `satis.top.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış (KDV dahil) — Cari Grubu Payları | `satis.pay.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış (KDV dahil) — Cari Grubu Karşılaştırma | `satis.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Satış (KDV dahil) — Temsilci Sıralaması | `satis.top.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış (KDV dahil) — Temsilci Payları | `satis.pay.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış (KDV dahil) — Temsilci Karşılaştırma | `satis.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Satış (KDV dahil) — Firma Sıralaması | `satis.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış (KDV dahil) — Firma Payları | `satis.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış (KDV dahil) — Firma Karşılaştırma | `satis.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Satış (KDV dahil) — Haftanın Günü Dağılımı | `satis.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Satış (KDV dahil) — Ay Dağılımı | `satis.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Satış (KDV dahil) — Saat Dağılımı | `satis.dagilim.saat` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Satış İadesi | `satis_iade.kpi` | Gösterge | Bu ay | sayi |
| Satış İadesi — Günlük Trend | `satis_iade.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Satış İadesi — Haftalık Trend | `satis_iade.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Satış İadesi — Aylık Trend | `satis_iade.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Satış İadesi — Çeyreklik Trend | `satis_iade.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Satış İadesi — Yıllık Trend | `satis_iade.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Satış İadesi — Geçen Yılla Günlük | `satis_iade.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Satış İadesi — Geçen Yılla Haftalık | `satis_iade.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Satış İadesi — Geçen Yılla Aylık | `satis_iade.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Satış İadesi — Yıl Boyu Kümülatif | `satis_iade.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Satış İadesi — Haftalık Isı Haritası | `satis_iade.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Satış İadesi — Mevsimsellik | `satis_iade.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Satış İadesi — Müşteri Sıralaması | `satis_iade.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış İadesi — Müşteri Payları | `satis_iade.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış İadesi — Müşteri Karşılaştırma | `satis_iade.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Satış İadesi — İl Sıralaması | `satis_iade.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış İadesi — İl Payları | `satis_iade.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış İadesi — İl Karşılaştırma | `satis_iade.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Satış İadesi — Cari Grubu Sıralaması | `satis_iade.top.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış İadesi — Cari Grubu Payları | `satis_iade.pay.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış İadesi — Cari Grubu Karşılaştırma | `satis_iade.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Satış İadesi — Temsilci Sıralaması | `satis_iade.top.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış İadesi — Temsilci Payları | `satis_iade.pay.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış İadesi — Temsilci Karşılaştırma | `satis_iade.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Satış İadesi — Firma Sıralaması | `satis_iade.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış İadesi — Firma Payları | `satis_iade.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış İadesi — Firma Karşılaştırma | `satis_iade.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Satış İadesi — Haftanın Günü Dağılımı | `satis_iade.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Satış İadesi — Ay Dağılımı | `satis_iade.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Satış İadesi — Saat Dağılımı | `satis_iade.dagilim.saat` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Net Ciro (KDV dahil) | `net_ciro.kpi` | Gösterge | Bu ay | sayi |
| Net Ciro (KDV dahil) — Günlük Trend | `net_ciro.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Net Ciro (KDV dahil) — Haftalık Trend | `net_ciro.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Net Ciro (KDV dahil) — Aylık Trend | `net_ciro.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Net Ciro (KDV dahil) — Çeyreklik Trend | `net_ciro.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Net Ciro (KDV dahil) — Yıllık Trend | `net_ciro.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Net Ciro (KDV dahil) — Geçen Yılla Günlük | `net_ciro.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Net Ciro (KDV dahil) — Geçen Yılla Haftalık | `net_ciro.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Net Ciro (KDV dahil) — Geçen Yılla Aylık | `net_ciro.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Net Ciro (KDV dahil) — Yıl Boyu Kümülatif | `net_ciro.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Net Ciro (KDV dahil) — Haftalık Isı Haritası | `net_ciro.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Net Ciro (KDV dahil) — Mevsimsellik | `net_ciro.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Net Ciro (KDV dahil) — Müşteri Sıralaması | `net_ciro.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Ciro (KDV dahil) — Müşteri Payları | `net_ciro.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Ciro (KDV dahil) — Müşteri Karşılaştırma | `net_ciro.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Net Ciro (KDV dahil) — Müşteri ABC (Pareto) | `net_ciro.pareto.cari` | Kırılım | Son 12 ay | pareto, tablo |
| Net Ciro (KDV dahil) — İl Sıralaması | `net_ciro.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Ciro (KDV dahil) — İl Payları | `net_ciro.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Ciro (KDV dahil) — İl Karşılaştırma | `net_ciro.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Net Ciro (KDV dahil) — Cari Grubu Sıralaması | `net_ciro.top.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Ciro (KDV dahil) — Cari Grubu Payları | `net_ciro.pay.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Ciro (KDV dahil) — Cari Grubu Karşılaştırma | `net_ciro.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Net Ciro (KDV dahil) — Temsilci Sıralaması | `net_ciro.top.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Ciro (KDV dahil) — Temsilci Payları | `net_ciro.pay.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Ciro (KDV dahil) — Temsilci Karşılaştırma | `net_ciro.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Net Ciro (KDV dahil) — Firma Sıralaması | `net_ciro.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Ciro (KDV dahil) — Firma Payları | `net_ciro.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Ciro (KDV dahil) — Firma Karşılaştırma | `net_ciro.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Net Ciro (KDV dahil) — Haftanın Günü Dağılımı | `net_ciro.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Net Ciro (KDV dahil) — Ay Dağılımı | `net_ciro.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Net Ciro (KDV dahil) — Saat Dağılımı | `net_ciro.dagilim.saat` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Satış Faturası Sayısı | `fatura_sayisi.kpi` | Gösterge | Bu ay | sayi |
| Satış Faturası Sayısı — Günlük Trend | `fatura_sayisi.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Satış Faturası Sayısı — Haftalık Trend | `fatura_sayisi.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Satış Faturası Sayısı — Aylık Trend | `fatura_sayisi.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Satış Faturası Sayısı — Çeyreklik Trend | `fatura_sayisi.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Satış Faturası Sayısı — Yıllık Trend | `fatura_sayisi.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Satış Faturası Sayısı — Geçen Yılla Günlük | `fatura_sayisi.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Satış Faturası Sayısı — Geçen Yılla Haftalık | `fatura_sayisi.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Satış Faturası Sayısı — Geçen Yılla Aylık | `fatura_sayisi.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Satış Faturası Sayısı — Mevsimsellik | `fatura_sayisi.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Satış Faturası Sayısı — Müşteri Sıralaması | `fatura_sayisi.top.cari` | Kırılım | Bu yıl | cubuk, tablo |
| Satış Faturası Sayısı — Müşteri Karşılaştırma | `fatura_sayisi.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Satış Faturası Sayısı — İl Sıralaması | `fatura_sayisi.top.il` | Kırılım | Bu yıl | cubuk, tablo |
| Satış Faturası Sayısı — İl Karşılaştırma | `fatura_sayisi.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Satış Faturası Sayısı — Cari Grubu Sıralaması | `fatura_sayisi.top.grup` | Kırılım | Bu yıl | cubuk, tablo |
| Satış Faturası Sayısı — Cari Grubu Karşılaştırma | `fatura_sayisi.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Satış Faturası Sayısı — Temsilci Sıralaması | `fatura_sayisi.top.temsilci` | Kırılım | Bu yıl | cubuk, tablo |
| Satış Faturası Sayısı — Temsilci Karşılaştırma | `fatura_sayisi.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Satış Faturası Sayısı — Firma Sıralaması | `fatura_sayisi.top.firma` | Kırılım | Bu yıl | cubuk, tablo |
| Satış Faturası Sayısı — Firma Karşılaştırma | `fatura_sayisi.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Satış Faturası Sayısı — Haftanın Günü Dağılımı | `fatura_sayisi.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Satış Faturası Sayısı — Ay Dağılımı | `fatura_sayisi.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Satış Faturası Sayısı — Saat Dağılımı | `fatura_sayisi.dagilim.saat` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Ortalama Fatura Tutarı | `ort_fatura.kpi` | Gösterge | Bu ay | sayi |
| Ortalama Fatura Tutarı — Günlük Trend | `ort_fatura.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Ortalama Fatura Tutarı — Haftalık Trend | `ort_fatura.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Ortalama Fatura Tutarı — Aylık Trend | `ort_fatura.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Ortalama Fatura Tutarı — Çeyreklik Trend | `ort_fatura.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Ortalama Fatura Tutarı — Yıllık Trend | `ort_fatura.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Ortalama Fatura Tutarı — Geçen Yılla Günlük | `ort_fatura.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Ortalama Fatura Tutarı — Geçen Yılla Haftalık | `ort_fatura.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Ortalama Fatura Tutarı — Geçen Yılla Aylık | `ort_fatura.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Ortalama Fatura Tutarı — Mevsimsellik | `ort_fatura.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Ortalama Fatura Tutarı — Müşteri Sıralaması | `ort_fatura.top.cari` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Fatura Tutarı — Müşteri Karşılaştırma | `ort_fatura.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Fatura Tutarı — İl Sıralaması | `ort_fatura.top.il` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Fatura Tutarı — İl Karşılaştırma | `ort_fatura.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Fatura Tutarı — Cari Grubu Sıralaması | `ort_fatura.top.grup` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Fatura Tutarı — Cari Grubu Karşılaştırma | `ort_fatura.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Fatura Tutarı — Temsilci Sıralaması | `ort_fatura.top.temsilci` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Fatura Tutarı — Temsilci Karşılaştırma | `ort_fatura.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Fatura Tutarı — Firma Sıralaması | `ort_fatura.top.firma` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Fatura Tutarı — Firma Karşılaştırma | `ort_fatura.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Fatura Tutarı — Haftanın Günü Dağılımı | `ort_fatura.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Ortalama Fatura Tutarı — Ay Dağılımı | `ort_fatura.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Ortalama Fatura Tutarı — Saat Dağılımı | `ort_fatura.dagilim.saat` | Kırılım | Son 90 gün | sutun, cubuk, tablo |

</details>

<details><summary><b>Kârlılık</b> — 206 rapor</summary>

| Rapor | Kimlik | Sonuç | Varsayılan dönem | Grafikler |
|---|---|---|---|---|
| Net Satış (KDV hariç) | `net_satis.kpi` | Gösterge | Bu ay | sayi |
| Net Satış (KDV hariç) — Günlük Trend | `net_satis.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Net Satış (KDV hariç) — Haftalık Trend | `net_satis.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Net Satış (KDV hariç) — Aylık Trend | `net_satis.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Net Satış (KDV hariç) — Çeyreklik Trend | `net_satis.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Net Satış (KDV hariç) — Yıllık Trend | `net_satis.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Net Satış (KDV hariç) — Geçen Yılla Günlük | `net_satis.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Net Satış (KDV hariç) — Geçen Yılla Haftalık | `net_satis.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Net Satış (KDV hariç) — Geçen Yılla Aylık | `net_satis.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Net Satış (KDV hariç) — Yıl Boyu Kümülatif | `net_satis.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Net Satış (KDV hariç) — Haftalık Isı Haritası | `net_satis.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Net Satış (KDV hariç) — Mevsimsellik | `net_satis.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Net Satış (KDV hariç) — Müşteri Sıralaması | `net_satis.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Müşteri Payları | `net_satis.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Müşteri Karşılaştırma | `net_satis.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Net Satış (KDV hariç) — Müşteri ABC (Pareto) | `net_satis.pareto.cari` | Kırılım | Son 12 ay | pareto, tablo |
| Net Satış (KDV hariç) — İl Sıralaması | `net_satis.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — İl Payları | `net_satis.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — İl Karşılaştırma | `net_satis.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Net Satış (KDV hariç) — Cari Grubu Sıralaması | `net_satis.top.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Cari Grubu Payları | `net_satis.pay.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Cari Grubu Karşılaştırma | `net_satis.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Net Satış (KDV hariç) — Temsilci Sıralaması | `net_satis.top.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Temsilci Payları | `net_satis.pay.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Temsilci Karşılaştırma | `net_satis.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Net Satış (KDV hariç) — Ürün Sıralaması | `net_satis.top.urun` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Ürün Payları | `net_satis.pay.urun` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Ürün Karşılaştırma | `net_satis.karsilastir.urun` | Kırılım | Bu ay | karsilastir, tablo |
| Net Satış (KDV hariç) — Ürün ABC (Pareto) | `net_satis.pareto.urun` | Kırılım | Son 12 ay | pareto, tablo |
| Net Satış (KDV hariç) — Ürün Sınıfı Sıralaması | `net_satis.top.sinif` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Ürün Sınıfı Payları | `net_satis.pay.sinif` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Ürün Sınıfı Karşılaştırma | `net_satis.karsilastir.sinif` | Kırılım | Bu ay | karsilastir, tablo |
| Net Satış (KDV hariç) — Marka Sıralaması | `net_satis.top.marka` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Marka Payları | `net_satis.pay.marka` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Marka Karşılaştırma | `net_satis.karsilastir.marka` | Kırılım | Bu ay | karsilastir, tablo |
| Net Satış (KDV hariç) — Ürün Türü Sıralaması | `net_satis.top.tur` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Ürün Türü Payları | `net_satis.pay.tur` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Ürün Türü Karşılaştırma | `net_satis.karsilastir.tur` | Kırılım | Bu ay | karsilastir, tablo |
| Net Satış (KDV hariç) — Satış Personeli Sıralaması | `net_satis.top.satici` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Satış Personeli Payları | `net_satis.pay.satici` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Satış Personeli Karşılaştırma | `net_satis.karsilastir.satici` | Kırılım | Bu ay | karsilastir, tablo |
| Net Satış (KDV hariç) — Firma Sıralaması | `net_satis.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Firma Payları | `net_satis.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Net Satış (KDV hariç) — Firma Karşılaştırma | `net_satis.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Net Satış (KDV hariç) — Haftanın Günü Dağılımı | `net_satis.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Net Satış (KDV hariç) — Ay Dağılımı | `net_satis.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Satılan Malın Maliyeti | `maliyet.kpi` | Gösterge | Bu ay | sayi |
| Satılan Malın Maliyeti — Günlük Trend | `maliyet.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Satılan Malın Maliyeti — Haftalık Trend | `maliyet.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Satılan Malın Maliyeti — Aylık Trend | `maliyet.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Satılan Malın Maliyeti — Çeyreklik Trend | `maliyet.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Satılan Malın Maliyeti — Yıllık Trend | `maliyet.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Satılan Malın Maliyeti — Geçen Yılla Günlük | `maliyet.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Satılan Malın Maliyeti — Geçen Yılla Haftalık | `maliyet.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Satılan Malın Maliyeti — Geçen Yılla Aylık | `maliyet.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Satılan Malın Maliyeti — Yıl Boyu Kümülatif | `maliyet.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Satılan Malın Maliyeti — Haftalık Isı Haritası | `maliyet.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Satılan Malın Maliyeti — Mevsimsellik | `maliyet.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Satılan Malın Maliyeti — Müşteri Sıralaması | `maliyet.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Müşteri Payları | `maliyet.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Müşteri Karşılaştırma | `maliyet.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Malın Maliyeti — Müşteri ABC (Pareto) | `maliyet.pareto.cari` | Kırılım | Son 12 ay | pareto, tablo |
| Satılan Malın Maliyeti — İl Sıralaması | `maliyet.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — İl Payları | `maliyet.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — İl Karşılaştırma | `maliyet.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Malın Maliyeti — Cari Grubu Sıralaması | `maliyet.top.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Cari Grubu Payları | `maliyet.pay.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Cari Grubu Karşılaştırma | `maliyet.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Malın Maliyeti — Temsilci Sıralaması | `maliyet.top.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Temsilci Payları | `maliyet.pay.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Temsilci Karşılaştırma | `maliyet.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Malın Maliyeti — Ürün Sıralaması | `maliyet.top.urun` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Ürün Payları | `maliyet.pay.urun` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Ürün Karşılaştırma | `maliyet.karsilastir.urun` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Malın Maliyeti — Ürün ABC (Pareto) | `maliyet.pareto.urun` | Kırılım | Son 12 ay | pareto, tablo |
| Satılan Malın Maliyeti — Ürün Sınıfı Sıralaması | `maliyet.top.sinif` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Ürün Sınıfı Payları | `maliyet.pay.sinif` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Ürün Sınıfı Karşılaştırma | `maliyet.karsilastir.sinif` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Malın Maliyeti — Marka Sıralaması | `maliyet.top.marka` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Marka Payları | `maliyet.pay.marka` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Marka Karşılaştırma | `maliyet.karsilastir.marka` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Malın Maliyeti — Ürün Türü Sıralaması | `maliyet.top.tur` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Ürün Türü Payları | `maliyet.pay.tur` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Ürün Türü Karşılaştırma | `maliyet.karsilastir.tur` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Malın Maliyeti — Satış Personeli Sıralaması | `maliyet.top.satici` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Satış Personeli Payları | `maliyet.pay.satici` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Satış Personeli Karşılaştırma | `maliyet.karsilastir.satici` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Malın Maliyeti — Firma Sıralaması | `maliyet.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Firma Payları | `maliyet.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satılan Malın Maliyeti — Firma Karşılaştırma | `maliyet.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Malın Maliyeti — Haftanın Günü Dağılımı | `maliyet.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Satılan Malın Maliyeti — Ay Dağılımı | `maliyet.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Brüt Kâr | `brut_kar.kpi` | Gösterge | Bu ay | sayi |
| Brüt Kâr — Günlük Trend | `brut_kar.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Brüt Kâr — Haftalık Trend | `brut_kar.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Brüt Kâr — Aylık Trend | `brut_kar.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Brüt Kâr — Çeyreklik Trend | `brut_kar.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Brüt Kâr — Yıllık Trend | `brut_kar.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Brüt Kâr — Geçen Yılla Günlük | `brut_kar.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Brüt Kâr — Geçen Yılla Haftalık | `brut_kar.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Brüt Kâr — Geçen Yılla Aylık | `brut_kar.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Brüt Kâr — Yıl Boyu Kümülatif | `brut_kar.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Brüt Kâr — Haftalık Isı Haritası | `brut_kar.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Brüt Kâr — Mevsimsellik | `brut_kar.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Brüt Kâr — Müşteri Sıralaması | `brut_kar.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Müşteri Payları | `brut_kar.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Müşteri Karşılaştırma | `brut_kar.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr — Müşteri ABC (Pareto) | `brut_kar.pareto.cari` | Kırılım | Son 12 ay | pareto, tablo |
| Brüt Kâr — İl Sıralaması | `brut_kar.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — İl Payları | `brut_kar.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — İl Karşılaştırma | `brut_kar.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr — Cari Grubu Sıralaması | `brut_kar.top.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Cari Grubu Payları | `brut_kar.pay.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Cari Grubu Karşılaştırma | `brut_kar.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr — Temsilci Sıralaması | `brut_kar.top.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Temsilci Payları | `brut_kar.pay.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Temsilci Karşılaştırma | `brut_kar.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr — Ürün Sıralaması | `brut_kar.top.urun` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Ürün Payları | `brut_kar.pay.urun` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Ürün Karşılaştırma | `brut_kar.karsilastir.urun` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr — Ürün ABC (Pareto) | `brut_kar.pareto.urun` | Kırılım | Son 12 ay | pareto, tablo |
| Brüt Kâr — Ürün Sınıfı Sıralaması | `brut_kar.top.sinif` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Ürün Sınıfı Payları | `brut_kar.pay.sinif` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Ürün Sınıfı Karşılaştırma | `brut_kar.karsilastir.sinif` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr — Marka Sıralaması | `brut_kar.top.marka` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Marka Payları | `brut_kar.pay.marka` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Marka Karşılaştırma | `brut_kar.karsilastir.marka` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr — Ürün Türü Sıralaması | `brut_kar.top.tur` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Ürün Türü Payları | `brut_kar.pay.tur` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Ürün Türü Karşılaştırma | `brut_kar.karsilastir.tur` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr — Satış Personeli Sıralaması | `brut_kar.top.satici` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Satış Personeli Payları | `brut_kar.pay.satici` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Satış Personeli Karşılaştırma | `brut_kar.karsilastir.satici` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr — Firma Sıralaması | `brut_kar.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Firma Payları | `brut_kar.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Brüt Kâr — Firma Karşılaştırma | `brut_kar.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr — Haftanın Günü Dağılımı | `brut_kar.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Brüt Kâr — Ay Dağılımı | `brut_kar.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Brüt Kâr Marjı | `brut_marj.kpi` | Gösterge | Bu ay | sayi |
| Brüt Kâr Marjı — Günlük Trend | `brut_marj.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Brüt Kâr Marjı — Haftalık Trend | `brut_marj.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Brüt Kâr Marjı — Aylık Trend | `brut_marj.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Brüt Kâr Marjı — Çeyreklik Trend | `brut_marj.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Brüt Kâr Marjı — Yıllık Trend | `brut_marj.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Brüt Kâr Marjı — Geçen Yılla Günlük | `brut_marj.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Brüt Kâr Marjı — Geçen Yılla Haftalık | `brut_marj.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Brüt Kâr Marjı — Geçen Yılla Aylık | `brut_marj.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Brüt Kâr Marjı — Mevsimsellik | `brut_marj.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Brüt Kâr Marjı — Müşteri Sıralaması | `brut_marj.top.cari` | Kırılım | Bu yıl | cubuk, tablo |
| Brüt Kâr Marjı — Müşteri Karşılaştırma | `brut_marj.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr Marjı — İl Sıralaması | `brut_marj.top.il` | Kırılım | Bu yıl | cubuk, tablo |
| Brüt Kâr Marjı — İl Karşılaştırma | `brut_marj.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr Marjı — Cari Grubu Sıralaması | `brut_marj.top.grup` | Kırılım | Bu yıl | cubuk, tablo |
| Brüt Kâr Marjı — Cari Grubu Karşılaştırma | `brut_marj.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr Marjı — Temsilci Sıralaması | `brut_marj.top.temsilci` | Kırılım | Bu yıl | cubuk, tablo |
| Brüt Kâr Marjı — Temsilci Karşılaştırma | `brut_marj.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr Marjı — Ürün Sıralaması | `brut_marj.top.urun` | Kırılım | Bu yıl | cubuk, tablo |
| Brüt Kâr Marjı — Ürün Karşılaştırma | `brut_marj.karsilastir.urun` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr Marjı — Ürün Sınıfı Sıralaması | `brut_marj.top.sinif` | Kırılım | Bu yıl | cubuk, tablo |
| Brüt Kâr Marjı — Ürün Sınıfı Karşılaştırma | `brut_marj.karsilastir.sinif` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr Marjı — Marka Sıralaması | `brut_marj.top.marka` | Kırılım | Bu yıl | cubuk, tablo |
| Brüt Kâr Marjı — Marka Karşılaştırma | `brut_marj.karsilastir.marka` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr Marjı — Ürün Türü Sıralaması | `brut_marj.top.tur` | Kırılım | Bu yıl | cubuk, tablo |
| Brüt Kâr Marjı — Ürün Türü Karşılaştırma | `brut_marj.karsilastir.tur` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr Marjı — Satış Personeli Sıralaması | `brut_marj.top.satici` | Kırılım | Bu yıl | cubuk, tablo |
| Brüt Kâr Marjı — Satış Personeli Karşılaştırma | `brut_marj.karsilastir.satici` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr Marjı — Firma Sıralaması | `brut_marj.top.firma` | Kırılım | Bu yıl | cubuk, tablo |
| Brüt Kâr Marjı — Firma Karşılaştırma | `brut_marj.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Brüt Kâr Marjı — Haftanın Günü Dağılımı | `brut_marj.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Brüt Kâr Marjı — Ay Dağılımı | `brut_marj.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Kâr Oranı (maliyet üzeri) | `kar_orani.kpi` | Gösterge | Bu ay | sayi |
| Kâr Oranı (maliyet üzeri) — Günlük Trend | `kar_orani.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Kâr Oranı (maliyet üzeri) — Haftalık Trend | `kar_orani.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Kâr Oranı (maliyet üzeri) — Aylık Trend | `kar_orani.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Kâr Oranı (maliyet üzeri) — Çeyreklik Trend | `kar_orani.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Kâr Oranı (maliyet üzeri) — Yıllık Trend | `kar_orani.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Kâr Oranı (maliyet üzeri) — Geçen Yılla Günlük | `kar_orani.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Kâr Oranı (maliyet üzeri) — Geçen Yılla Haftalık | `kar_orani.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Kâr Oranı (maliyet üzeri) — Geçen Yılla Aylık | `kar_orani.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Kâr Oranı (maliyet üzeri) — Mevsimsellik | `kar_orani.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Kâr Oranı (maliyet üzeri) — Müşteri Sıralaması | `kar_orani.top.cari` | Kırılım | Bu yıl | cubuk, tablo |
| Kâr Oranı (maliyet üzeri) — Müşteri Karşılaştırma | `kar_orani.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Kâr Oranı (maliyet üzeri) — İl Sıralaması | `kar_orani.top.il` | Kırılım | Bu yıl | cubuk, tablo |
| Kâr Oranı (maliyet üzeri) — İl Karşılaştırma | `kar_orani.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Kâr Oranı (maliyet üzeri) — Cari Grubu Sıralaması | `kar_orani.top.grup` | Kırılım | Bu yıl | cubuk, tablo |
| Kâr Oranı (maliyet üzeri) — Cari Grubu Karşılaştırma | `kar_orani.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Kâr Oranı (maliyet üzeri) — Temsilci Sıralaması | `kar_orani.top.temsilci` | Kırılım | Bu yıl | cubuk, tablo |
| Kâr Oranı (maliyet üzeri) — Temsilci Karşılaştırma | `kar_orani.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Kâr Oranı (maliyet üzeri) — Ürün Sıralaması | `kar_orani.top.urun` | Kırılım | Bu yıl | cubuk, tablo |
| Kâr Oranı (maliyet üzeri) — Ürün Karşılaştırma | `kar_orani.karsilastir.urun` | Kırılım | Bu ay | karsilastir, tablo |
| Kâr Oranı (maliyet üzeri) — Ürün Sınıfı Sıralaması | `kar_orani.top.sinif` | Kırılım | Bu yıl | cubuk, tablo |
| Kâr Oranı (maliyet üzeri) — Ürün Sınıfı Karşılaştırma | `kar_orani.karsilastir.sinif` | Kırılım | Bu ay | karsilastir, tablo |
| Kâr Oranı (maliyet üzeri) — Marka Sıralaması | `kar_orani.top.marka` | Kırılım | Bu yıl | cubuk, tablo |
| Kâr Oranı (maliyet üzeri) — Marka Karşılaştırma | `kar_orani.karsilastir.marka` | Kırılım | Bu ay | karsilastir, tablo |
| Kâr Oranı (maliyet üzeri) — Ürün Türü Sıralaması | `kar_orani.top.tur` | Kırılım | Bu yıl | cubuk, tablo |
| Kâr Oranı (maliyet üzeri) — Ürün Türü Karşılaştırma | `kar_orani.karsilastir.tur` | Kırılım | Bu ay | karsilastir, tablo |
| Kâr Oranı (maliyet üzeri) — Satış Personeli Sıralaması | `kar_orani.top.satici` | Kırılım | Bu yıl | cubuk, tablo |
| Kâr Oranı (maliyet üzeri) — Satış Personeli Karşılaştırma | `kar_orani.karsilastir.satici` | Kırılım | Bu ay | karsilastir, tablo |
| Kâr Oranı (maliyet üzeri) — Firma Sıralaması | `kar_orani.top.firma` | Kırılım | Bu yıl | cubuk, tablo |
| Kâr Oranı (maliyet üzeri) — Firma Karşılaştırma | `kar_orani.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Kâr Oranı (maliyet üzeri) — Haftanın Günü Dağılımı | `kar_orani.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Kâr Oranı (maliyet üzeri) — Ay Dağılımı | `kar_orani.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Müşteri Kârlılığı | `ozel.musteri_karlilik` | Tablo | Bu yıl | tablo |
| Ürün Kârlılığı | `ozel.urun_karlilik` | Tablo | Bu yıl | tablo |
| Ürün Sınıfı Kârlılığı | `ozel.sinif_karlilik` | Tablo | Bu yıl | tablo |
| Zararına Satılan Ürünler | `ozel.zararli_urunler` | Tablo | Son 90 gün | tablo |

</details>

<details><summary><b>Müşteriler</b> — 49 rapor</summary>

| Rapor | Kimlik | Sonuç | Varsayılan dönem | Grafikler |
|---|---|---|---|---|
| Aktif Müşteri | `aktif_musteri.kpi` | Gösterge | Bu ay | sayi |
| Aktif Müşteri — Günlük Trend | `aktif_musteri.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Aktif Müşteri — Haftalık Trend | `aktif_musteri.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Aktif Müşteri — Aylık Trend | `aktif_musteri.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Aktif Müşteri — Çeyreklik Trend | `aktif_musteri.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Aktif Müşteri — Yıllık Trend | `aktif_musteri.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Aktif Müşteri — Geçen Yılla Günlük | `aktif_musteri.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Aktif Müşteri — Geçen Yılla Haftalık | `aktif_musteri.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Aktif Müşteri — Geçen Yılla Aylık | `aktif_musteri.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Aktif Müşteri — Mevsimsellik | `aktif_musteri.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Aktif Müşteri — Müşteri Sıralaması | `aktif_musteri.top.cari` | Kırılım | Bu yıl | cubuk, tablo |
| Aktif Müşteri — Müşteri Karşılaştırma | `aktif_musteri.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Aktif Müşteri — İl Sıralaması | `aktif_musteri.top.il` | Kırılım | Bu yıl | cubuk, tablo |
| Aktif Müşteri — İl Karşılaştırma | `aktif_musteri.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Aktif Müşteri — Cari Grubu Sıralaması | `aktif_musteri.top.grup` | Kırılım | Bu yıl | cubuk, tablo |
| Aktif Müşteri — Cari Grubu Karşılaştırma | `aktif_musteri.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Aktif Müşteri — Temsilci Sıralaması | `aktif_musteri.top.temsilci` | Kırılım | Bu yıl | cubuk, tablo |
| Aktif Müşteri — Temsilci Karşılaştırma | `aktif_musteri.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Aktif Müşteri — Firma Sıralaması | `aktif_musteri.top.firma` | Kırılım | Bu yıl | cubuk, tablo |
| Aktif Müşteri — Firma Karşılaştırma | `aktif_musteri.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Aktif Müşteri — Haftanın Günü Dağılımı | `aktif_musteri.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Aktif Müşteri — Ay Dağılımı | `aktif_musteri.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Aktif Müşteri — Saat Dağılımı | `aktif_musteri.dagilim.saat` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Müşteri Başına Satış | `musteri_basi.kpi` | Gösterge | Bu ay | sayi |
| Müşteri Başına Satış — Günlük Trend | `musteri_basi.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Müşteri Başına Satış — Haftalık Trend | `musteri_basi.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Müşteri Başına Satış — Aylık Trend | `musteri_basi.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Müşteri Başına Satış — Çeyreklik Trend | `musteri_basi.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Müşteri Başına Satış — Yıllık Trend | `musteri_basi.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Müşteri Başına Satış — Geçen Yılla Günlük | `musteri_basi.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Müşteri Başına Satış — Geçen Yılla Haftalık | `musteri_basi.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Müşteri Başına Satış — Geçen Yılla Aylık | `musteri_basi.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Müşteri Başına Satış — Mevsimsellik | `musteri_basi.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Müşteri Başına Satış — Müşteri Sıralaması | `musteri_basi.top.cari` | Kırılım | Bu yıl | cubuk, tablo |
| Müşteri Başına Satış — Müşteri Karşılaştırma | `musteri_basi.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Müşteri Başına Satış — İl Sıralaması | `musteri_basi.top.il` | Kırılım | Bu yıl | cubuk, tablo |
| Müşteri Başına Satış — İl Karşılaştırma | `musteri_basi.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Müşteri Başına Satış — Cari Grubu Sıralaması | `musteri_basi.top.grup` | Kırılım | Bu yıl | cubuk, tablo |
| Müşteri Başına Satış — Cari Grubu Karşılaştırma | `musteri_basi.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Müşteri Başına Satış — Temsilci Sıralaması | `musteri_basi.top.temsilci` | Kırılım | Bu yıl | cubuk, tablo |
| Müşteri Başına Satış — Temsilci Karşılaştırma | `musteri_basi.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Müşteri Başına Satış — Firma Sıralaması | `musteri_basi.top.firma` | Kırılım | Bu yıl | cubuk, tablo |
| Müşteri Başına Satış — Firma Karşılaştırma | `musteri_basi.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Müşteri Başına Satış — Haftanın Günü Dağılımı | `musteri_basi.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Müşteri Başına Satış — Ay Dağılımı | `musteri_basi.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Müşteri Başına Satış — Saat Dağılımı | `musteri_basi.dagilim.saat` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Müşteri Segmentleri (RFM) | `ozel.rfm` | Grafik + tablo | Bu ay | coklu |
| Yeni, Kayıp ve Geri Dönen Müşteriler | `ozel.yeni_kayip` | Grafik + tablo | Bu ay | coklu |
| Müşteri ABC Analizi | `ozel.abc_musteri` | Grafik + tablo | Bu ay | coklu |

</details>

<details><summary><b>Ürünler</b> — 144 rapor</summary>

| Rapor | Kimlik | Sonuç | Varsayılan dönem | Grafikler |
|---|---|---|---|---|
| Satış Miktarı | `miktar.kpi` | Gösterge | Bu ay | sayi |
| Satış Miktarı — Günlük Trend | `miktar.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Satış Miktarı — Haftalık Trend | `miktar.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Satış Miktarı — Aylık Trend | `miktar.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Satış Miktarı — Çeyreklik Trend | `miktar.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Satış Miktarı — Yıllık Trend | `miktar.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Satış Miktarı — Geçen Yılla Günlük | `miktar.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Satış Miktarı — Geçen Yılla Haftalık | `miktar.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Satış Miktarı — Geçen Yılla Aylık | `miktar.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Satış Miktarı — Yıl Boyu Kümülatif | `miktar.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Satış Miktarı — Haftalık Isı Haritası | `miktar.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Satış Miktarı — Mevsimsellik | `miktar.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Satış Miktarı — Müşteri Sıralaması | `miktar.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Müşteri Payları | `miktar.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Müşteri Karşılaştırma | `miktar.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Satış Miktarı — Müşteri ABC (Pareto) | `miktar.pareto.cari` | Kırılım | Son 12 ay | pareto, tablo |
| Satış Miktarı — İl Sıralaması | `miktar.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — İl Payları | `miktar.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — İl Karşılaştırma | `miktar.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Satış Miktarı — Cari Grubu Sıralaması | `miktar.top.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Cari Grubu Payları | `miktar.pay.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Cari Grubu Karşılaştırma | `miktar.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Satış Miktarı — Temsilci Sıralaması | `miktar.top.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Temsilci Payları | `miktar.pay.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Temsilci Karşılaştırma | `miktar.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Satış Miktarı — Ürün Sıralaması | `miktar.top.urun` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Ürün Payları | `miktar.pay.urun` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Ürün Karşılaştırma | `miktar.karsilastir.urun` | Kırılım | Bu ay | karsilastir, tablo |
| Satış Miktarı — Ürün ABC (Pareto) | `miktar.pareto.urun` | Kırılım | Son 12 ay | pareto, tablo |
| Satış Miktarı — Ürün Sınıfı Sıralaması | `miktar.top.sinif` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Ürün Sınıfı Payları | `miktar.pay.sinif` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Ürün Sınıfı Karşılaştırma | `miktar.karsilastir.sinif` | Kırılım | Bu ay | karsilastir, tablo |
| Satış Miktarı — Marka Sıralaması | `miktar.top.marka` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Marka Payları | `miktar.pay.marka` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Marka Karşılaştırma | `miktar.karsilastir.marka` | Kırılım | Bu ay | karsilastir, tablo |
| Satış Miktarı — Ürün Türü Sıralaması | `miktar.top.tur` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Ürün Türü Payları | `miktar.pay.tur` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Ürün Türü Karşılaştırma | `miktar.karsilastir.tur` | Kırılım | Bu ay | karsilastir, tablo |
| Satış Miktarı — Satış Personeli Sıralaması | `miktar.top.satici` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Satış Personeli Payları | `miktar.pay.satici` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Satış Personeli Karşılaştırma | `miktar.karsilastir.satici` | Kırılım | Bu ay | karsilastir, tablo |
| Satış Miktarı — Firma Sıralaması | `miktar.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Firma Payları | `miktar.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Satış Miktarı — Firma Karşılaştırma | `miktar.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Satış Miktarı — Haftanın Günü Dağılımı | `miktar.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Satış Miktarı — Ay Dağılımı | `miktar.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Satılan Ürün Çeşidi | `urun_cesidi.kpi` | Gösterge | Bu ay | sayi |
| Satılan Ürün Çeşidi — Günlük Trend | `urun_cesidi.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Satılan Ürün Çeşidi — Haftalık Trend | `urun_cesidi.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Satılan Ürün Çeşidi — Aylık Trend | `urun_cesidi.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Satılan Ürün Çeşidi — Çeyreklik Trend | `urun_cesidi.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Satılan Ürün Çeşidi — Yıllık Trend | `urun_cesidi.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Satılan Ürün Çeşidi — Geçen Yılla Günlük | `urun_cesidi.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Satılan Ürün Çeşidi — Geçen Yılla Haftalık | `urun_cesidi.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Satılan Ürün Çeşidi — Geçen Yılla Aylık | `urun_cesidi.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Satılan Ürün Çeşidi — Mevsimsellik | `urun_cesidi.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Satılan Ürün Çeşidi — Müşteri Sıralaması | `urun_cesidi.top.cari` | Kırılım | Bu yıl | cubuk, tablo |
| Satılan Ürün Çeşidi — Müşteri Karşılaştırma | `urun_cesidi.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Ürün Çeşidi — İl Sıralaması | `urun_cesidi.top.il` | Kırılım | Bu yıl | cubuk, tablo |
| Satılan Ürün Çeşidi — İl Karşılaştırma | `urun_cesidi.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Ürün Çeşidi — Cari Grubu Sıralaması | `urun_cesidi.top.grup` | Kırılım | Bu yıl | cubuk, tablo |
| Satılan Ürün Çeşidi — Cari Grubu Karşılaştırma | `urun_cesidi.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Ürün Çeşidi — Temsilci Sıralaması | `urun_cesidi.top.temsilci` | Kırılım | Bu yıl | cubuk, tablo |
| Satılan Ürün Çeşidi — Temsilci Karşılaştırma | `urun_cesidi.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Ürün Çeşidi — Ürün Sıralaması | `urun_cesidi.top.urun` | Kırılım | Bu yıl | cubuk, tablo |
| Satılan Ürün Çeşidi — Ürün Karşılaştırma | `urun_cesidi.karsilastir.urun` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Ürün Çeşidi — Ürün Sınıfı Sıralaması | `urun_cesidi.top.sinif` | Kırılım | Bu yıl | cubuk, tablo |
| Satılan Ürün Çeşidi — Ürün Sınıfı Karşılaştırma | `urun_cesidi.karsilastir.sinif` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Ürün Çeşidi — Marka Sıralaması | `urun_cesidi.top.marka` | Kırılım | Bu yıl | cubuk, tablo |
| Satılan Ürün Çeşidi — Marka Karşılaştırma | `urun_cesidi.karsilastir.marka` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Ürün Çeşidi — Ürün Türü Sıralaması | `urun_cesidi.top.tur` | Kırılım | Bu yıl | cubuk, tablo |
| Satılan Ürün Çeşidi — Ürün Türü Karşılaştırma | `urun_cesidi.karsilastir.tur` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Ürün Çeşidi — Satış Personeli Sıralaması | `urun_cesidi.top.satici` | Kırılım | Bu yıl | cubuk, tablo |
| Satılan Ürün Çeşidi — Satış Personeli Karşılaştırma | `urun_cesidi.karsilastir.satici` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Ürün Çeşidi — Firma Sıralaması | `urun_cesidi.top.firma` | Kırılım | Bu yıl | cubuk, tablo |
| Satılan Ürün Çeşidi — Firma Karşılaştırma | `urun_cesidi.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Satılan Ürün Çeşidi — Haftanın Günü Dağılımı | `urun_cesidi.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Satılan Ürün Çeşidi — Ay Dağılımı | `urun_cesidi.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Fatura Başına Kalem | `sepet.kpi` | Gösterge | Bu ay | sayi |
| Fatura Başına Kalem — Günlük Trend | `sepet.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Fatura Başına Kalem — Haftalık Trend | `sepet.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Fatura Başına Kalem — Aylık Trend | `sepet.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Fatura Başına Kalem — Çeyreklik Trend | `sepet.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Fatura Başına Kalem — Yıllık Trend | `sepet.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Fatura Başına Kalem — Geçen Yılla Günlük | `sepet.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Fatura Başına Kalem — Geçen Yılla Haftalık | `sepet.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Fatura Başına Kalem — Geçen Yılla Aylık | `sepet.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Fatura Başına Kalem — Mevsimsellik | `sepet.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Fatura Başına Kalem — Müşteri Sıralaması | `sepet.top.cari` | Kırılım | Bu yıl | cubuk, tablo |
| Fatura Başına Kalem — Müşteri Karşılaştırma | `sepet.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Fatura Başına Kalem — İl Sıralaması | `sepet.top.il` | Kırılım | Bu yıl | cubuk, tablo |
| Fatura Başına Kalem — İl Karşılaştırma | `sepet.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Fatura Başına Kalem — Cari Grubu Sıralaması | `sepet.top.grup` | Kırılım | Bu yıl | cubuk, tablo |
| Fatura Başına Kalem — Cari Grubu Karşılaştırma | `sepet.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Fatura Başına Kalem — Temsilci Sıralaması | `sepet.top.temsilci` | Kırılım | Bu yıl | cubuk, tablo |
| Fatura Başına Kalem — Temsilci Karşılaştırma | `sepet.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Fatura Başına Kalem — Ürün Sıralaması | `sepet.top.urun` | Kırılım | Bu yıl | cubuk, tablo |
| Fatura Başına Kalem — Ürün Karşılaştırma | `sepet.karsilastir.urun` | Kırılım | Bu ay | karsilastir, tablo |
| Fatura Başına Kalem — Ürün Sınıfı Sıralaması | `sepet.top.sinif` | Kırılım | Bu yıl | cubuk, tablo |
| Fatura Başına Kalem — Ürün Sınıfı Karşılaştırma | `sepet.karsilastir.sinif` | Kırılım | Bu ay | karsilastir, tablo |
| Fatura Başına Kalem — Marka Sıralaması | `sepet.top.marka` | Kırılım | Bu yıl | cubuk, tablo |
| Fatura Başına Kalem — Marka Karşılaştırma | `sepet.karsilastir.marka` | Kırılım | Bu ay | karsilastir, tablo |
| Fatura Başına Kalem — Ürün Türü Sıralaması | `sepet.top.tur` | Kırılım | Bu yıl | cubuk, tablo |
| Fatura Başına Kalem — Ürün Türü Karşılaştırma | `sepet.karsilastir.tur` | Kırılım | Bu ay | karsilastir, tablo |
| Fatura Başına Kalem — Satış Personeli Sıralaması | `sepet.top.satici` | Kırılım | Bu yıl | cubuk, tablo |
| Fatura Başına Kalem — Satış Personeli Karşılaştırma | `sepet.karsilastir.satici` | Kırılım | Bu ay | karsilastir, tablo |
| Fatura Başına Kalem — Firma Sıralaması | `sepet.top.firma` | Kırılım | Bu yıl | cubuk, tablo |
| Fatura Başına Kalem — Firma Karşılaştırma | `sepet.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Fatura Başına Kalem — Haftanın Günü Dağılımı | `sepet.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Fatura Başına Kalem — Ay Dağılımı | `sepet.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Ortalama Birim Fiyat | `birim_fiyat.kpi` | Gösterge | Bu ay | sayi |
| Ortalama Birim Fiyat — Günlük Trend | `birim_fiyat.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Ortalama Birim Fiyat — Haftalık Trend | `birim_fiyat.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Ortalama Birim Fiyat — Aylık Trend | `birim_fiyat.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Ortalama Birim Fiyat — Çeyreklik Trend | `birim_fiyat.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Ortalama Birim Fiyat — Yıllık Trend | `birim_fiyat.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Ortalama Birim Fiyat — Geçen Yılla Günlük | `birim_fiyat.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Ortalama Birim Fiyat — Geçen Yılla Haftalık | `birim_fiyat.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Ortalama Birim Fiyat — Geçen Yılla Aylık | `birim_fiyat.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Ortalama Birim Fiyat — Mevsimsellik | `birim_fiyat.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Ortalama Birim Fiyat — Müşteri Sıralaması | `birim_fiyat.top.cari` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Birim Fiyat — Müşteri Karşılaştırma | `birim_fiyat.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Birim Fiyat — İl Sıralaması | `birim_fiyat.top.il` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Birim Fiyat — İl Karşılaştırma | `birim_fiyat.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Birim Fiyat — Cari Grubu Sıralaması | `birim_fiyat.top.grup` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Birim Fiyat — Cari Grubu Karşılaştırma | `birim_fiyat.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Birim Fiyat — Temsilci Sıralaması | `birim_fiyat.top.temsilci` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Birim Fiyat — Temsilci Karşılaştırma | `birim_fiyat.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Birim Fiyat — Ürün Sıralaması | `birim_fiyat.top.urun` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Birim Fiyat — Ürün Karşılaştırma | `birim_fiyat.karsilastir.urun` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Birim Fiyat — Ürün Sınıfı Sıralaması | `birim_fiyat.top.sinif` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Birim Fiyat — Ürün Sınıfı Karşılaştırma | `birim_fiyat.karsilastir.sinif` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Birim Fiyat — Marka Sıralaması | `birim_fiyat.top.marka` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Birim Fiyat — Marka Karşılaştırma | `birim_fiyat.karsilastir.marka` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Birim Fiyat — Ürün Türü Sıralaması | `birim_fiyat.top.tur` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Birim Fiyat — Ürün Türü Karşılaştırma | `birim_fiyat.karsilastir.tur` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Birim Fiyat — Satış Personeli Sıralaması | `birim_fiyat.top.satici` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Birim Fiyat — Satış Personeli Karşılaştırma | `birim_fiyat.karsilastir.satici` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Birim Fiyat — Firma Sıralaması | `birim_fiyat.top.firma` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Birim Fiyat — Firma Karşılaştırma | `birim_fiyat.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Birim Fiyat — Haftanın Günü Dağılımı | `birim_fiyat.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Ortalama Birim Fiyat — Ay Dağılımı | `birim_fiyat.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Ürün Matrisi (Büyüme × Marj) | `ozel.urun_matrisi` | Tablo | Son 90 gün | tablo |
| Ürün ABC Analizi | `ozel.abc_urun` | Grafik + tablo | Bu ay | coklu |

</details>

<details><summary><b>Stok</b> — 5 rapor</summary>

| Rapor | Kimlik | Sonuç | Varsayılan dönem | Grafikler |
|---|---|---|---|---|
| Stok Değeri | `ozel.stok_degeri` | Kırılım | Bu ay | agac, pasta, cubuk, tablo |
| Eksi Stoklu Ürünler | `ozel.eksi_stok` | Tablo | Bu ay | tablo |
| Kritik Seviyenin Altındakiler | `ozel.kritik_stok` | Tablo | Bu ay | tablo |
| Ölü Stok | `ozel.olu_stok` | Tablo | Bu ay | tablo |
| Stok Devir Hızı | `ozel.stok_devir` | Tablo | Bu ay | tablo |

</details>

<details><summary><b>Tahsilat & Alacak</b> — 153 rapor</summary>

| Rapor | Kimlik | Sonuç | Varsayılan dönem | Grafikler |
|---|---|---|---|---|
| Tahsilat | `tahsilat.kpi` | Gösterge | Bu ay | sayi |
| Tahsilat — Günlük Trend | `tahsilat.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Tahsilat — Haftalık Trend | `tahsilat.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Tahsilat — Aylık Trend | `tahsilat.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Tahsilat — Çeyreklik Trend | `tahsilat.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Tahsilat — Yıllık Trend | `tahsilat.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Tahsilat — Geçen Yılla Günlük | `tahsilat.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Tahsilat — Geçen Yılla Haftalık | `tahsilat.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Tahsilat — Geçen Yılla Aylık | `tahsilat.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Tahsilat — Yıl Boyu Kümülatif | `tahsilat.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Tahsilat — Haftalık Isı Haritası | `tahsilat.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Tahsilat — Mevsimsellik | `tahsilat.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Tahsilat — Müşteri Sıralaması | `tahsilat.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Tahsilat — Müşteri Payları | `tahsilat.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Tahsilat — Müşteri Karşılaştırma | `tahsilat.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Tahsilat — Müşteri ABC (Pareto) | `tahsilat.pareto.cari` | Kırılım | Son 12 ay | pareto, tablo |
| Tahsilat — İl Sıralaması | `tahsilat.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Tahsilat — İl Payları | `tahsilat.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Tahsilat — İl Karşılaştırma | `tahsilat.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Tahsilat — Cari Grubu Sıralaması | `tahsilat.top.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Tahsilat — Cari Grubu Payları | `tahsilat.pay.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Tahsilat — Cari Grubu Karşılaştırma | `tahsilat.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Tahsilat — Temsilci Sıralaması | `tahsilat.top.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Tahsilat — Temsilci Payları | `tahsilat.pay.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Tahsilat — Temsilci Karşılaştırma | `tahsilat.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Tahsilat — Firma Sıralaması | `tahsilat.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Tahsilat — Firma Payları | `tahsilat.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Tahsilat — Firma Karşılaştırma | `tahsilat.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Tahsilat — Haftanın Günü Dağılımı | `tahsilat.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Tahsilat — Ay Dağılımı | `tahsilat.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Tahsilat — Saat Dağılımı | `tahsilat.dagilim.saat` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Bordro Tahsilatı | `tahsilat_bordro.kpi` | Gösterge | Bu ay | sayi |
| Bordro Tahsilatı — Günlük Trend | `tahsilat_bordro.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Bordro Tahsilatı — Haftalık Trend | `tahsilat_bordro.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Bordro Tahsilatı — Aylık Trend | `tahsilat_bordro.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Bordro Tahsilatı — Çeyreklik Trend | `tahsilat_bordro.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Bordro Tahsilatı — Yıllık Trend | `tahsilat_bordro.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Bordro Tahsilatı — Geçen Yılla Günlük | `tahsilat_bordro.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Bordro Tahsilatı — Geçen Yılla Haftalık | `tahsilat_bordro.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Bordro Tahsilatı — Geçen Yılla Aylık | `tahsilat_bordro.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Bordro Tahsilatı — Yıl Boyu Kümülatif | `tahsilat_bordro.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Bordro Tahsilatı — Haftalık Isı Haritası | `tahsilat_bordro.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Bordro Tahsilatı — Mevsimsellik | `tahsilat_bordro.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Bordro Tahsilatı — Müşteri Sıralaması | `tahsilat_bordro.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Bordro Tahsilatı — Müşteri Payları | `tahsilat_bordro.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Bordro Tahsilatı — Müşteri Karşılaştırma | `tahsilat_bordro.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Bordro Tahsilatı — Müşteri ABC (Pareto) | `tahsilat_bordro.pareto.cari` | Kırılım | Son 12 ay | pareto, tablo |
| Bordro Tahsilatı — İl Sıralaması | `tahsilat_bordro.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Bordro Tahsilatı — İl Payları | `tahsilat_bordro.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Bordro Tahsilatı — İl Karşılaştırma | `tahsilat_bordro.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Bordro Tahsilatı — Cari Grubu Sıralaması | `tahsilat_bordro.top.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Bordro Tahsilatı — Cari Grubu Payları | `tahsilat_bordro.pay.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Bordro Tahsilatı — Cari Grubu Karşılaştırma | `tahsilat_bordro.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Bordro Tahsilatı — Temsilci Sıralaması | `tahsilat_bordro.top.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Bordro Tahsilatı — Temsilci Payları | `tahsilat_bordro.pay.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Bordro Tahsilatı — Temsilci Karşılaştırma | `tahsilat_bordro.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Bordro Tahsilatı — Firma Sıralaması | `tahsilat_bordro.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Bordro Tahsilatı — Firma Payları | `tahsilat_bordro.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Bordro Tahsilatı — Firma Karşılaştırma | `tahsilat_bordro.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Bordro Tahsilatı — Haftanın Günü Dağılımı | `tahsilat_bordro.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Bordro Tahsilatı — Ay Dağılımı | `tahsilat_bordro.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Bordro Tahsilatı — Saat Dağılımı | `tahsilat_bordro.dagilim.saat` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Havale Tahsilatı | `tahsilat_havale.kpi` | Gösterge | Bu ay | sayi |
| Havale Tahsilatı — Günlük Trend | `tahsilat_havale.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Havale Tahsilatı — Haftalık Trend | `tahsilat_havale.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Havale Tahsilatı — Aylık Trend | `tahsilat_havale.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Havale Tahsilatı — Çeyreklik Trend | `tahsilat_havale.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Havale Tahsilatı — Yıllık Trend | `tahsilat_havale.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Havale Tahsilatı — Geçen Yılla Günlük | `tahsilat_havale.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Havale Tahsilatı — Geçen Yılla Haftalık | `tahsilat_havale.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Havale Tahsilatı — Geçen Yılla Aylık | `tahsilat_havale.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Havale Tahsilatı — Yıl Boyu Kümülatif | `tahsilat_havale.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Havale Tahsilatı — Haftalık Isı Haritası | `tahsilat_havale.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Havale Tahsilatı — Mevsimsellik | `tahsilat_havale.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Havale Tahsilatı — Müşteri Sıralaması | `tahsilat_havale.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Havale Tahsilatı — Müşteri Payları | `tahsilat_havale.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Havale Tahsilatı — Müşteri Karşılaştırma | `tahsilat_havale.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Havale Tahsilatı — Müşteri ABC (Pareto) | `tahsilat_havale.pareto.cari` | Kırılım | Son 12 ay | pareto, tablo |
| Havale Tahsilatı — İl Sıralaması | `tahsilat_havale.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Havale Tahsilatı — İl Payları | `tahsilat_havale.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Havale Tahsilatı — İl Karşılaştırma | `tahsilat_havale.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Havale Tahsilatı — Cari Grubu Sıralaması | `tahsilat_havale.top.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Havale Tahsilatı — Cari Grubu Payları | `tahsilat_havale.pay.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Havale Tahsilatı — Cari Grubu Karşılaştırma | `tahsilat_havale.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Havale Tahsilatı — Temsilci Sıralaması | `tahsilat_havale.top.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Havale Tahsilatı — Temsilci Payları | `tahsilat_havale.pay.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Havale Tahsilatı — Temsilci Karşılaştırma | `tahsilat_havale.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Havale Tahsilatı — Firma Sıralaması | `tahsilat_havale.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Havale Tahsilatı — Firma Payları | `tahsilat_havale.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Havale Tahsilatı — Firma Karşılaştırma | `tahsilat_havale.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Havale Tahsilatı — Haftanın Günü Dağılımı | `tahsilat_havale.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Havale Tahsilatı — Ay Dağılımı | `tahsilat_havale.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Havale Tahsilatı — Saat Dağılımı | `tahsilat_havale.dagilim.saat` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Tahsilat Oranı | `tahsilat_orani.kpi` | Gösterge | Bu ay | sayi |
| Tahsilat Oranı — Günlük Trend | `tahsilat_orani.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Tahsilat Oranı — Haftalık Trend | `tahsilat_orani.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Tahsilat Oranı — Aylık Trend | `tahsilat_orani.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Tahsilat Oranı — Çeyreklik Trend | `tahsilat_orani.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Tahsilat Oranı — Yıllık Trend | `tahsilat_orani.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Tahsilat Oranı — Geçen Yılla Günlük | `tahsilat_orani.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Tahsilat Oranı — Geçen Yılla Haftalık | `tahsilat_orani.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Tahsilat Oranı — Geçen Yılla Aylık | `tahsilat_orani.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Tahsilat Oranı — Mevsimsellik | `tahsilat_orani.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Tahsilat Oranı — Müşteri Sıralaması | `tahsilat_orani.top.cari` | Kırılım | Bu yıl | cubuk, tablo |
| Tahsilat Oranı — Müşteri Karşılaştırma | `tahsilat_orani.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Tahsilat Oranı — İl Sıralaması | `tahsilat_orani.top.il` | Kırılım | Bu yıl | cubuk, tablo |
| Tahsilat Oranı — İl Karşılaştırma | `tahsilat_orani.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Tahsilat Oranı — Cari Grubu Sıralaması | `tahsilat_orani.top.grup` | Kırılım | Bu yıl | cubuk, tablo |
| Tahsilat Oranı — Cari Grubu Karşılaştırma | `tahsilat_orani.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Tahsilat Oranı — Temsilci Sıralaması | `tahsilat_orani.top.temsilci` | Kırılım | Bu yıl | cubuk, tablo |
| Tahsilat Oranı — Temsilci Karşılaştırma | `tahsilat_orani.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Tahsilat Oranı — Firma Sıralaması | `tahsilat_orani.top.firma` | Kırılım | Bu yıl | cubuk, tablo |
| Tahsilat Oranı — Firma Karşılaştırma | `tahsilat_orani.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Tahsilat Oranı — Haftanın Günü Dağılımı | `tahsilat_orani.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Tahsilat Oranı — Ay Dağılımı | `tahsilat_orani.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Tahsilat Oranı — Saat Dağılımı | `tahsilat_orani.dagilim.saat` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Ticari Nakit Dengesi | `ticari_denge.kpi` | Gösterge | Bu ay | sayi |
| Ticari Nakit Dengesi — Günlük Trend | `ticari_denge.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Ticari Nakit Dengesi — Haftalık Trend | `ticari_denge.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Ticari Nakit Dengesi — Aylık Trend | `ticari_denge.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Ticari Nakit Dengesi — Çeyreklik Trend | `ticari_denge.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Ticari Nakit Dengesi — Yıllık Trend | `ticari_denge.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Ticari Nakit Dengesi — Geçen Yılla Günlük | `ticari_denge.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Ticari Nakit Dengesi — Geçen Yılla Haftalık | `ticari_denge.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Ticari Nakit Dengesi — Geçen Yılla Aylık | `ticari_denge.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Ticari Nakit Dengesi — Yıl Boyu Kümülatif | `ticari_denge.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Ticari Nakit Dengesi — Haftalık Isı Haritası | `ticari_denge.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Ticari Nakit Dengesi — Mevsimsellik | `ticari_denge.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Ticari Nakit Dengesi — Müşteri Sıralaması | `ticari_denge.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ticari Nakit Dengesi — Müşteri Payları | `ticari_denge.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ticari Nakit Dengesi — Müşteri Karşılaştırma | `ticari_denge.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Ticari Nakit Dengesi — Müşteri ABC (Pareto) | `ticari_denge.pareto.cari` | Kırılım | Son 12 ay | pareto, tablo |
| Ticari Nakit Dengesi — İl Sıralaması | `ticari_denge.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ticari Nakit Dengesi — İl Payları | `ticari_denge.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ticari Nakit Dengesi — İl Karşılaştırma | `ticari_denge.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Ticari Nakit Dengesi — Cari Grubu Sıralaması | `ticari_denge.top.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ticari Nakit Dengesi — Cari Grubu Payları | `ticari_denge.pay.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ticari Nakit Dengesi — Cari Grubu Karşılaştırma | `ticari_denge.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Ticari Nakit Dengesi — Temsilci Sıralaması | `ticari_denge.top.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ticari Nakit Dengesi — Temsilci Payları | `ticari_denge.pay.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ticari Nakit Dengesi — Temsilci Karşılaştırma | `ticari_denge.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Ticari Nakit Dengesi — Firma Sıralaması | `ticari_denge.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ticari Nakit Dengesi — Firma Payları | `ticari_denge.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ticari Nakit Dengesi — Firma Karşılaştırma | `ticari_denge.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Ticari Nakit Dengesi — Haftanın Günü Dağılımı | `ticari_denge.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Ticari Nakit Dengesi — Ay Dağılımı | `ticari_denge.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Ticari Nakit Dengesi — Saat Dağılımı | `ticari_denge.dagilim.saat` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Alacak Yaşlandırma | `ozel.alacak_yaslandirma` | Grafik + tablo | Bu ay | coklu |
| Borçlu Müşteriler | `ozel.borclu_musteriler` | Tablo | Bu ay | tablo |
| Hareketsiz Alacaklar | `ozel.hareketsiz_alacak` | Tablo | Bu ay | tablo |
| Kredi Limiti Aşımı | `ozel.limit_asimi` | Tablo | Bu ay | tablo |
| Tahsil Süresi (DSO) Seyri | `ozel.dso_seyri` | Zaman serisi | Son 12 ay | cizgi, sutun, tablo |
| Alacak ve Borç Seyri | `ozel.alacak_borc_seyri` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |

</details>

<details><summary><b>Alış & Tedarik</b> — 131 rapor</summary>

| Rapor | Kimlik | Sonuç | Varsayılan dönem | Grafikler |
|---|---|---|---|---|
| Alış (KDV dahil) | `alis.kpi` | Gösterge | Bu ay | sayi |
| Alış (KDV dahil) — Günlük Trend | `alis.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Alış (KDV dahil) — Haftalık Trend | `alis.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Alış (KDV dahil) — Aylık Trend | `alis.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Alış (KDV dahil) — Çeyreklik Trend | `alis.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Alış (KDV dahil) — Yıllık Trend | `alis.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Alış (KDV dahil) — Geçen Yılla Günlük | `alis.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Alış (KDV dahil) — Geçen Yılla Haftalık | `alis.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Alış (KDV dahil) — Geçen Yılla Aylık | `alis.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Alış (KDV dahil) — Yıl Boyu Kümülatif | `alis.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Alış (KDV dahil) — Haftalık Isı Haritası | `alis.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Alış (KDV dahil) — Mevsimsellik | `alis.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Alış (KDV dahil) — Tedarikçi Sıralaması | `alis.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV dahil) — Tedarikçi Payları | `alis.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV dahil) — Tedarikçi Karşılaştırma | `alis.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Alış (KDV dahil) — Tedarikçi ABC (Pareto) | `alis.pareto.cari` | Kırılım | Son 12 ay | pareto, tablo |
| Alış (KDV dahil) — İl Sıralaması | `alis.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV dahil) — İl Payları | `alis.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV dahil) — İl Karşılaştırma | `alis.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Alış (KDV dahil) — Cari Grubu Sıralaması | `alis.top.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV dahil) — Cari Grubu Payları | `alis.pay.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV dahil) — Cari Grubu Karşılaştırma | `alis.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Alış (KDV dahil) — Temsilci Sıralaması | `alis.top.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV dahil) — Temsilci Payları | `alis.pay.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV dahil) — Temsilci Karşılaştırma | `alis.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Alış (KDV dahil) — Firma Sıralaması | `alis.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV dahil) — Firma Payları | `alis.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV dahil) — Firma Karşılaştırma | `alis.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Alış (KDV dahil) — Haftanın Günü Dağılımı | `alis.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Alış (KDV dahil) — Ay Dağılımı | `alis.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Alış (KDV dahil) — Saat Dağılımı | `alis.dagilim.saat` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Ödeme (Tediye) | `tediye.kpi` | Gösterge | Bu ay | sayi |
| Ödeme (Tediye) — Günlük Trend | `tediye.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Ödeme (Tediye) — Haftalık Trend | `tediye.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Ödeme (Tediye) — Aylık Trend | `tediye.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Ödeme (Tediye) — Çeyreklik Trend | `tediye.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Ödeme (Tediye) — Yıllık Trend | `tediye.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Ödeme (Tediye) — Geçen Yılla Günlük | `tediye.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Ödeme (Tediye) — Geçen Yılla Haftalık | `tediye.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Ödeme (Tediye) — Geçen Yılla Aylık | `tediye.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Ödeme (Tediye) — Yıl Boyu Kümülatif | `tediye.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Ödeme (Tediye) — Haftalık Isı Haritası | `tediye.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Ödeme (Tediye) — Mevsimsellik | `tediye.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Ödeme (Tediye) — Tedarikçi Sıralaması | `tediye.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ödeme (Tediye) — Tedarikçi Payları | `tediye.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ödeme (Tediye) — Tedarikçi Karşılaştırma | `tediye.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Ödeme (Tediye) — Tedarikçi ABC (Pareto) | `tediye.pareto.cari` | Kırılım | Son 12 ay | pareto, tablo |
| Ödeme (Tediye) — İl Sıralaması | `tediye.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ödeme (Tediye) — İl Payları | `tediye.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ödeme (Tediye) — İl Karşılaştırma | `tediye.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Ödeme (Tediye) — Cari Grubu Sıralaması | `tediye.top.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ödeme (Tediye) — Cari Grubu Payları | `tediye.pay.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ödeme (Tediye) — Cari Grubu Karşılaştırma | `tediye.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Ödeme (Tediye) — Temsilci Sıralaması | `tediye.top.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ödeme (Tediye) — Temsilci Payları | `tediye.pay.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ödeme (Tediye) — Temsilci Karşılaştırma | `tediye.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Ödeme (Tediye) — Firma Sıralaması | `tediye.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ödeme (Tediye) — Firma Payları | `tediye.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Ödeme (Tediye) — Firma Karşılaştırma | `tediye.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Ödeme (Tediye) — Haftanın Günü Dağılımı | `tediye.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Ödeme (Tediye) — Ay Dağılımı | `tediye.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Ödeme (Tediye) — Saat Dağılımı | `tediye.dagilim.saat` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Alış (KDV hariç, satır) | `alis_net.kpi` | Gösterge | Bu ay | sayi |
| Alış (KDV hariç, satır) — Günlük Trend | `alis_net.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Alış (KDV hariç, satır) — Haftalık Trend | `alis_net.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Alış (KDV hariç, satır) — Aylık Trend | `alis_net.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Alış (KDV hariç, satır) — Çeyreklik Trend | `alis_net.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Alış (KDV hariç, satır) — Yıllık Trend | `alis_net.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Alış (KDV hariç, satır) — Geçen Yılla Günlük | `alis_net.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Alış (KDV hariç, satır) — Geçen Yılla Haftalık | `alis_net.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Alış (KDV hariç, satır) — Geçen Yılla Aylık | `alis_net.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Alış (KDV hariç, satır) — Yıl Boyu Kümülatif | `alis_net.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Alış (KDV hariç, satır) — Haftalık Isı Haritası | `alis_net.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Alış (KDV hariç, satır) — Mevsimsellik | `alis_net.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Alış (KDV hariç, satır) — Tedarikçi Sıralaması | `alis_net.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV hariç, satır) — Tedarikçi Payları | `alis_net.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV hariç, satır) — Tedarikçi Karşılaştırma | `alis_net.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Alış (KDV hariç, satır) — Tedarikçi ABC (Pareto) | `alis_net.pareto.cari` | Kırılım | Son 12 ay | pareto, tablo |
| Alış (KDV hariç, satır) — İl Sıralaması | `alis_net.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV hariç, satır) — İl Payları | `alis_net.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV hariç, satır) — İl Karşılaştırma | `alis_net.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Alış (KDV hariç, satır) — Ürün Sıralaması | `alis_net.top.urun` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV hariç, satır) — Ürün Payları | `alis_net.pay.urun` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV hariç, satır) — Ürün Karşılaştırma | `alis_net.karsilastir.urun` | Kırılım | Bu ay | karsilastir, tablo |
| Alış (KDV hariç, satır) — Ürün ABC (Pareto) | `alis_net.pareto.urun` | Kırılım | Son 12 ay | pareto, tablo |
| Alış (KDV hariç, satır) — Ürün Sınıfı Sıralaması | `alis_net.top.sinif` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV hariç, satır) — Ürün Sınıfı Payları | `alis_net.pay.sinif` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV hariç, satır) — Ürün Sınıfı Karşılaştırma | `alis_net.karsilastir.sinif` | Kırılım | Bu ay | karsilastir, tablo |
| Alış (KDV hariç, satır) — Marka Sıralaması | `alis_net.top.marka` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV hariç, satır) — Marka Payları | `alis_net.pay.marka` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV hariç, satır) — Marka Karşılaştırma | `alis_net.karsilastir.marka` | Kırılım | Bu ay | karsilastir, tablo |
| Alış (KDV hariç, satır) — Firma Sıralaması | `alis_net.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV hariç, satır) — Firma Payları | `alis_net.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış (KDV hariç, satır) — Firma Karşılaştırma | `alis_net.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Alış (KDV hariç, satır) — Haftanın Günü Dağılımı | `alis_net.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Alış (KDV hariç, satır) — Ay Dağılımı | `alis_net.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Alış Miktarı | `alis_miktar.kpi` | Gösterge | Bu ay | sayi |
| Alış Miktarı — Günlük Trend | `alis_miktar.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Alış Miktarı — Haftalık Trend | `alis_miktar.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Alış Miktarı — Aylık Trend | `alis_miktar.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Alış Miktarı — Çeyreklik Trend | `alis_miktar.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Alış Miktarı — Yıllık Trend | `alis_miktar.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Alış Miktarı — Geçen Yılla Günlük | `alis_miktar.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Alış Miktarı — Geçen Yılla Haftalık | `alis_miktar.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Alış Miktarı — Geçen Yılla Aylık | `alis_miktar.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Alış Miktarı — Yıl Boyu Kümülatif | `alis_miktar.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Alış Miktarı — Haftalık Isı Haritası | `alis_miktar.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Alış Miktarı — Mevsimsellik | `alis_miktar.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Alış Miktarı — Tedarikçi Sıralaması | `alis_miktar.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış Miktarı — Tedarikçi Payları | `alis_miktar.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış Miktarı — Tedarikçi Karşılaştırma | `alis_miktar.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Alış Miktarı — Tedarikçi ABC (Pareto) | `alis_miktar.pareto.cari` | Kırılım | Son 12 ay | pareto, tablo |
| Alış Miktarı — İl Sıralaması | `alis_miktar.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış Miktarı — İl Payları | `alis_miktar.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış Miktarı — İl Karşılaştırma | `alis_miktar.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Alış Miktarı — Ürün Sıralaması | `alis_miktar.top.urun` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış Miktarı — Ürün Payları | `alis_miktar.pay.urun` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış Miktarı — Ürün Karşılaştırma | `alis_miktar.karsilastir.urun` | Kırılım | Bu ay | karsilastir, tablo |
| Alış Miktarı — Ürün ABC (Pareto) | `alis_miktar.pareto.urun` | Kırılım | Son 12 ay | pareto, tablo |
| Alış Miktarı — Ürün Sınıfı Sıralaması | `alis_miktar.top.sinif` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış Miktarı — Ürün Sınıfı Payları | `alis_miktar.pay.sinif` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış Miktarı — Ürün Sınıfı Karşılaştırma | `alis_miktar.karsilastir.sinif` | Kırılım | Bu ay | karsilastir, tablo |
| Alış Miktarı — Marka Sıralaması | `alis_miktar.top.marka` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış Miktarı — Marka Payları | `alis_miktar.pay.marka` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış Miktarı — Marka Karşılaştırma | `alis_miktar.karsilastir.marka` | Kırılım | Bu ay | karsilastir, tablo |
| Alış Miktarı — Firma Sıralaması | `alis_miktar.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış Miktarı — Firma Payları | `alis_miktar.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alış Miktarı — Firma Karşılaştırma | `alis_miktar.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Alış Miktarı — Haftanın Günü Dağılımı | `alis_miktar.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Alış Miktarı — Ay Dağılımı | `alis_miktar.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Borçlu Olduğumuz Cariler | `ozel.alacakli_tedarikciler` | Tablo | Bu ay | tablo |

</details>

<details><summary><b>Kasa</b> — 95 rapor</summary>

| Rapor | Kimlik | Sonuç | Varsayılan dönem | Grafikler |
|---|---|---|---|---|
| Kasa Girişi | `kasa_giris.kpi` | Gösterge | Bu ay | sayi |
| Kasa Girişi — Günlük Trend | `kasa_giris.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Kasa Girişi — Haftalık Trend | `kasa_giris.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Kasa Girişi — Aylık Trend | `kasa_giris.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Kasa Girişi — Çeyreklik Trend | `kasa_giris.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Kasa Girişi — Yıllık Trend | `kasa_giris.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Kasa Girişi — Geçen Yılla Günlük | `kasa_giris.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Kasa Girişi — Geçen Yılla Haftalık | `kasa_giris.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Kasa Girişi — Geçen Yılla Aylık | `kasa_giris.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Kasa Girişi — Yıl Boyu Kümülatif | `kasa_giris.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Kasa Girişi — Haftalık Isı Haritası | `kasa_giris.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Kasa Girişi — Mevsimsellik | `kasa_giris.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Kasa Girişi — Kasa Sıralaması | `kasa_giris.top.kasa` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Girişi — Kasa Payları | `kasa_giris.pay.kasa` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Girişi — Kasa Karşılaştırma | `kasa_giris.karsilastir.kasa` | Kırılım | Bu ay | karsilastir, tablo |
| Kasa Girişi — Şube Sıralaması | `kasa_giris.top.sube` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Girişi — Şube Payları | `kasa_giris.pay.sube` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Girişi — Şube Karşılaştırma | `kasa_giris.karsilastir.sube` | Kırılım | Bu ay | karsilastir, tablo |
| Kasa Girişi — Firma Sıralaması | `kasa_giris.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Girişi — Firma Payları | `kasa_giris.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Girişi — Firma Karşılaştırma | `kasa_giris.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Kasa Girişi — Haftanın Günü Dağılımı | `kasa_giris.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Kasa Girişi — Ay Dağılımı | `kasa_giris.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Kasa Çıkışı | `kasa_cikis.kpi` | Gösterge | Bu ay | sayi |
| Kasa Çıkışı — Günlük Trend | `kasa_cikis.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Kasa Çıkışı — Haftalık Trend | `kasa_cikis.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Kasa Çıkışı — Aylık Trend | `kasa_cikis.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Kasa Çıkışı — Çeyreklik Trend | `kasa_cikis.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Kasa Çıkışı — Yıllık Trend | `kasa_cikis.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Kasa Çıkışı — Geçen Yılla Günlük | `kasa_cikis.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Kasa Çıkışı — Geçen Yılla Haftalık | `kasa_cikis.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Kasa Çıkışı — Geçen Yılla Aylık | `kasa_cikis.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Kasa Çıkışı — Yıl Boyu Kümülatif | `kasa_cikis.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Kasa Çıkışı — Haftalık Isı Haritası | `kasa_cikis.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Kasa Çıkışı — Mevsimsellik | `kasa_cikis.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Kasa Çıkışı — Kasa Sıralaması | `kasa_cikis.top.kasa` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Çıkışı — Kasa Payları | `kasa_cikis.pay.kasa` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Çıkışı — Kasa Karşılaştırma | `kasa_cikis.karsilastir.kasa` | Kırılım | Bu ay | karsilastir, tablo |
| Kasa Çıkışı — Şube Sıralaması | `kasa_cikis.top.sube` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Çıkışı — Şube Payları | `kasa_cikis.pay.sube` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Çıkışı — Şube Karşılaştırma | `kasa_cikis.karsilastir.sube` | Kırılım | Bu ay | karsilastir, tablo |
| Kasa Çıkışı — Firma Sıralaması | `kasa_cikis.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Çıkışı — Firma Payları | `kasa_cikis.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Çıkışı — Firma Karşılaştırma | `kasa_cikis.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Kasa Çıkışı — Haftanın Günü Dağılımı | `kasa_cikis.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Kasa Çıkışı — Ay Dağılımı | `kasa_cikis.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Kasa Net Akışı | `kasa_net.kpi` | Gösterge | Bu ay | sayi |
| Kasa Net Akışı — Günlük Trend | `kasa_net.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Kasa Net Akışı — Haftalık Trend | `kasa_net.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Kasa Net Akışı — Aylık Trend | `kasa_net.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Kasa Net Akışı — Çeyreklik Trend | `kasa_net.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Kasa Net Akışı — Yıllık Trend | `kasa_net.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Kasa Net Akışı — Geçen Yılla Günlük | `kasa_net.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Kasa Net Akışı — Geçen Yılla Haftalık | `kasa_net.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Kasa Net Akışı — Geçen Yılla Aylık | `kasa_net.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Kasa Net Akışı — Yıl Boyu Kümülatif | `kasa_net.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Kasa Net Akışı — Haftalık Isı Haritası | `kasa_net.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Kasa Net Akışı — Mevsimsellik | `kasa_net.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Kasa Net Akışı — Kasa Sıralaması | `kasa_net.top.kasa` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Net Akışı — Kasa Payları | `kasa_net.pay.kasa` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Net Akışı — Kasa Karşılaştırma | `kasa_net.karsilastir.kasa` | Kırılım | Bu ay | karsilastir, tablo |
| Kasa Net Akışı — Şube Sıralaması | `kasa_net.top.sube` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Net Akışı — Şube Payları | `kasa_net.pay.sube` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Net Akışı — Şube Karşılaştırma | `kasa_net.karsilastir.sube` | Kırılım | Bu ay | karsilastir, tablo |
| Kasa Net Akışı — Firma Sıralaması | `kasa_net.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Net Akışı — Firma Payları | `kasa_net.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Net Akışı — Firma Karşılaştırma | `kasa_net.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Kasa Net Akışı — Haftanın Günü Dağılımı | `kasa_net.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Kasa Net Akışı — Ay Dağılımı | `kasa_net.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Kasa Masrafları (cari dışı) | `kasa_gider_diger.kpi` | Gösterge | Bu ay | sayi |
| Kasa Masrafları (cari dışı) — Günlük Trend | `kasa_gider_diger.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Kasa Masrafları (cari dışı) — Haftalık Trend | `kasa_gider_diger.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Kasa Masrafları (cari dışı) — Aylık Trend | `kasa_gider_diger.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Kasa Masrafları (cari dışı) — Çeyreklik Trend | `kasa_gider_diger.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Kasa Masrafları (cari dışı) — Yıllık Trend | `kasa_gider_diger.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Kasa Masrafları (cari dışı) — Geçen Yılla Günlük | `kasa_gider_diger.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Kasa Masrafları (cari dışı) — Geçen Yılla Haftalık | `kasa_gider_diger.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Kasa Masrafları (cari dışı) — Geçen Yılla Aylık | `kasa_gider_diger.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Kasa Masrafları (cari dışı) — Yıl Boyu Kümülatif | `kasa_gider_diger.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Kasa Masrafları (cari dışı) — Haftalık Isı Haritası | `kasa_gider_diger.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Kasa Masrafları (cari dışı) — Mevsimsellik | `kasa_gider_diger.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Kasa Masrafları (cari dışı) — Kasa Sıralaması | `kasa_gider_diger.top.kasa` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Masrafları (cari dışı) — Kasa Payları | `kasa_gider_diger.pay.kasa` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Masrafları (cari dışı) — Kasa Karşılaştırma | `kasa_gider_diger.karsilastir.kasa` | Kırılım | Bu ay | karsilastir, tablo |
| Kasa Masrafları (cari dışı) — Şube Sıralaması | `kasa_gider_diger.top.sube` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Masrafları (cari dışı) — Şube Payları | `kasa_gider_diger.pay.sube` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Masrafları (cari dışı) — Şube Karşılaştırma | `kasa_gider_diger.karsilastir.sube` | Kırılım | Bu ay | karsilastir, tablo |
| Kasa Masrafları (cari dışı) — Firma Sıralaması | `kasa_gider_diger.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Masrafları (cari dışı) — Firma Payları | `kasa_gider_diger.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Kasa Masrafları (cari dışı) — Firma Karşılaştırma | `kasa_gider_diger.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Kasa Masrafları (cari dışı) — Haftanın Günü Dağılımı | `kasa_gider_diger.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Kasa Masrafları (cari dışı) — Ay Dağılımı | `kasa_gider_diger.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Kasa Bakiyeleri | `ozel.kasa_durumu` | Kırılım | Bu ay | cubuk, tablo |
| Kasa Bakiyesi Seyri | `ozel.kasa_bakiye_seyri` | Zaman serisi | Son 12 ay | alan, cizgi, sutun, tablo |
| Likidite Seyri (Kasa + Banka) | `ozel.likidite_seyri` | Zaman serisi | Son 12 ay | alan, cizgi, tablo |

</details>

<details><summary><b>Banka</b> — 63 rapor</summary>

| Rapor | Kimlik | Sonuç | Varsayılan dönem | Grafikler |
|---|---|---|---|---|
| Banka Girişi | `banka_giris.kpi` | Gösterge | Bu ay | sayi |
| Banka Girişi — Günlük Trend | `banka_giris.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Banka Girişi — Haftalık Trend | `banka_giris.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Banka Girişi — Aylık Trend | `banka_giris.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Banka Girişi — Çeyreklik Trend | `banka_giris.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Banka Girişi — Yıllık Trend | `banka_giris.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Banka Girişi — Geçen Yılla Günlük | `banka_giris.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Banka Girişi — Geçen Yılla Haftalık | `banka_giris.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Banka Girişi — Geçen Yılla Aylık | `banka_giris.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Banka Girişi — Yıl Boyu Kümülatif | `banka_giris.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Banka Girişi — Haftalık Isı Haritası | `banka_giris.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Banka Girişi — Mevsimsellik | `banka_giris.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Banka Girişi — Banka Hesabı Sıralaması | `banka_giris.top.hesap` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Banka Girişi — Banka Hesabı Payları | `banka_giris.pay.hesap` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Banka Girişi — Banka Hesabı Karşılaştırma | `banka_giris.karsilastir.hesap` | Kırılım | Bu ay | karsilastir, tablo |
| Banka Girişi — Firma Sıralaması | `banka_giris.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Banka Girişi — Firma Payları | `banka_giris.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Banka Girişi — Firma Karşılaştırma | `banka_giris.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Banka Girişi — Haftanın Günü Dağılımı | `banka_giris.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Banka Girişi — Ay Dağılımı | `banka_giris.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Banka Çıkışı | `banka_cikis.kpi` | Gösterge | Bu ay | sayi |
| Banka Çıkışı — Günlük Trend | `banka_cikis.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Banka Çıkışı — Haftalık Trend | `banka_cikis.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Banka Çıkışı — Aylık Trend | `banka_cikis.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Banka Çıkışı — Çeyreklik Trend | `banka_cikis.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Banka Çıkışı — Yıllık Trend | `banka_cikis.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Banka Çıkışı — Geçen Yılla Günlük | `banka_cikis.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Banka Çıkışı — Geçen Yılla Haftalık | `banka_cikis.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Banka Çıkışı — Geçen Yılla Aylık | `banka_cikis.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Banka Çıkışı — Yıl Boyu Kümülatif | `banka_cikis.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Banka Çıkışı — Haftalık Isı Haritası | `banka_cikis.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Banka Çıkışı — Mevsimsellik | `banka_cikis.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Banka Çıkışı — Banka Hesabı Sıralaması | `banka_cikis.top.hesap` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Banka Çıkışı — Banka Hesabı Payları | `banka_cikis.pay.hesap` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Banka Çıkışı — Banka Hesabı Karşılaştırma | `banka_cikis.karsilastir.hesap` | Kırılım | Bu ay | karsilastir, tablo |
| Banka Çıkışı — Firma Sıralaması | `banka_cikis.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Banka Çıkışı — Firma Payları | `banka_cikis.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Banka Çıkışı — Firma Karşılaştırma | `banka_cikis.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Banka Çıkışı — Haftanın Günü Dağılımı | `banka_cikis.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Banka Çıkışı — Ay Dağılımı | `banka_cikis.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Banka Net Akışı | `banka_net.kpi` | Gösterge | Bu ay | sayi |
| Banka Net Akışı — Günlük Trend | `banka_net.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Banka Net Akışı — Haftalık Trend | `banka_net.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Banka Net Akışı — Aylık Trend | `banka_net.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Banka Net Akışı — Çeyreklik Trend | `banka_net.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Banka Net Akışı — Yıllık Trend | `banka_net.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Banka Net Akışı — Geçen Yılla Günlük | `banka_net.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Banka Net Akışı — Geçen Yılla Haftalık | `banka_net.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Banka Net Akışı — Geçen Yılla Aylık | `banka_net.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Banka Net Akışı — Yıl Boyu Kümülatif | `banka_net.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Banka Net Akışı — Haftalık Isı Haritası | `banka_net.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Banka Net Akışı — Mevsimsellik | `banka_net.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Banka Net Akışı — Banka Hesabı Sıralaması | `banka_net.top.hesap` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Banka Net Akışı — Banka Hesabı Payları | `banka_net.pay.hesap` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Banka Net Akışı — Banka Hesabı Karşılaştırma | `banka_net.karsilastir.hesap` | Kırılım | Bu ay | karsilastir, tablo |
| Banka Net Akışı — Firma Sıralaması | `banka_net.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Banka Net Akışı — Firma Payları | `banka_net.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Banka Net Akışı — Firma Karşılaştırma | `banka_net.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Banka Net Akışı — Haftanın Günü Dağılımı | `banka_net.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Banka Net Akışı — Ay Dağılımı | `banka_net.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Banka Hesap Bakiyeleri | `ozel.banka_durumu` | Kırılım | Bu ay | cubuk, tablo |
| Banka Bakiyesi Seyri | `ozel.banka_bakiye_seyri` | Zaman serisi | Son 12 ay | alan, cizgi, sutun, tablo |
| Döviz Pozisyonu | `ozel.doviz` | Tablo | Bu ay | tablo |

</details>

<details><summary><b>Çek & Senet</b> — 6 rapor</summary>

| Rapor | Kimlik | Sonuç | Varsayılan dönem | Grafikler |
|---|---|---|---|---|
| Alınan Çekler (Portföy) | `ozel.cek_alinan` | Tablo | Bu ay | tablo |
| Verilen Çekler (Ödenecek) | `ozel.cek_verilen` | Tablo | Bu ay | tablo |
| Alınan Senetler | `ozel.senet_alinan` | Tablo | Bu ay | tablo |
| Verilen Senetler | `ozel.senet_verilen` | Tablo | Bu ay | tablo |
| Vade Takvimi (Haftalık) | `ozel.vade_takvimi` | Zaman serisi | Bu ay | sutun, tablo |
| Alınan Çekler — Banka Dağılımı | `ozel.cek_banka` | Kırılım | Bu ay | pasta, cubuk, tablo |

</details>

<details><summary><b>Sipariş</b> — 82 rapor</summary>

| Rapor | Kimlik | Sonuç | Varsayılan dönem | Grafikler |
|---|---|---|---|---|
| Alınan Sipariş Tutarı | `siparis_tutar.kpi` | Gösterge | Bu ay | sayi |
| Alınan Sipariş Tutarı — Günlük Trend | `siparis_tutar.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Alınan Sipariş Tutarı — Haftalık Trend | `siparis_tutar.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Alınan Sipariş Tutarı — Aylık Trend | `siparis_tutar.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Alınan Sipariş Tutarı — Çeyreklik Trend | `siparis_tutar.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Alınan Sipariş Tutarı — Yıllık Trend | `siparis_tutar.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Alınan Sipariş Tutarı — Geçen Yılla Günlük | `siparis_tutar.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Alınan Sipariş Tutarı — Geçen Yılla Haftalık | `siparis_tutar.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Alınan Sipariş Tutarı — Geçen Yılla Aylık | `siparis_tutar.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Alınan Sipariş Tutarı — Yıl Boyu Kümülatif | `siparis_tutar.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Alınan Sipariş Tutarı — Haftalık Isı Haritası | `siparis_tutar.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Alınan Sipariş Tutarı — Mevsimsellik | `siparis_tutar.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Alınan Sipariş Tutarı — Müşteri Sıralaması | `siparis_tutar.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alınan Sipariş Tutarı — Müşteri Payları | `siparis_tutar.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alınan Sipariş Tutarı — Müşteri Karşılaştırma | `siparis_tutar.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Alınan Sipariş Tutarı — Müşteri ABC (Pareto) | `siparis_tutar.pareto.cari` | Kırılım | Son 12 ay | pareto, tablo |
| Alınan Sipariş Tutarı — İl Sıralaması | `siparis_tutar.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alınan Sipariş Tutarı — İl Payları | `siparis_tutar.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alınan Sipariş Tutarı — İl Karşılaştırma | `siparis_tutar.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Alınan Sipariş Tutarı — Cari Grubu Sıralaması | `siparis_tutar.top.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alınan Sipariş Tutarı — Cari Grubu Payları | `siparis_tutar.pay.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alınan Sipariş Tutarı — Cari Grubu Karşılaştırma | `siparis_tutar.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Alınan Sipariş Tutarı — Temsilci Sıralaması | `siparis_tutar.top.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alınan Sipariş Tutarı — Temsilci Payları | `siparis_tutar.pay.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alınan Sipariş Tutarı — Temsilci Karşılaştırma | `siparis_tutar.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Alınan Sipariş Tutarı — Firma Sıralaması | `siparis_tutar.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alınan Sipariş Tutarı — Firma Payları | `siparis_tutar.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Alınan Sipariş Tutarı — Firma Karşılaştırma | `siparis_tutar.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Alınan Sipariş Tutarı — Haftanın Günü Dağılımı | `siparis_tutar.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Alınan Sipariş Tutarı — Ay Dağılımı | `siparis_tutar.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Sipariş Sayısı | `siparis_sayisi.kpi` | Gösterge | Bu ay | sayi |
| Sipariş Sayısı — Günlük Trend | `siparis_sayisi.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Sipariş Sayısı — Haftalık Trend | `siparis_sayisi.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Sipariş Sayısı — Aylık Trend | `siparis_sayisi.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Sipariş Sayısı — Çeyreklik Trend | `siparis_sayisi.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Sipariş Sayısı — Yıllık Trend | `siparis_sayisi.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Sipariş Sayısı — Geçen Yılla Günlük | `siparis_sayisi.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Sipariş Sayısı — Geçen Yılla Haftalık | `siparis_sayisi.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Sipariş Sayısı — Geçen Yılla Aylık | `siparis_sayisi.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Sipariş Sayısı — Yıl Boyu Kümülatif | `siparis_sayisi.kumulatif` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Sipariş Sayısı — Haftalık Isı Haritası | `siparis_sayisi.isi` | Isı haritası | Son 90 gün | isi, tablo |
| Sipariş Sayısı — Mevsimsellik | `siparis_sayisi.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Sipariş Sayısı — Müşteri Sıralaması | `siparis_sayisi.top.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Sipariş Sayısı — Müşteri Payları | `siparis_sayisi.pay.cari` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Sipariş Sayısı — Müşteri Karşılaştırma | `siparis_sayisi.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Sipariş Sayısı — Müşteri ABC (Pareto) | `siparis_sayisi.pareto.cari` | Kırılım | Son 12 ay | pareto, tablo |
| Sipariş Sayısı — İl Sıralaması | `siparis_sayisi.top.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Sipariş Sayısı — İl Payları | `siparis_sayisi.pay.il` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Sipariş Sayısı — İl Karşılaştırma | `siparis_sayisi.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Sipariş Sayısı — Cari Grubu Sıralaması | `siparis_sayisi.top.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Sipariş Sayısı — Cari Grubu Payları | `siparis_sayisi.pay.grup` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Sipariş Sayısı — Cari Grubu Karşılaştırma | `siparis_sayisi.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Sipariş Sayısı — Temsilci Sıralaması | `siparis_sayisi.top.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Sipariş Sayısı — Temsilci Payları | `siparis_sayisi.pay.temsilci` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Sipariş Sayısı — Temsilci Karşılaştırma | `siparis_sayisi.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Sipariş Sayısı — Firma Sıralaması | `siparis_sayisi.top.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Sipariş Sayısı — Firma Payları | `siparis_sayisi.pay.firma` | Kırılım | Bu yıl | cubuk, pasta, agac, tablo |
| Sipariş Sayısı — Firma Karşılaştırma | `siparis_sayisi.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Sipariş Sayısı — Haftanın Günü Dağılımı | `siparis_sayisi.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Sipariş Sayısı — Ay Dağılımı | `siparis_sayisi.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Ortalama Sipariş | `siparis_ort.kpi` | Gösterge | Bu ay | sayi |
| Ortalama Sipariş — Günlük Trend | `siparis_ort.trend.gun` | Zaman serisi | Son 30 gün | cizgi, alan, sutun, tablo |
| Ortalama Sipariş — Haftalık Trend | `siparis_ort.trend.hafta` | Zaman serisi | Son 90 gün | cizgi, alan, sutun, tablo |
| Ortalama Sipariş — Aylık Trend | `siparis_ort.trend.ay` | Zaman serisi | Son 12 ay | cizgi, alan, sutun, tablo |
| Ortalama Sipariş — Çeyreklik Trend | `siparis_ort.trend.ceyrek` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Ortalama Sipariş — Yıllık Trend | `siparis_ort.trend.yil` | Zaman serisi | Tüm zamanlar | cizgi, alan, sutun, tablo |
| Ortalama Sipariş — Geçen Yılla Günlük | `siparis_ort.yoy.gun` | Zaman serisi | Bu ay | cizgi, alan, sutun, tablo |
| Ortalama Sipariş — Geçen Yılla Haftalık | `siparis_ort.yoy.hafta` | Zaman serisi | Bu çeyrek | cizgi, alan, sutun, tablo |
| Ortalama Sipariş — Geçen Yılla Aylık | `siparis_ort.yoy.ay` | Zaman serisi | Bu yıl | cizgi, alan, sutun, tablo |
| Ortalama Sipariş — Mevsimsellik | `siparis_ort.mevsim` | Isı haritası | Tüm zamanlar | isi, tablo |
| Ortalama Sipariş — Müşteri Sıralaması | `siparis_ort.top.cari` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Sipariş — Müşteri Karşılaştırma | `siparis_ort.karsilastir.cari` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Sipariş — İl Sıralaması | `siparis_ort.top.il` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Sipariş — İl Karşılaştırma | `siparis_ort.karsilastir.il` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Sipariş — Cari Grubu Sıralaması | `siparis_ort.top.grup` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Sipariş — Cari Grubu Karşılaştırma | `siparis_ort.karsilastir.grup` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Sipariş — Temsilci Sıralaması | `siparis_ort.top.temsilci` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Sipariş — Temsilci Karşılaştırma | `siparis_ort.karsilastir.temsilci` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Sipariş — Firma Sıralaması | `siparis_ort.top.firma` | Kırılım | Bu yıl | cubuk, tablo |
| Ortalama Sipariş — Firma Karşılaştırma | `siparis_ort.karsilastir.firma` | Kırılım | Bu ay | karsilastir, tablo |
| Ortalama Sipariş — Haftanın Günü Dağılımı | `siparis_ort.dagilim.haftagunu` | Kırılım | Son 90 gün | sutun, cubuk, tablo |
| Ortalama Sipariş — Ay Dağılımı | `siparis_ort.dagilim.ayadi` | Kırılım | Son 90 gün | sutun, cubuk, tablo |

</details>

<details><summary><b>Veri Kontrolü</b> — 3 rapor</summary>

| Rapor | Kimlik | Sonuç | Varsayılan dönem | Grafikler |
|---|---|---|---|---|
| Cari İzahat Dağılımı | `ozel.izahat_dagilimi` | Tablo | Bu yıl | tablo |
| Havale Mutabakatı (Banka 83 ↔ Cari 83) | `ozel.havale_mutabakat` | Tablo | Son 12 ay | tablo |
| Veri Kapsamı | `ozel.veri_kapsami` | Tablo | Bu ay | tablo |

</details>
