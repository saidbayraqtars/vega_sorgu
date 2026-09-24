# Sunucu (API) istekleri

Arayüz yazılırken `cloud/` tarafında görülen eksik/tutarsızlıklar. Arayüz şimdilik aşağıdaki geçici çözümlerle çalışıyor.

## 0. KRİTİK — İzleyici (`rol: user`) hiçbir veri ucuna erişemiyor (403)
`izleyici / izleyici123` ile giriş yapınca `/api/meta`, `/api/durum`, `/api/surum`, `/api/raporlar`, `/api/rapor/*` → **403 "Bu işlem için yönetici yetkisi gerekli."**
(`/api/panolar` çalışıyor.) Arayüz bu yüzden izleyiciye yalnız hata kutusu gösterebiliyor.

Neden: `cloud/src/app.js` yönetici router'ını veri router'ından **önce** `/api`'ye bağlıyor:
```js
app.use("/api", require("./routes/admin")(deps));   // içinde: r.use(requireTenant, requireAdmin)
app.use("/api", require("./routes/data")(deps));
```
`routes/admin.js`'deki router düzeyi `r.use(requireAdmin)` eşleşen bir yol olmasa da **her** `/api/*` isteğinde çalışıyor ve izleyiciyi reddediyor.
**İstek:** `requireAdmin`'i yalnız yönetici uçlarına uygulayın (ör. `r.use(["/ayarlar", "/kullanicilar", "/kopru"], requireTenant, requireAdmin)`)
veya veri router'ını yönetici router'ından önce bağlayın. Bir test ekleyin: izleyici `GET /api/durum` → 200.

## 1. Sağlık ölçütlerinde `birim: "puan"` tutarsız
`saglik.sutunlar[].olcutler[]` içinde:
- `marj_trend` → `deger: 0.40`, açıklama "+0,4 puan" (değer zaten puan)
- `ivme` → `deger: -0.093`, açıklama "-9,3 puan" (değer kesir)

Aynı birim iki farklı ölçekte. **İstek:** `puan` birimli tüm ölçütler puan (yüzde puanı) cinsinden gönderilsin.
Geçici çözüm: `src/lib/bicim.ts › olcutDegeri` yalnız `ivme` için ×100 uyguluyor.

Ayrıca `birim: "%"` olan ölçütler (ör. `brut_marj: 0.2996`) **kesir** geliyor; API.md'deki "birim `%` ise değer zaten yüzdedir" kuralıyla çelişiyor.
Arayüz ölçütlerde `%`'yi kesir kabul ediyor. **İstek:** API.md'de ölçütler için bu istisna belirtilsin ya da değerler yüzde gönderilsin.

## 2. `PUT /api/auth/tercihler` — `firmalar: ["hepsi"]` saklanamıyor
Doğrulama yalnız 4 haneli kodları kabul ediyor (`/^\d{4}$/`), bu yüzden "Tümü (kapananlar dahil)" seçimi sunucuda saklanamıyor.
Geçici çözüm: bu seçim tarayıcıda (`localStorage`) tutuluyor. **İstek:** `"hepsi"` değeri de kabul edilsin.

## 3. `PUT /api/auth/tercihler` — özel dönem saklanamıyor
`donem` en fazla 19 karakter; `ozel` seçildiğinde `bas/bit` saklanacak alan yok. Geçici çözüm: `bas/bit` tarayıcıda.
**İstek:** tercihlere `donemBas`, `donemBit` alanları eklensin.

## 4. `ozel.*` raporlarında `rapor.iyi` yok
`GET /api/rapor/ozel.*` yanıtında `rapor.iyi` alanı gelmiyor (diğer raporlarda var). Arayüz `yukari` varsayıyor.
**İstek:** tüm raporlarda `iyi` gönderilsin (ör. `ozel.vade_takvimi`, `ozel.kasa_bakiye_seyri` için anlamlı yön).

## 5. Dönemsiz `ozel` raporlarında `donem` alanı yanıltıcı
`parametreler.donem: false` olan raporlarda da yanıt `donem: { kod: "bu_ay", ... }` içeriyor. Arayüz bu durumda dönemi göstermiyor.
**İstek:** dönem kullanılmıyorsa `donem: null` dönsün.

## 6. Pareto / sıralama raporlarında varsayılan `n`
`n` gönderilmediğinde sonuç satır sayısı rapor türüne göre değişiyor (pareto 30, sıralama 10) ama katalogda varsayılan `n` yok.
**İstek:** `RaporTanimi.parametreler.nVarsayilan` eklensin; arayüz seçiciyi buna göre işaretlesin.

## 7. Uyarı sayısı için hafif uç
Sol ray/alt çubukta uyarı rozeti göstermek için `/api/surum` yanıtına `uyariOzet: { kritik, uyari, bilgi }` eklenmesi faydalı olur
(şu an yalnız `/api/durum` ile geliyor, her sayfada çağırmak pahalı).

## 8. Katalogda olmayan lucide ikonları
Sunucu sağlık ölçütlerinde prompt'taki listede olmayan `FlaskConical`, `Activity`, `Anchor` ikonlarını gönderiyor.
Arayüz eşlemeye ekledi; yeni ikon eklenirse `web/src/lib/ikonlar.ts` güncellenmeli (bilinmeyenler `Circle` olarak görünür).
