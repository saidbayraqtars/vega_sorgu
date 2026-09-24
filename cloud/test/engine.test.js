// Motor doğruluğu: bakiyeler Arctos formülleriyle bağımsız SQL hesabına eşit mi,
// dönem devri çift sayılıyor mu, büyüme/sağlık/projeksiyon tutarlı mı.

const test = require("node:test");
const assert = require("node:assert/strict");
const { demoStore, ctx, TODAY, findNonFinite } = require("./helpers");
const B = require("../src/engine/balances");
const Q = require("../src/engine/query");
const P = require("../src/engine/period");
const { position } = require("../src/engine/position");
const { growthAnalysis, composite, realGrowth } = require("../src/engine/growth");
const { healthScore } = require("../src/engine/health");
const { projection } = require("../src/engine/cashflow");
const { alerts } = require("../src/engine/alerts");
const { overview } = require("../src/engine/overview");

const close = (a, b, eps = 0.01) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b)) / 100;

test("aktif dönem: bugünü kapsayan dönem (önceden açılmış 2027 değil)", () => {
  const c = ctx(demoStore());
  assert.equal(c.activeDonem("0101"), "0017"); // 2026
  assert.equal(c.activeDonem("0103"), "0015"); // 2026 (firmaya göre farklı numara)
  assert.equal(c.activeDonem("0106"), "0009"); // yalnız 2022 dönemi olan eski firma
});

test("kasa bakiyesi = Arctos 'Toplam Kasa Bakiyesi' formülü (ISLEMTIPI=1, KREDIKASA hariç, /KUR)", () => {
  const store = demoStore();
  const c = ctx(store, { enflasyon: 25 }, { firmalar: ["0101"] });
  const k = B.currentKasa(c);
  const direct = store.db.get(`SELECT SUM((gelir - gider) / IFNULL(NULLIF(kur,0),1)) AS v FROM kasa_hareket
    WHERE firma = '0101' AND donem = '0017' AND islemtipi = 1 AND kredikasa = 0 AND dv IS NULL`).v;
  assert.ok(Math.abs(k.tl - direct) < 0.01, `${k.tl} vs ${direct}`);
  // ISLEMTIPI 2/3 ve KREDIKASA satırları gerçekten var ve toplamı değiştiriyor (kural sınanıyor)
  const unfiltered = store.db.get("SELECT SUM(gelir - gider) AS v FROM kasa_hareket WHERE firma = '0101' AND donem = '0017' AND dv IS NULL").v;
  assert.ok(Math.abs(unfiltered - direct) > 1000, "filtre etkisiz görünüyor — test verisi kuralı sınamıyor");
  assert.ok(store.db.value("SELECT COUNT(*) FROM kasa_hareket WHERE kredikasa = 1") > 0);
  // Döviz kasası TL'ye karışmaz
  assert.ok(k.doviz.EUR > 0);
});

test("banka: müşteri bankası (MUSBANKA=1), pasif hesap ve döviz hesabı TL toplamına girmez", () => {
  const store = demoStore();
  const c = ctx(store, { enflasyon: 25 }, { firmalar: ["0101"] });
  const b = B.currentBanka(c);
  const names = b.hesaplar.map((h) => h.ad);
  assert.ok(!names.some((n) => /MÜŞTERİ BANKASI|ESKİ VADESİZ/.test(n)));
  const direct = store.db.get(`SELECT SUM((h.borc - h.alacak) / IFNULL(NULLIF(h.kur,0),1)) AS v FROM banka_hareket h JOIN banka b ON b.firma = h.firma AND b.id = h.banka_id
    WHERE h.firma = '0101' AND h.donem = '0017' AND b.musbanka = 0 AND IFNULL(b.status,1) <> 2 AND b.dv IS NULL`).v;
  assert.ok(Math.abs(b.tl - direct) < 0.01);
  assert.ok(b.doviz.EUR > 0);
  assert.ok(Math.abs(b.tl - (b.varlik + b.kredi)) < 0.01);
});

test("cari: alacak/borç = müşteri bazında SUM(BORC-ALACAK), KREDIHESABI ve personel hariç", () => {
  const store = demoStore();
  const c = ctx(store, { enflasyon: 25 }, { firmalar: ["0101"] });
  const cur = B.currentCari(c);
  const rows = store.db.all(`SELECT h.cari_id, SUM(h.borc - h.alacak) AS b FROM cari_hareket h LEFT JOIN cari k ON k.firma = h.firma AND k.id = h.cari_id
    WHERE h.firma = '0101' AND h.donem = '0017' AND IFNULL(h.ozelkod,'') <> 'KREDIHESABI'
      AND NOT (IFNULL(k.ozelkod5,'') = 'PERSONELCARI' OR IFNULL(k.tip,-1) IN (11,12)) GROUP BY h.cari_id`);
  const alacak = rows.filter((r) => r.b > 0.009).reduce((s, r) => s + r.b, 0);
  const borc = -rows.filter((r) => r.b < -0.009).reduce((s, r) => s + r.b, 0);
  assert.ok(Math.abs(cur.alacak - alacak) < 0.01);
  assert.ok(Math.abs(cur.borc - borc) < 0.01);
  // KREDIHESABI satırları var ama bakiyeye girmiyor
  assert.ok(store.db.value("SELECT COUNT(*) FROM cari_hareket WHERE ozelkod = 'KREDIHESABI'") > 0);
});

test("dönem devri çift sayılmaz: yıl sonu → yeni yıl bakiye sürekliliği", () => {
  const store = demoStore();
  const c = ctx(store, { enflasyon: 25 }, { firmalar: ["0101"] });
  // Bir günün devir hariç gerçek hareketi (Arctos formülleriyle, doğrudan SQL)
  const flow = (kind, t) => kind === "kasa"
    ? store.db.value(`SELECT IFNULL(SUM((gelir-gider)/IFNULL(NULLIF(kur,0),1)),0) FROM kasa_hareket WHERE firma='0101' AND tarih=? AND islemtipi=1 AND kredikasa=0 AND dv IS NULL AND devir=0`, t)
    : kind === "banka"
      ? store.db.value(`SELECT IFNULL(SUM((h.borc-h.alacak)/IFNULL(NULLIF(h.kur,0),1)),0) FROM banka_hareket h JOIN banka b ON b.firma=h.firma AND b.id=h.banka_id
          WHERE h.firma='0101' AND h.tarih=? AND b.musbanka=0 AND IFNULL(b.status,1)<>2 AND b.dv IS NULL AND h.devir=0`, t)
      : store.db.value(`SELECT IFNULL(SUM(h.borc-h.alacak),0) FROM cari_hareket h LEFT JOIN cari k ON k.firma=h.firma AND k.id=h.cari_id
          WHERE h.firma='0101' AND h.tarih=? AND h.izahat NOT IN (103,104) AND IFNULL(h.ozelkod,'')<>'KREDIHESABI'
          AND NOT (IFNULL(k.ozelkod5,'')='PERSONELCARI' OR IFNULL(k.tip,-1) IN (11,12))`, t);
  for (const kind of ["kasa", "banka", "cari"]) {
    const res = B.balanceAt(c, kind, ["2025-12-30", "2025-12-31", "2026-01-01"]);
    const a = res.get("2025-12-30").net, b = res.get("2025-12-31").net, n = res.get("2026-01-01").net;
    assert.ok(Math.abs(a) > 1, `${kind}: bakiye sıfır`);
    // Yeni dönemin açılış devri 31 Aralık tarihli; bakiye farkları yalnız gerçek hareketten gelmeli
    assert.ok(Math.abs((b - a) - flow(kind, "2025-12-31")) < 0.05, `${kind}: 30→31 Ara farkı ${b - a}, gerçek hareket ${flow(kind, "2025-12-31")}`);
    assert.ok(Math.abs((n - b) - flow(kind, "2026-01-01")) < 0.05, `${kind}: 31 Ara→1 Oca farkı ${n - b}, gerçek hareket ${flow(kind, "2026-01-01")}`);
  }
});

test("akışlar devir hariç: 31 Aralık devir satırları ciroya/tahsilata girmez", () => {
  const store = demoStore();
  const c = ctx(store);
  const withDevir = store.db.value("SELECT COUNT(*) FROM cari_hareket WHERE izahat IN (103,104)");
  assert.ok(withDevir > 0);
  const t = Q.total(c, "satis", { bas: "2025-12-31", bit: "2025-12-31" });
  const direct = store.db.value(`SELECT IFNULL(SUM(h.borc-h.alacak),0) FROM cari_hareket h LEFT JOIN cari k ON k.firma=h.firma AND k.id=h.cari_id
    WHERE h.tarih='2025-12-31' AND h.izahat=21 AND IFNULL(h.ozelkod,'')<>'KREDIHESABI' AND h.firma IN ('0101','0103','0106')
    AND NOT (IFNULL(k.ozelkod5,'')='PERSONELCARI' OR IFNULL(k.tip,-1) IN (11,12))`);
  assert.ok(Math.abs(t - direct) < 0.01);
});

test("kârlılık = Arctos kâr analizi (STOKTIPI∉12,13,14 · DETAY=0 · iptal hariç · iade düşer · döviz ×KUR)", () => {
  const store = demoStore();
  const c = ctx(store);
  const w = { bas: "2026-01-01", bit: TODAY };
  const net = Q.total(c, "net_satis", w);
  const kar = Q.total(c, "brut_kar", w);
  const r = store.db.get(`SELECT
      SUM((CASE WHEN iade=1 THEN -1 ELSE 1 END) * (CASE WHEN IFNULL(pb,'') IN ('','TL') THEN 1 ELSE kur END) * tutar) AS net,
      SUM((CASE WHEN iade=1 THEN -1 ELSE 1 END) * (CASE WHEN IFNULL(pb,'') IN ('','TL') THEN 1 ELSE kur END) * (tutar - miktar*afiyat - masraf)) AS kar
    FROM satis WHERE tarih BETWEEN ? AND ? AND stoktipi NOT IN (12,13,14) AND detay = 0 AND iptal = 0`, w.bas, w.bit);
  assert.ok(Math.abs(net - r.net) < 0.01);
  assert.ok(Math.abs(kar - r.kar) < 0.01);
  // Hizmet satırı (STOKTIPI 12), iptal ve dövizli satırlar demo veride gerçekten var
  assert.ok(store.db.value("SELECT COUNT(*) FROM satis WHERE stoktipi = 12") > 0);
  assert.ok(store.db.value("SELECT COUNT(*) FROM satis WHERE iptal = 1") > 0);
  assert.ok(store.db.value("SELECT COUNT(*) FROM satis WHERE pb = 'EUR'") > 0);
  const marj = Q.total(c, "brut_marj", w);
  assert.ok(Math.abs(marj - (kar / net) * 100) < 1e-9);
});

test("büyüme endeksi: ufuk, bileşik, reel ve sınırlar", () => {
  const g = growthAnalysis(ctx(demoStore()));
  assert.equal(g.ufuk, "ttm");
  assert.ok(g.yuzde > 0.1 && g.yuzde < 0.8, `nominal büyüme ${g.yuzde}`);
  assert.ok(Math.abs(g.reel - ((1 + g.yuzde) / 1.25 - 1)) < 1e-12);
  assert.equal(g.bilesenler.length, 4);
  assert.ok(g.tahmin && g.tahmin.aylar.length === 3);
  assert.ok(findNonFinite(g) === null);
  // Bileşik: eksik bileşen ağırlığı yeniden ölçeklenir, uç değer kırpılır
  assert.equal(composite([{ agirlik: 0.5, yuzde: 0.2 }, { agirlik: 0.5, yuzde: null }]), 0.2);
  assert.equal(composite([{ agirlik: 1, yuzde: 10 }]), 3);
  assert.equal(realGrowth(0.25, 25, "ttm"), 0);
  assert.equal(realGrowth(0.1, null, "ttm"), null);
  // Enflasyon yoksa reel yok
  assert.equal(growthAnalysis(ctx(demoStore(), {})).reel, null);
});

test("sağlık skoru: 0-100, not tutarlı, açıklamalı", () => {
  const h = healthScore(ctx(demoStore()));
  assert.ok(h.skor >= 0 && h.skor <= 100);
  const expect = h.skor >= 80 ? "A" : h.skor >= 65 ? "B" : h.skor >= 50 ? "C" : h.skor >= 35 ? "D" : "E";
  assert.equal(h.not, expect);
  assert.equal(h.sutunlar.length, 5);
  for (const s of h.sutunlar) for (const m of s.olcutler) {
    assert.ok(m.skor === null || (m.skor >= 0 && m.skor <= 100));
    assert.equal(typeof m.aciklama, "string");
  }
  assert.ok(h.olumlu.length + h.olumsuz.length > 0);
});

test("nakit projeksiyonu ve uyarılar", () => {
  const c = ctx(demoStore());
  const p = projection(c, { gun: 90 });
  assert.equal(p.seri.length, 91);
  assert.ok(Math.abs(p.seri[0].beklenen - position(c).likit) < 0.01);
  const al = alerts(c);
  for (const a of al) {
    assert.ok(["kritik", "uyari", "bilgi"].includes(a.seviye));
    assert.ok(a.baslik && a.mesaj && a.ikon);
    assert.ok(!/\bundefined\b|NaN/.test(a.mesaj), a.mesaj);
  }
  const order = al.map((a) => ({ kritik: 0, uyari: 1, bilgi: 2 })[a.seviye]);
  assert.deepEqual(order, [...order].sort((x, y) => x - y));
});

test("genel durum: sonlu sayılar, varlık/yükümlülük toplamları", () => {
  const o = overview(ctx(demoStore()));
  assert.equal(findNonFinite(o), null);
  const v = o.durum.varliklar;
  assert.ok(Math.abs(v.toplam - (v.kasa + v.banka + v.doviz + v.alacak + v.cekSenet + v.stok)) < 0.01);
  assert.ok(Math.abs(o.durum.netIsletmeSermayesi - (v.toplam - o.durum.yukumlulukler.toplam)) < 0.01);
  assert.equal(o.spark.length, 30);
});

test("firma seçimi: tek firma ile konsolide toplamlar tutarlı", () => {
  const store = demoStore();
  const w = { bas: "2026-01-01", bit: TODAY };
  const all = Q.total(ctx(store, {}, { firmalar: ["0101", "0103"] }), "satis", w);
  const a = Q.total(ctx(store, {}, { firmalar: ["0101"] }), "satis", w);
  const b = Q.total(ctx(store, {}, { firmalar: ["0103"] }), "satis", w);
  assert.ok(Math.abs(all - (a + b)) < 0.01);
  assert.ok(a > 0 && b > 0);
});

test("izahat eşlemesi ayarlardan değişir (ör. 27 satış irsaliyesini ciroya katmak)", () => {
  const store = demoStore();
  const w = { bas: "2026-01-01", bit: TODAY };
  const def = Q.total(ctx(store), "tahsilat", w);
  const only13 = Q.total(ctx(store, { izahat: { TAHSILAT: [13] } }), "tahsilat", w);
  const havale = Q.total(ctx(store), "tahsilat_havale", w);
  assert.ok(Math.abs(def - (only13 + havale)) < 0.01);
  assert.ok(P.isDate(TODAY));
});
