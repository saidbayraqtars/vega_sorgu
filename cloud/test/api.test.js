// HTTP uçları: oturum, hız sınırı, CSRF, roller, kiracı yalıtımı, panolar,
// veri uçları ve köprü protokolünün HTTP (gzip, çok parça) üzerinden tamamı.

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const { tmpdir } = require("./helpers");
const { loadConfig } = require("../src/config");
const { Registry } = require("../src/db/registry");
const { TenantManager } = require("../src/tenants");
const { createApp } = require("../src/app");
const { loadDemo } = require("../src/demo/load");
const P = require("../src/engine/period");
const log = require("../src/log");
const { Cloud } = require("../../bridge/src/http");
const { chunkKey, scopeKey } = require("../../shared/datasets");

log.setLevel("error");

// Çerez saklayan küçük istemci
class Client {
  constructor(base) { this.base = base; this.cookie = null; }
  async req(method, url, body, headers = {}) {
    const h = { ...headers };
    if (this.cookie) h.Cookie = this.cookie;
    if (body !== undefined) h["Content-Type"] = "application/json";
    const res = await fetch(this.base + url, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie()) {
      const m = /^vb_oturum=([^;]*)/.exec(c);
      if (m) this.cookie = m[1] ? `vb_oturum=${m[1]}` : null;
    }
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, headers: res.headers };
  }
  get(u, h) { return this.req("GET", u, undefined, h); }
  post(u, b = {}, h) { return this.req("POST", u, b, h); }
  put(u, b = {}, h) { return this.req("PUT", u, b, h); }
  del(u, b, h) { return this.req("DELETE", u, b, h); }
  async login(kullanici, sifre) {
    const r = await this.post("/api/auth/giris", { kullanici, sifre });
    assert.equal(r.status, 200, `giriş ${kullanici}: ${JSON.stringify(r.data)}`);
    return r;
  }
}

const S = {}; // paylaşılan durum (testler sırayla çalışır)

test.before(async () => {
  const dir = tmpdir("vb-api-");
  const config = loadConfig({ DATA_DIR: dir, WEB_DIR: path.join(dir, "web"), TCMB_KURLARI: "0", KOPRU_MAX_MB: "2", VARSAYILAN_ENFLASYON: "30" });
  const registry = new Registry(path.join(dir, "registry.db"));
  const tenants = new TenantManager(dir);
  const deps = { registry, tenants, fx: null, config };
  const app = createApp(deps);
  const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  Object.assign(S, { dir, config, registry, tenants, deps, server, base: `http://127.0.0.1:${server.address().port}` });
  registry.createUser({ username: "kok", password: "kok12345", rol: "super", ad: "Kök" });
});

test.after(async () => {
  await new Promise((r) => S.server.close(r));
  S.tenants.closeAll();
  S.registry.close();
});

const client = () => new Client(S.base);

test("sağlık ucu, güvenlik başlıkları, arayüz yokken bilgi metni", async () => {
  const c = client();
  const r = await c.get("/api/saglik");
  assert.equal(r.status, 200);
  assert.equal(r.data.tamam, true);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("x-frame-options"), "DENY");
  assert.equal(r.headers.get("x-powered-by"), null);
  const k = await c.get("/");
  assert.equal(k.status, 200);
  assert.match(k.headers.get("content-security-policy"), /default-src 'self'/);
});

test("oturum yokken veri ve yönetim uçları 401", async () => {
  const c = client();
  for (const u of ["/api/meta", "/api/durum", "/api/raporlar", "/api/rapor/satis.kpi", "/api/panolar", "/api/ayarlar", "/api/yonetim/firmalar", "/api/auth/ben"]) {
    assert.equal((await c.get(u)).status, 401, u);
  }
  assert.equal((await c.post("/api/guncelle")).status, 401);
});

test("sistem yöneticisi firma açar (yönetici + köprü anahtarı, varsayılan enflasyon)", async () => {
  const c = client();
  await c.login("kok", "kok12345");
  const a = await c.post("/api/yonetim/firmalar", { kod: "alfa", ad: "Alfa Gıda Ltd", yoneticiKullanici: "alfa.yonetici", yoneticiSifre: "alfa123", yoneticiAd: "Ayşe" });
  assert.equal(a.status, 201, JSON.stringify(a.data));
  assert.match(a.data.kopruAnahtari, /^vk_alfa_[\w-]{20,}$/);
  const b = await c.post("/api/yonetim/firmalar", { kod: "beta", ad: "Beta Yapı AŞ", yoneticiKullanici: "beta.yonetici", yoneticiSifre: "beta123" });
  assert.equal(b.status, 201);
  // Hatalı istekler
  assert.equal((await c.post("/api/yonetim/firmalar", { kod: "alfa", ad: "Tekrar" })).status, 409);
  assert.equal((await c.post("/api/yonetim/firmalar", { kod: "Büyük Harf", ad: "X" })).status, 400);
  // Kullanıcı adı çakışırsa firma da geri alınır
  assert.equal((await c.post("/api/yonetim/firmalar", { kod: "gama", ad: "Gama", yoneticiKullanici: "alfa.yonetici", yoneticiSifre: "xxxxxx" })).status, 409);
  assert.equal(S.registry.tenantBySlug("gama"), null);

  S.alfa = S.registry.tenantBySlug("alfa");
  S.beta = S.registry.tenantBySlug("beta");
  S.betaKey = b.data.kopruAnahtari;
  assert.equal(S.alfa.settings.enflasyon, 30);
  // Alfa'ya küçük ölçekli demo verisi (hızlı)
  const store = S.tenants.get(S.alfa);
  loadDemo(store, { today: P.todayTR(), olcek: 0.2, seed: 99 });
  store.setMeta("demo", true);
});

test("giriş: hatalı şifre 401, 10 hatadan sonra 429, doğru giriş güvenli çerez", async () => {
  S.registry.createUser({ username: "kilit.deneme", password: "dogru123", rol: "user", tenantId: S.alfa.id });
  const c = client();
  assert.equal((await c.post("/api/auth/giris", { kullanici: "kilit.deneme" })).status, 400);
  for (let i = 0; i < 10; i++) assert.equal((await c.post("/api/auth/giris", { kullanici: "kilit.deneme", sifre: "yanlis" })).status, 401);
  const r = await c.post("/api/auth/giris", { kullanici: "kilit.deneme", sifre: "dogru123" });
  assert.equal(r.status, 429);
  assert.equal(c.cookie, null);
  // Başka kullanıcı etkilenmez; çerez HttpOnly + SameSite
  const ok = await c.post("/api/auth/giris", { kullanici: "alfa.yonetici", sifre: "alfa123" });
  assert.equal(ok.status, 200);
  const sc = ok.headers.getSetCookie().join(";");
  assert.match(sc, /HttpOnly/);
  assert.match(sc, /SameSite=Lax/);
  assert.equal(ok.data.kullanici.rol, "admin");
  assert.equal(ok.data.kullanici.firma.kod, "alfa");
  assert.equal((await c.get("/api/auth/ben")).data.kullanici.kullanici, "alfa.yonetici");
  // Var olmayan kullanıcı da aynı yanıtı alır
  const yok = await client().post("/api/auth/giris", { kullanici: "hic.yok", sifre: "abcdef" });
  assert.equal(yok.status, 401);
  assert.equal(yok.data.hata, "Kullanıcı adı veya şifre hatalı.");
});

test("CSRF: yabancı kökenden durum değiştiren istek reddedilir", async () => {
  const c = client();
  await c.login("alfa.yonetici", "alfa123");
  const kotu = await c.post("/api/guncelle", {}, { Origin: "https://kotu.example" });
  assert.equal(kotu.status, 403);
  assert.equal((await c.post("/api/guncelle", {}, { Origin: S.base })).status, 200);
  // GET istekleri köken denetimine takılmaz
  assert.equal((await c.get("/api/surum", { Origin: "https://kotu.example" })).status, 200);
});

test("roller: kullanıcı veriyi görür ama yönetim uçlarına giremez", async () => {
  const adm = client();
  await adm.login("alfa.yonetici", "alfa123");
  const yeni = await adm.post("/api/kullanicilar", { kullanici: "alfa.izleyici", sifre: "izle123", ad: "Mehmet" });
  assert.equal(yeni.status, 201, JSON.stringify(yeni.data));
  assert.equal(yeni.data.kullanici.rol, "user");
  S.izleyiciId = yeni.data.kullanici.id;

  const u = client();
  await u.login("alfa.izleyici", "izle123");
  for (const url of ["/api/meta", "/api/surum", "/api/raporlar", "/api/durum", "/api/uyarilar", "/api/panolar", "/api/sektorler"]) {
    const r = await u.get(url);
    assert.equal(r.status, 200, `${url}: ${JSON.stringify(r.data).slice(0, 200)}`);
  }
  assert.equal((await u.post("/api/guncelle")).status, 200);
  for (const url of ["/api/ayarlar", "/api/kullanicilar", "/api/kopru"]) assert.equal((await u.get(url)).status, 403, url);
  assert.equal((await u.put("/api/ayarlar", { enflasyon: 10 })).status, 403);
  assert.equal((await u.post("/api/kopru/anahtar", {})).status, 403);
  assert.equal((await u.get("/api/yonetim/firmalar")).status, 403);
  // Bilinmeyen uç
  assert.equal((await u.get("/api/boyle-bir-uc-yok")).status, 404);
});

test("firma yöneticisi: ayarlar, kullanıcılar, köprü anahtarları; başka firmaya dokunamaz", async () => {
  const c = client();
  await c.login("alfa.yonetici", "alfa123");
  const a = await c.put("/api/ayarlar", { enflasyon: 32.5, sektor: "toptan" });
  assert.equal(a.status, 200, JSON.stringify(a.data));
  assert.equal(a.data.ayarlar.enflasyon, 32.5);
  assert.equal((await c.put("/api/ayarlar", { enflasyon: 900 })).status, 400);
  assert.equal((await c.get("/api/meta")).data.ayarlar.enflasyon, 32.5);

  const ben = (await c.get("/api/auth/ben")).data.kullanici;
  assert.equal((await c.del(`/api/kullanicilar/${ben.id}`)).status, 400);
  assert.equal((await c.put(`/api/kullanicilar/${ben.id}`, { rol: "user" })).status, 400);
  const betaAdmin = S.registry.userByName("beta.yonetici");
  assert.equal((await c.put(`/api/kullanicilar/${betaAdmin.id}`, { sifre: "ele-gecir" })).status, 404);
  assert.equal((await c.del(`/api/kullanicilar/${betaAdmin.id}`)).status, 404);
  assert.equal((await c.post("/api/kullanicilar", { kullanici: "x", sifre: "123456" })).status, 400);

  const k = await c.post("/api/kopru/anahtar", { etiket: "yedek sunucu" });
  assert.equal(k.status, 201);
  assert.match(k.data.anahtar, /^vk_alfa_/);
  const kp = await c.get("/api/kopru");
  assert.equal(kp.status, 200);
  assert.equal(kp.data.anahtarlar.length, 2);
  assert.equal(kp.data.durum.durum, "demo");
  assert.ok(kp.data.anahtarlar.every((x) => !("token_hash" in x)));
});

test("veri uçları: meta, durum, katalog, rapor, cari detayı, uyarılar", async () => {
  const c = client();
  await c.login("alfa.izleyici", "izle123");
  const meta = (await c.get("/api/meta")).data;
  assert.equal(meta.firma.kod, "alfa");
  assert.ok(meta.firmalar.length >= 1);
  assert.ok(meta.raporSayisi >= 500);
  assert.equal(meta.rol, "user");

  const d = await c.get("/api/durum");
  assert.equal(d.status, 200);
  assert.ok(Number.isFinite(d.data.saglik.skor), "sağlık skoru");
  assert.ok(d.data.buyume && "yuzde" in d.data.buyume && Array.isArray(d.data.buyume.bilesenler), "büyüme");
  assert.ok(Array.isArray(d.data.uyarilar));

  const kat = (await c.get("/api/raporlar")).data;
  assert.equal(kat.raporlar.length, meta.raporSayisi);
  assert.ok(kat.raporlar.every((r) => r.id && r.ikon && r.parametreler));

  const top = await c.get("/api/rapor/satis.top.cari?donem=son12&n=5");
  assert.equal(top.status, 200, JSON.stringify(top.data));
  assert.equal(top.data.sonuc.tur, "kategori");
  assert.equal(top.data.sonuc.satirlar.length, 5);
  const anahtar = top.data.sonuc.satirlar[0].k;
  assert.match(anahtar, /^\d{4}:\d+$/);
  const cari = await c.get(`/api/cari/${anahtar}`);
  assert.equal(cari.status, 200);
  assert.ok(cari.data.kart && cari.data.hareketler.length > 0);
  assert.equal((await c.get("/api/cari/abc")).status, 400);
  assert.equal((await c.get("/api/cari/0101:999999")).status, 404);

  assert.equal((await c.get("/api/rapor/yok.rapor")).status, 404);
  assert.equal((await c.get("/api/rapor/satis.kpi?donem=bilinmeyen")).status, 400);
  assert.equal((await c.get("/api/rapor/satis.trend.ay?kirilim=dakika")).status, 400);
  const oz = await c.get("/api/rapor/net_ciro.trend.ay?donem=ozel&bas=2026-01-01&bit=2026-03-31");
  assert.equal(oz.status, 200);
  assert.equal(oz.data.sonuc.seriler[0].veri.length, 3);

  const u = await c.get("/api/uyarilar");
  assert.equal(u.status, 200);
  assert.equal(u.data.uyarilar.length, u.data.ozet.kritik + u.data.ozet.uyari + u.data.ozet.bilgi);

  // firma=hepsi ve belirli firma filtresi
  assert.equal((await c.get("/api/rapor/net_ciro.kpi?firma=hepsi")).status, 200);
  assert.equal((await c.get(`/api/rapor/net_ciro.kpi?firma=${meta.firmalar[0].kod}`)).status, 200);
});

test("panolar: varsayılanlar, ekle/düzenle/sil, doğrulama, kullanıcıya özel", async () => {
  const c = client();
  await c.login("alfa.yonetici", "alfa123");
  const ilk = await c.get("/api/panolar");
  assert.equal(ilk.status, 200);
  assert.equal(ilk.data.panolar.length, 3);
  assert.equal((await c.get("/api/panolar")).data.panolar.length, 3); // ikinci çağrıda çoğalmaz

  const yeni = await c.post("/api/panolar", { ad: "Benim", ikon: "Star", widgets: [{ rapor: "net_ciro.kpi", boyut: "s" }, { rapor: "satis.top.cari", grafik: "pasta", n: 7, donem: "son12" }] });
  assert.equal(yeni.status, 201, JSON.stringify(yeni.data));
  const id = yeni.data.id;
  const pano = yeni.data.panolar.find((p) => p.id === id);
  assert.equal(pano.widgets.length, 2);
  assert.equal(pano.widgets[1].grafik, "pasta");
  assert.ok(pano.widgets.every((w) => typeof w.id === "string" && w.id.length >= 6));

  assert.equal((await c.post("/api/panolar", { ad: "Kötü", widgets: [{ rapor: "yok.rapor" }] })).status, 400);
  assert.equal((await c.post("/api/panolar", { ad: "Kötü", widgets: [{ rapor: "net_ciro.kpi", grafik: "pasta" }] })).status, 400);
  assert.equal((await c.post("/api/panolar", { ad: "Kötü", widgets: [{ rapor: "net_ciro.kpi", donem: "ozel" }] })).status, 400);

  const put = await c.put(`/api/panolar/${id}`, { ad: "Benim panom", widgets: [{ rapor: "ozel.saglik", boyut: "l" }] });
  assert.equal(put.status, 200);
  const p2 = put.data.panolar.find((p) => p.id === id);
  assert.equal(p2.ad, "Benim panom");
  assert.deepEqual(p2.widgets.map((w) => w.rapor), ["ozel.saglik"]);

  // Başka kullanıcı bu panoyu göremez / değiştiremez
  const u = client();
  await u.login("alfa.izleyici", "izle123");
  assert.ok((await u.get("/api/panolar")).data.panolar.every((p) => p.id !== id));
  assert.equal((await u.put(`/api/panolar/${id}`, { ad: "ele geçirildi" })).status, 404);
  await u.del(`/api/panolar/${id}`);
  assert.ok((await c.get("/api/panolar")).data.panolar.some((p) => p.id === id && p.ad === "Benim panom"));

  assert.equal((await c.del(`/api/panolar/${id}`)).data.panolar.length, 3);
  const s = await c.post("/api/panolar/sifirla");
  assert.equal(s.data.panolar.length, 3);
  assert.deepEqual(s.data.panolar.map((p) => p.ad), ["Genel", "Satış", "Nakit"]);
});

test("şifre değişince eski oturumlar düşer; çıkış çerezi siler", async () => {
  const a = client();
  const b = client();
  await a.login("alfa.izleyici", "izle123");
  await b.login("alfa.izleyici", "izle123");
  assert.equal((await a.post("/api/auth/sifre", { eski: "yanlis", yeni: "yeni1234" })).status, 400);
  assert.equal((await a.post("/api/auth/sifre", { eski: "izle123", yeni: "yeni1234" })).status, 200);
  assert.equal((await a.get("/api/auth/ben")).status, 200); // yeni çerez verildi
  assert.equal((await b.get("/api/auth/ben")).status, 401); // eski oturum düştü
  assert.equal((await a.post("/api/auth/cikis")).status, 200);
  assert.equal(a.cookie, null);
  assert.equal((await a.get("/api/auth/ben")).status, 401);
  await a.login("alfa.izleyici", "yeni1234");
  const t = await a.put("/api/auth/tercihler", { tema: "koyu", firmalar: ["0101", "kotu"], zararli: "<script>" });
  assert.deepEqual(t.data.tercihler, { tema: "koyu", firmalar: ["0101"] });
});

test("sistem yöneticisi: firma seçmeden veri yok; görünüm geçişi", async () => {
  const c = client();
  await c.login("kok", "kok12345");
  assert.equal((await c.get("/api/meta")).status, 409);
  const f = await c.get("/api/yonetim/firmalar");
  assert.equal(f.status, 200);
  assert.deepEqual(f.data.firmalar.map((x) => x.kod).sort(), ["alfa", "beta"]);
  assert.equal(f.data.firmalar.find((x) => x.kod === "alfa").demo, true);
  assert.equal((await c.post("/api/yonetim/gorunum", { firmaId: 9999 })).status, 404);
  assert.equal((await c.post("/api/yonetim/gorunum", { firmaId: S.alfa.id })).status, 200);
  const m = await c.get("/api/meta");
  assert.equal(m.status, 200);
  assert.equal(m.data.firma.kod, "alfa");
  assert.equal((await c.get("/api/ayarlar")).status, 200); // süper, görüntülediği firmada yönetici yetkisine sahip
  assert.equal((await c.post("/api/yonetim/gorunum", { firmaId: null })).status, 200);
  assert.equal((await c.get("/api/meta")).status, 409);
});

test("köprü protokolü HTTP üzerinden: kimlik, ping isteği, gzip + çok parçalı gönderim, sürüm", async () => {
  const today = P.todayTR();
  const yil = Number(today.slice(0, 4));
  const ay = today.slice(0, 7);

  // Geçersiz anahtar
  await assert.rejects(new Cloud({ url: S.base, anahtar: "vk_beta_yanlis" }).hello({}), (e) => e.status === 401);
  await assert.rejects(fetch(`${S.base}/api/kopru/v1/ping`).then((r) => { if (r.status !== 401) throw new Error(String(r.status)); throw Object.assign(new Error("401"), { status: 401 }); }), (e) => e.status === 401);

  const cloud = new Cloud({ url: S.base, anahtar: S.betaKey }, { agent: { surum: "test" } });
  const h = await cloud.hello({ surum: "2.0.0", makine: "SUNUCU-01", sql: { surum: "Microsoft SQL Server 2019", veritabani: "VEGADB" } });
  assert.equal(h.firma.kod, "beta");
  assert.ok(h.protokol >= 1);
  assert.equal(h.aralikDk, 15);

  // Veri yokken arayüz uçları çalışır (yeni müşteri, ilk eşitleme öncesi)
  const u = client();
  await u.login("beta.yonetici", "beta123");
  for (const url of ["/api/meta", "/api/durum", "/api/uyarilar", "/api/rapor/net_ciro.kpi", "/api/rapor/ozel.saglik", "/api/rapor/ozel.nakit_projeksiyonu"]) {
    const r = await u.get(url);
    assert.equal(r.status, 200, `${url}: ${JSON.stringify(r.data).slice(0, 300)}`);
  }
  assert.equal((await u.get("/api/surum")).data.kopru.durum, "bekleniyor");

  // "Şimdi güncelle" → bir sonraki ping'de bir kez döner
  assert.equal((await cloud.ping()).simdiEsitle, false);
  await u.post("/api/guncelle");
  assert.equal((await u.get("/api/surum")).data.bekleyenIstek, true);
  assert.equal((await cloud.ping()).simdiEsitle, true);
  assert.equal((await cloud.ping()).simdiEsitle, false);

  // Manifest
  const syncId = `test-${Date.now()}`;
  const kFirma = chunkKey("firma");
  const kDonem = chunkKey("donem");
  const kCari = chunkKey("cari", "0101", "", "b0");
  const kHar = chunkKey("cari_hareket", "0101", "0017", ay);
  const cariRows = Array.from({ length: 60 }, (_, i) => [i + 1, `120.${String(i + 1).padStart(3, "0")}`, `MÜŞTERİ ${i + 1} TİCARET LTD`, 1, 1, "SAMSUN", "ATAKUM", "", "", 30, 0, 0, ""]);
  const harRows = Array.from({ length: 120 }, (_, i) => [i + 1, today, (i % 60) + 1, 21, 1000 + i, 0, 1, "TL", today, "", 0, `F${i + 1}`, 900]);
  const toplam = harRows.reduce((s, r) => s + r[4], 0);
  const man = [
    { key: kFirma, n: 1, ck: "1", sm: 0 }, { key: kDonem, n: 1, ck: "1", sm: 0 },
    { key: kCari, n: 60, ck: "c1", sm: 0 }, { key: kHar, n: 120, ck: "h1", sm: toplam },
  ];
  const scopes = [scopeKey("firma"), scopeKey("donem"), scopeKey("cari", "0101"), scopeKey("cari_hareket", "0101", "0017")];
  const r1 = await cloud.manifest({ syncId, chunks: man, scopes });
  assert.deepEqual(r1.need.sort(), man.map((m) => m.key).sort());
  assert.deepEqual(r1.drop, []);
  assert.equal((await u.get("/api/surum")).data.esitleniyor, true);

  const send = (key, rows, extra = {}) => cloud.chunk({ syncId, key, ...man.find((m) => m.key === key), cols: colsOf(key), rows, ...extra });
  await send(kFirma, [["0101", "BETA MERKEZ", "BETA YAPI MALZEMELERİ AŞ"]]);
  await send(kDonem, [["0101", "0017", yil]]);
  const cr = await send(kCari, cariRows);
  assert.ok(cr.bytes < JSON.stringify(cariRows).length, "gzip ile sıkıştırılmış olmalı");
  // Çok parçalı: ilk parça staging'de bekler
  await send(kHar, harRows.slice(0, 70), { seq: 0, last: false });
  assert.equal(S.tenants.get(S.beta).db.value("SELECT COUNT(*) FROM cari_hareket"), 0);
  await send(kHar, harRows.slice(70), { seq: 1, last: true });
  const c1 = await cloud.commit({ syncId, istatistik: { sure: 1 } });
  assert.equal(c1.veriSurumu, 1);
  assert.equal(c1.degisti, true);

  const sv = (await u.get("/api/surum")).data;
  assert.equal(sv.veriSurumu, 1);
  assert.equal(sv.esitleniyor, false);
  assert.equal(sv.kopru.durum, "guncel");
  const k = await u.get("/api/rapor/satis.kpi?donem=bu_ay");
  assert.ok(Math.abs(k.data.sonuc.deger - toplam) < 0.01, `satış ${k.data.sonuc.deger} ≠ ${toplam}`);
  const top = await u.get("/api/rapor/satis.top.cari?donem=bu_ay&n=3");
  assert.match(top.data.sonuc.satirlar[0].ad, /^MÜŞTERİ \d+ TİCARET LTD$/);

  // Değişmeyen veri: hiçbir parça istenmez, sürüm artmaz
  const sync2 = `test-${Date.now()}-2`;
  const r2 = await cloud.manifest({ syncId: sync2, chunks: man, scopes });
  assert.deepEqual(r2.need, []);
  const c2 = await cloud.commit({ syncId: sync2 });
  assert.equal(c2.veriSurumu, 1);
  assert.equal(c2.degisti, false);

  // Kaynakta silinen ay → drop, sürüm artar
  const sync3 = `test-${Date.now()}-3`;
  const r3 = await cloud.manifest({ syncId: sync3, chunks: man.filter((m) => m.key !== kHar), scopes });
  assert.deepEqual(r3.drop, [kHar]);
  const c3 = await cloud.commit({ syncId: sync3 });
  assert.equal(c3.silinen, 1);
  assert.equal(c3.veriSurumu, 2);
  assert.equal(S.tenants.get(S.beta).db.value("SELECT COUNT(*) FROM cari_hareket"), 0);

  // tam=true → her şey yeniden istenir
  const r4 = await cloud.manifest({ syncId: `test-${Date.now()}-4`, chunks: man, scopes, tam: true });
  assert.equal(r4.need.length, man.length);

  // Doğrulama hataları
  await assert.rejects(cloud.manifest({ syncId: "x", chunks: [] }), (e) => e.status === 400);
  await assert.rejects(cloud.manifest({ syncId: "gecerli-123", chunks: [{ key: "yok|||" }] }), (e) => e.status === 400);
  await assert.rejects(cloud.chunk({ syncId: "gecerli-123", key: kCari, cols: ["id"], rows: [] }), (e) => e.status === 400);
  await assert.rejects(cloud.chunk({ syncId: "gecerli-123", key: kCari, cols: colsOf(kCari), rows: [[1, 2]] }), (e) => e.status === 400);

  // Hata olayı eşitleme günlüğüne düşer
  await cloud.event("hata", "SQL Server'a bağlanılamadı", `test-${Date.now()}-5`);
  const adm = await u.get("/api/kopru");
  assert.equal(adm.data.olaylar[0].level, "hata");
  assert.ok(adm.data.esitlemeler.some((e) => e.status === "tamam"));
  assert.equal(adm.data.anahtarlar[0].agent.makine, "SUNUCU-01");

  // Kiracı yalıtımı: beta'nın verisi alfa'ya karışmaz
  assert.equal(S.tenants.get(S.alfa).db.value("SELECT COUNT(*) FROM firma WHERE ad = 'BETA MERKEZ'"), 0);
});

test("köprü gövde sınırı: büyük istek 413", async () => {
  const big = JSON.stringify({ syncId: "buyuk-123456", key: chunkKey("cari", "0101", "", "b0"), rows: [], pad: "x".repeat(3 * 1024 * 1024) });
  const r = await fetch(`${S.base}/api/kopru/v1/chunk`, { method: "POST", headers: { Authorization: `Bearer ${S.betaKey}`, "Content-Type": "application/json" }, body: big });
  assert.equal(r.status, 413);
  assert.ok((await r.json()).hata);
});

test("anahtar iptali ve pasif firma: köprü ve kullanıcılar durdurulur; firma silme onayı", async () => {
  const adm = client();
  await adm.login("beta.yonetici", "beta123");
  const extra = await adm.post("/api/kopru/anahtar", { etiket: "geçici" });
  const cloud = new Cloud({ url: S.base, anahtar: extra.data.anahtar });
  await cloud.hello({});
  const id = (await adm.get("/api/kopru")).data.anahtarlar.find((a) => a.etiket === "geçici").id;
  assert.equal((await adm.del(`/api/kopru/anahtar/${id}`)).status, 200);
  await assert.rejects(cloud.hello({}), (e) => e.status === 401);

  const kok = client();
  await kok.login("kok", "kok12345");
  assert.equal((await kok.put(`/api/yonetim/firmalar/${S.beta.id}`, { aktif: false })).status, 200);
  await assert.rejects(new Cloud({ url: S.base, anahtar: S.betaKey }).hello({}), (e) => e.status === 401);
  assert.equal((await adm.get("/api/meta")).status, 403); // açık oturum da durur
  assert.equal((await client().post("/api/auth/giris", { kullanici: "beta.yonetici", sifre: "beta123" })).status, 401);
  assert.equal((await kok.put(`/api/yonetim/firmalar/${S.beta.id}`, { aktif: true })).status, 200);
  assert.equal((await adm.get("/api/meta")).status, 200);

  const file = S.tenants.file(S.beta);
  assert.ok(fs.existsSync(file));
  assert.equal((await kok.del(`/api/yonetim/firmalar/${S.beta.id}`, { onay: "yanlis" })).status, 400);
  assert.equal((await kok.del(`/api/yonetim/firmalar/${S.beta.id}`, { onay: "beta" })).status, 200);
  assert.equal(fs.existsSync(file), false);
  assert.equal(S.registry.userByName("beta.yonetici"), null);
  assert.equal((await adm.get("/api/meta")).status, 401);
});

function colsOf(key) {
  const { DATASETS, parseChunkKey } = require("../../shared/datasets");
  return DATASETS[parseChunkKey(key).ds].cols.map((c) => c[0]);
}
