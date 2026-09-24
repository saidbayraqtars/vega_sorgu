// ═══════════════════════════════════════════════════════════════════════════
//  Demo veri üreteci — Arctos/VEGADB'ye BİREBİR benzeyen ham tablolar üretir
//  (F{firma}TBLCARI, F{firma}D{donem}TBLCARIHAREKETLERI, VARES* görünüm satırları…).
//  Kolon adları ve kod anlamları Vega Kılavuzu'ndaki doğrulanmış yapıyla aynıdır;
//  bu sayede aynı veri hem doğrudan buluta (demo), hem SQL Server'a (köprü testi) yüklenir.
//
//  Simülasyon: günlük satış faturaları (mevsimsellik, hafta içi etkisi, enflasyon,
//  reel büyüme), vadeli tahsilat (nakit/havale/çek/senet/kart), tedarikçi alımları ve
//  ödemeleri, masraflar, kasa↔banka virmanları (ISLEMTIPI=2), POS/KREDIKASA satırları,
//  personel carileri, KREDIHESABI satırları, müşteri bankası (MUSBANKA=1), pasif hesap,
//  döviz kasa/hesap (yalnız adında EURO), dövizli ihracat faturaları, iade ve iptal
//  faturaları, siparişler, yıl sonu açılış devirleri, depo envanteri deltaları.
// ═══════════════════════════════════════════════════════════════════════════

const N = require("./names");
const P = require("../engine/period");

// ─── Tohumlu rastgele ─────────────────────────────────────────────────────
class Rng {
  constructor(seed = 42) { this.s = seed >>> 0; }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  normal(mu = 0, sd = 1) {
    const u = 1 - this.next(), v = this.next();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  poisson(l) {
    if (l <= 0) return 0;
    if (l > 30) return Math.max(0, Math.round(this.normal(l, Math.sqrt(l))));
    const L = Math.exp(-l);
    let k = 0, p = 1;
    do { k++; p *= this.next(); } while (p > L);
    return k - 1;
  }
  weighted(items, wKey = "w") {
    let tot = 0;
    for (const it of items) tot += it[wKey];
    let r = this.next() * tot;
    for (const it of items) { r -= it[wKey]; if (r <= 0) return it; }
    return items[items.length - 1];
  }
}

const r2 = (x) => Math.round(x * 100) / 100;
const pad = (n, w) => String(n).padStart(w, "0");

// Yıllık fiyat enflasyonu (simülasyon) → aylık bileşik endeks
const ENF = { 2021: 0.36, 2022: 0.64, 2023: 0.55, 2024: 0.42, 2025: 0.30, 2026: 0.25, 2027: 0.2 };
function priceIndex(d) {
  const [y, m] = d.split("-").map(Number);
  let idx = 1;
  for (let yy = 2021; yy < y; yy++) idx *= 1 + (ENF[yy] ?? 0.25);
  idx *= (1 + (ENF[y] ?? 0.25)) ** ((m - 1) / 12);
  return idx / ((1 + ENF[2021]) * (1 + ENF[2022])); // 2023-01 ≈ 1
}
function eurRate(d) { return r2(21 * priceIndex(d) ** 0.85); }

const MEVSIM = [0.86, 0.88, 1.0, 1.02, 1.05, 1.0, 0.94, 0.86, 1.03, 1.08, 1.12, 1.16];
const HAFTAGUNU = [1.12, 1.06, 1.0, 1.0, 1.05, 0.42, 0]; // Pzt..Paz

const DEFAULT_FIRMS = [
  { ind: 101, kod: "01", kisa: "DEMO MERKEZ", unvan: "Demo Ticaret A.Ş.", donemler: { 2023: 14, 2024: 15, 2025: 16, 2026: 17, 2027: 18 },
    baslangic: "2023-01-01", musteri: 200, tedarikci: 24, urun: 260, gunlukFatura: 15, reelBuyume: 0.08, ihracat: true, sube: "MERKEZ" },
  { ind: 103, kod: "03", kisa: "DEMO ŞUBE", unvan: "Demo Şube Gıda Ltd. Şti.", donemler: { 2024: 13, 2025: 14, 2026: 15 },
    baslangic: "2024-01-01", musteri: 60, tedarikci: 10, urun: 110, gunlukFatura: 5, reelBuyume: -0.04, ihracat: false, sube: "ANKARA" },
  { ind: 106, kod: "06", kisa: "ESKİ FİRMA", unvan: "Eski Firma Ltd. (kapandı)", donemler: { 2022: 9 },
    baslangic: "2022-01-01", bitis: "2022-12-31", musteri: 25, tedarikci: 5, urun: 40, gunlukFatura: 2, reelBuyume: 0, ihracat: false, sube: "MERKEZ" },
];

class FirmaSim {
  constructor(raw, cfg, rng, today, olcek) {
    this.raw = raw; this.cfg = cfg; this.rng = rng; this.today = today; this.olcek = olcek;
    this.fkod = pad(cfg.ind, 4);
    this.F = raw.F[this.fkod] = { TBLCARI: [], TBLSTOKLAR: [], TBLBANKALAR: [], TBLBIRIMLEREX: [], D: {} };
    this.ind = new Map(); // tablo sayaçları
    this.events = new Map(); // tarih → [fn]
    this.cariBal = new Map(); // cari IND → bakiye (KREDIHESABI hariç)
    this.kasaBal = new Map(); // kasa adı → nakit bakiye (ISLEMTIPI=1, KREDIKASA hariç)
    this.bankBal = new Map(); // banka IND → bakiye
    this.stock = new Map(); // stok IND → miktar (depo 1)
    this.cekler = []; // tüm çek/senetler
    this.faturaNo = 0; this.cekNo = 0; this.siparisNo = 0;
  }

  next(table, donem = "") {
    const k = `${table}|${donem}`;
    const v = (this.ind.get(k) || 0) + 1;
    this.ind.set(k, v);
    return v;
  }
  donemOf(d) {
    const y = Number(d.slice(0, 4));
    const dn = this.cfg.donemler[y];
    return dn ? pad(dn, 4) : null;
  }
  T(d, table) {
    const dn = typeof d === "string" && d.length === 4 ? d : this.donemOf(d);
    if (!dn) return null;
    if (!this.F.D[dn]) this.F.D[dn] = {};
    if (!this.F.D[dn][table]) this.F.D[dn][table] = [];
    return { rows: this.F.D[dn][table], dn };
  }
  schedule(d, fn) {
    if (this.curDay && d <= this.curDay) d = P.addDays(this.curDay, 1); // o günün olayları zaten işlendi
    if (d > this.today) return;
    if (!this.events.has(d)) this.events.set(d, []);
    this.events.get(d).push(fn);
  }

  // ─── Kartlar ───────────────────────────────────────────────────────────
  buildCards() {
    const { rng, cfg } = this;
    const nM = Math.max(8, Math.round(cfg.musteri * this.olcek));
    const nT = Math.max(3, Math.round(cfg.tedarikci * this.olcek));
    const nU = Math.max(15, Math.round(cfg.urun * this.olcek));
    let id = 100;
    const ilW = N.ILLER.map(([ad, w]) => ({ ad, w }));
    this.musteriler = [];
    for (let i = 0; i < nM; i++) {
      const ad = `${rng.pick(N.ON)} ${rng.pick(N.SEKTOR)} ${rng.pick(N.EK)}`.toLocaleUpperCase("tr-TR");
      const vade = rng.pick([0, 15, 30, 30, 45, 60, 60, 90]);
      const pareto = 1 / Math.pow(1 - rng.next() * 0.985, 1 / 1.15); // ağır kuyruk
      const yavas = rng.chance(0.07), batik = rng.chance(0.025);
      const c = {
        IND: id++, FIRMAKODU: `120.01.${pad(i + 1, 4)}`, FIRMAADI: ad, UNVAN: ad, FIRMATIPI: rng.chance(0.08) ? 3 : 1,
        STATUS: rng.chance(0.04) ? 2 : 1, DELETED: null, SEHIR: rng.weighted(ilW).ad, ILCE: null,
        GRUP: rng.pick(N.GRUP), CARIKARTPERSONELI: rng.pick(N.TEMSILCI), OPSIYON: vade,
        KREDILIMITI: rng.chance(0.35) ? Math.round(pareto * 180000 / 1000) * 1000 : 0, RISKLIMITI: 0, OZELKOD5: "", BAKIYE: 0,
        _w: pareto, _vade: vade, _gecikme: yavas ? rng.int(35, 80) : batik ? 0 : rng.int(-5, 12), _batik: batik ? rng.int(200, 700) : null,
        _odeme: rng.weighted([{ m: "havale", w: 45 }, { m: "nakit", w: 20 }, { m: "cek", w: 20 }, { m: "kart", w: 10 }, { m: "senet", w: 5 }]).m,
        _baslangic: P.addDays(cfg.baslangic, rng.chance(0.75) ? 0 : rng.int(30, 900)),
      };
      this.musteriler.push(c);
      this.F.TBLCARI.push(c);
    }
    if (cfg.ihracat) {
      const c = { IND: id++, FIRMAKODU: "120.02.0001", FIRMAADI: "EUROPA HANDELS GMBH", UNVAN: "EUROPA HANDELS GMBH", FIRMATIPI: 1, STATUS: 1,
        SEHIR: "Yurt Dışı", GRUP: "İhracat", CARIKARTPERSONELI: N.TEMSILCI[0], OPSIYON: 60, KREDILIMITI: 0, RISKLIMITI: 0, OZELKOD5: "",
        _w: 0, _vade: 60, _gecikme: 5, _odeme: "havale", _ihracat: true, _baslangic: cfg.baslangic };
      this.ihracatMusteri = c;
      this.F.TBLCARI.push(c);
    }
    this.tedarikciler = [];
    for (let i = 0; i < nT; i++) {
      const ad = `${rng.pick(N.SOYAD)} ${rng.pick(N.SEKTOR)} ${rng.pick(["Toptan", "Dağıtım", "Üretim", "Gıda"])} ${rng.pick(N.EK)}`.toLocaleUpperCase("tr-TR");
      const t = { IND: id++, FIRMAKODU: `320.01.${pad(i + 1, 4)}`, FIRMAADI: ad, UNVAN: ad, FIRMATIPI: 2, STATUS: 1, SEHIR: rng.weighted(ilW).ad,
        OPSIYON: rng.pick([30, 45, 60]), KREDILIMITI: 0, RISKLIMITI: 0, OZELKOD5: "",
        _odeme: rng.weighted([{ m: "havale", w: 50 }, { m: "cek", w: 35 }, { m: "nakit", w: 15 }]).m };
      this.tedarikciler.push(t);
      this.F.TBLCARI.push(t);
    }
    this.personel = [];
    for (let i = 0; i < 4; i++) {
      const ad = `${rng.pick(["Ali", "Ayşe", "Can", "Deniz", "Emre", "Fatma", "Gül", "Hakan"])} ${rng.pick(N.SOYAD)}`.toLocaleUpperCase("tr-TR");
      const p = { IND: id++, FIRMAKODU: `335.01.${pad(i + 1, 4)}`, FIRMAADI: ad, UNVAN: ad, FIRMATIPI: 4, STATUS: 1, OZELKOD5: "PERSONELCARI", OPSIYON: 0 };
      this.personel.push(p);
      this.F.TBLCARI.push(p);
    }
    this.krediCari = { IND: id++, FIRMAKODU: "300.01.0001", FIRMAADI: "BANKA KREDİ HESABI", UNVAN: "BANKA KREDİ HESABI", FIRMATIPI: 2, STATUS: 1, OZELKOD5: "", OPSIYON: 0 };
    this.F.TBLCARI.push(this.krediCari);

    // Stok: dört sistem kartı (IND<100) + ürünler
    const sys = ["VADE FARKI", "KUR FARKI", "DEVIR", "HIZMET"];
    sys.forEach((ad, i) => this.F.TBLSTOKLAR.push({ IND: i + 1, STOKKODU: ad, MALINCINSI: ad, STOKTIPI: 0, MALIYET: 0, ALISFIYATI: 0 }));
    this.urunler = [];
    let sid = 100;
    for (let i = 0; i < nU; i++) {
      const grp = N.URUN_SINIF[i % N.URUN_SINIF.length];
      const marka = rng.pick(N.MARKA);
      const ad = `${marka} ${rng.pick(grp.urunler)} ${rng.pick(N.BOYUT)}`.toLocaleUpperCase("tr-TR");
      const base = r2(grp.fiyat[0] + rng.next() ** 1.6 * (grp.fiyat[1] - grp.fiyat[0]));
      const zararli = rng.chance(0.015); // bilerek maliyetin altında satılan ürün
      const u = {
        IND: sid++, STOKKODU: `${grp.sinif.slice(0, 3).toLocaleUpperCase("tr-TR")}${pad(i + 1, 5)}`, MALINCINSI: ad, STOKTIPI: 0,
        KOD1: "TİCARİ MAL", KOD2: grp.sinif, KOD7: marka, KOD8: rng.chance(0.03) ? "PASİF" : "", KRITIKSEVIYE: rng.int(10, 60),
        MALIYET: 0, ALISFIYATI: 0, DELETED: null,
        _base: base, _maliyetOran: zararli ? 1.08 : 0.55 + rng.next() * 0.3, _pop: 1 / Math.pow(1 - rng.next() * 0.99, 1 / 1.1),
        _kdv: grp.sinif === "TEMEL GIDA" ? 1 : grp.sinif === "TEMİZLİK" || grp.sinif === "KİŞİSEL BAKIM" || grp.sinif === "KAĞIT" ? 20 : 10,
        _ted: null,
      };
      u._ted = this.tedarikciler[i % this.tedarikciler.length];
      this.urunler.push(u);
      this.F.TBLSTOKLAR.push(u);
      this.F.TBLBIRIMLEREX.push({ IND: u.IND * 10, STOKNO: u.IND, BIRIMADI: rng.pick(["ADET", "ADET", "KOLİ", "KG", "PAKET"]), VARSAYILAN: 1, CARPAN: 1 });
      u.BIRIMEX = u.IND * 10;
      this.stock.set(u.IND, rng.int(40, 200));
    }
    this.hizmet = { IND: sid++, STOKKODU: "HZM00001", MALINCINSI: "NAKLİYE HİZMETİ", STOKTIPI: 12, KOD2: "HİZMET", _base: 250, _kdv: 20 };
    this.F.TBLSTOKLAR.push(this.hizmet);

    // Bankalar
    const bnk = (IND, ADI, ext = {}) => { const b = { IND, ADI, KOD: `B${IND}`, SUBE: "MERKEZ", SUBEADI: "MERKEZ", IBAN: `TR${pad(IND, 24)}`, HESAPNO: `${IND}000`, PARABIRIMI: "TL", MUSBANKA: 0, STATUS: 1, ...ext }; this.F.TBLBANKALAR.push(b); this.bankBal.set(IND, 0); return b; };
    this.bankaAna = bnk(100, `${N.BANKALAR[0]} TL`);
    this.bankaIki = bnk(101, `${N.BANKALAR[1]} TL`);
    this.bankaKmh = bnk(102, `${N.BANKALAR[2]} KMH`);
    this.bankaEuro = this.cfg.ihracat ? bnk(103, "HALKBANK-EURO") : null;
    this.bankaMus = bnk(104, "MÜŞTERİ BANKASI (ÇEK)", { MUSBANKA: 1 });
    this.bankaPasif = bnk(105, "ESKİ VADESİZ HESAP", { STATUS: 2 });
    this.kasalar = [`${cfg.sube} KASA`, cfg.ihracat ? "İÇ KASA EURO" : null].filter(Boolean);
    for (const k of this.kasalar) this.kasaBal.set(k, 0);
  }

  // ─── Satır yazıcıları ─────────────────────────────────────────────────
  cari(d, ciro) { // ciro: {cari, izahat, borc, alacak, evrak, ln, vade, ozelkod, iade, pb, kur, saat}
    const t = this.T(d, "TBLCARIHAREKETLERI");
    if (!t) return;
    const hh = ciro.saat ?? this.rng.int(9, 18);
    const ts = `${d} ${pad(hh, 2)}:${pad(this.rng.int(0, 59), 2)}:00`;
    t.rows.push({
      IND: this.next("CH", t.dn), FIRMANO: ciro.cari.IND, TARIH: d, IZAHAT: String(ciro.izahat), EVRAKNO: ciro.evrak || null,
      BORC: r2(ciro.borc || 0), ALACAK: r2(ciro.alacak || 0), BAKIYE: 0, LN: ciro.ln ?? null, IADE: ciro.iade ? 1 : 0,
      PARABIRIMI: ciro.pb || "TL", KUR: ciro.kur || 1, ODEMETARIHI: ciro.vade || d, ISLEMTARIHI: ts, SIRALAMATARIHI: ts,
      OZELKOD: ciro.ozelkod ?? "MERKEZ",
    });
    if (ciro.ozelkod !== "KREDIHESABI") this.cariBal.set(ciro.cari.IND, (this.cariBal.get(ciro.cari.IND) || 0) + r2(ciro.borc || 0) - r2(ciro.alacak || 0));
  }
  kasa(d, { kasa, gelir = 0, gider = 0, islemtipi = 1, belgeizahat = 0, aciklama = "", belgelink = null, kredikasa = false }) {
    const t = this.T(d, "TBLKASA");
    if (!t) return;
    const ind = this.next("KS", t.dn);
    let link = belgelink;
    if (kredikasa) {
      const tb = this.T(d, "TBLTAHSILBASLIK");
      link = this.next("TB", t.dn);
      tb.rows.push({ IND: link, BELGETIPI: 15, OZELKOD3: "KREDIKASA", TARIH: d });
    }
    t.rows.push({ IND: ind, TARIH: d, GELIR: r2(gelir), GIDER: r2(gider), KUR: 1, PARABIRIMI: "TL", ISLEMTIPI: islemtipi,
      BELGEIZAHAT: kredikasa ? 15 : belgeizahat, BELGELINK: link, KASAADI: kasa, SUBEADI: this.cfg.sube, ACIKLAMA: aciklama,
      ISLEM: islemtipi === 1 ? 1 : -26 });
    if (islemtipi === 1 && !kredikasa) this.kasaBal.set(kasa, (this.kasaBal.get(kasa) || 0) + r2(gelir) - r2(gider));
  }
  banka(d, { banka, borc = 0, alacak = 0, izahat, aciklama = "" }) {
    const t = this.T(d, "TBLBANKAHAREKETLERI");
    if (!t) return;
    const ts = `${d} ${pad(this.rng.int(9, 17), 2)}:00:00`;
    t.rows.push({ IND: this.next("BH", t.dn), BANKANO: banka.IND, TARIH: d, SIRALAMATARIHI: ts, IZAHAT: izahat, EVRAKNO: null,
      BORC: r2(borc), ALACAK: r2(alacak), KUR: 1, PARABIRIMI: "TL", ACIKLAMA: aciklama });
    this.bankBal.set(banka.IND, (this.bankBal.get(banka.IND) || 0) + r2(borc) - r2(alacak));
  }
  envanter(d, stokno, miktar, belgetipi, belgeind = null) {
    const t = this.T(d, "TBLDEPOENVANTER");
    if (!t) return;
    t.rows.push({ IND: this.next("DE", t.dn), TARIH: d, STOKNO: stokno, DEPO: 1, ENVANTER: miktar, BELGETIPI: belgetipi, BELGEIND: belgeind, HAREKETIND: null });
    if (belgetipi !== 90) this.stock.set(stokno, (this.stock.get(stokno) || 0) + miktar);
  }

  // Kasa nakdi yetersizse bankadan nakit çek (kasa GELIR ISLEMTIPI=1, banka 73).
  // Not: ISLEMTIPI=2/3 satırları (virman/çek-senet transferi) ayrıca "gürültü" olarak
  // üretilir ve Arctos formülünde nakde sayılmaz (Kılavuz §24.2) — kural testi içindir.
  ensureCash(d, kasa, need) {
    const bal = this.kasaBal.get(kasa) || 0;
    if (bal - need >= 5000) return;
    const amt = Math.ceil((need - bal + 50000) / 1000) * 1000;
    this.banka(d, { banka: this.bankaAna, alacak: amt, izahat: 73, aciklama: "KASAYA NAKİT ÇEKİLDİ" });
    this.kasa(d, { kasa, gelir: amt, islemtipi: 1, belgeizahat: 0, aciklama: `${this.bankaAna.ADI} ÇEKİLEN` });
  }

  // ─── Olaylar ──────────────────────────────────────────────────────────
  devir(d) {
    // d = yeni yılın 1 Ocak'ı → devir satırları (Y-1)-12-31 tarihli, yeni dönemde
    const y = Number(d.slice(0, 4));
    const dn = this.donemOf(d);
    if (!dn) return;
    const dt = `${y - 1}-12-31`;
    const T = (tbl) => this.T(dn, tbl);
    const ch = T("TBLCARIHAREKETLERI");
    for (const [cid, bal] of this.cariBal) {
      if (Math.abs(bal) < 0.01) continue;
      const ts = `${dt} 23:59:00`;
      ch.rows.push({ IND: this.next("CH", dn), FIRMANO: cid, TARIH: dt, IZAHAT: bal > 0 ? "104" : "103", EVRAKNO: `DEV${y}`,
        BORC: bal > 0 ? r2(bal) : 0, ALACAK: bal < 0 ? r2(-bal) : 0, BAKIYE: 0, LN: null, IADE: 0, PARABIRIMI: "TL", KUR: 1,
        ODEMETARIHI: dt, ISLEMTARIHI: ts, SIRALAMATARIHI: ts, OZELKOD: "MERKEZ" });
    }
    const ks = T("TBLKASA");
    for (const [k, bal] of this.kasaBal) {
      if (Math.abs(bal) < 0.01) continue;
      ks.rows.push({ IND: this.next("KS", dn), TARIH: dt, GELIR: bal > 0 ? r2(bal) : 0, GIDER: bal < 0 ? r2(-bal) : 0, KUR: 1, PARABIRIMI: "TL",
        ISLEMTIPI: 1, BELGEIZAHAT: 0, BELGELINK: null, KASAADI: k, SUBEADI: this.cfg.sube, ACIKLAMA: `${y} AÇILIŞ DEVRİ`, ISLEM: 0 });
    }
    const bh = T("TBLBANKAHAREKETLERI");
    for (const [b, bal] of this.bankBal) {
      if (Math.abs(bal) < 0.01) continue;
      bh.rows.push({ IND: this.next("BH", dn), BANKANO: b, TARIH: dt, SIRALAMATARIHI: `${dt} 23:59:00`, IZAHAT: bal > 0 ? 113 : 114, EVRAKNO: null,
        BORC: bal > 0 ? r2(bal) : 0, ALACAK: bal < 0 ? r2(-bal) : 0, KUR: 1, PARABIRIMI: "TL", ACIKLAMA: `${y} AÇILIŞ DEVRİ` });
    }
    const de = T("TBLDEPOENVANTER");
    for (const [s, q] of this.stock) {
      if (!q) continue;
      de.rows.push({ IND: this.next("DE", dn), TARIH: dt, STOKNO: s, DEPO: 1, ENVANTER: q, BELGETIPI: 90, BELGEIND: null, HAREKETIND: null });
    }
  }

  satisFaturasi(d, c, { iade = false, iptal = false, ihracat = false } = {}) {
    const { rng } = this;
    const idx = priceIndex(d);
    const t = this.T(d, "TBLSATFATBASLIK");
    if (!t) return;
    const lines = [];
    const nLine = ihracat ? rng.int(3, 8) : 1 + rng.poisson(2.6);
    const kur = ihracat ? eurRate(d) : 1;
    const personel = c.CARIKARTPERSONELI || rng.pick(N.TEMSILCI);
    if (!this.satilabilir) this.satilabilir = this.urunler.filter((x) => x.KOD8 !== "PASİF");
    for (let i = 0; i < nLine; i++) {
      const u = rng.weighted(rng.chance(0.01) ? this.urunler : this.satilabilir, "_pop");
      const fiyatTL = r2(u._base * idx * (1 - rng.pick([0, 0, 0, 0.03, 0.05, 0.1])));
      const maliyet = r2(u._base * idx * u._maliyetOran * (1 - 0.015));
      let miktar = Math.max(1, Math.round((2400 / Math.max(u._base, 5)) * (0.3 + rng.next() * 1.4)));
      if (ihracat) miktar *= 8;
      const fiyat = ihracat ? r2(fiyatTL / kur) : fiyatTL;
      lines.push({ u, miktar, fiyat, afiyat: ihracat ? r2(maliyet / kur) : maliyet, kdv: ihracat ? 0 : u._kdv });
    }
    if (!ihracat && rng.chance(0.06)) lines.push({ u: this.hizmet, miktar: 1, fiyat: r2(250 * idx), afiyat: 0, kdv: 20 });
    const ara = r2(lines.reduce((s, l) => s + l.miktar * l.fiyat, 0));
    const kdvT = r2(lines.reduce((s, l) => s + l.miktar * l.fiyat * l.kdv / 100, 0));
    const toplam = r2(ara + kdvT);
    const ind = this.next("SFB", t.dn);
    const y = d.slice(0, 4);
    const belgeno = iade ? `IAD${y}${pad(++this.faturaNo, 9)}` : `MSA${y}${pad(++this.faturaNo, 9)}`;
    t.rows.push({ IND: ind, BELGENO: belgeno, TARIH: d, ODEMETARIHI: P.addDays(d, c._vade || 0), FIRMANO: c.IND, BELGETIPI: iade ? 23 : 21,
      TUTAR: toplam, ARATOPLAM: ara, KDV: kdvT > 0 ? 1 : 0, IPTAL: iptal ? 1 : 0, IADE: iade ? 1 : 0, PARABIRIMI: ihracat ? "EUR" : "TL", KUR: kur });
    const h = this.T(d, "TBLSATFATHAREKET");
    lines.forEach((l, i) => {
      h.rows.push({ IND: this.next("SFH", t.dn), EVRAKNO: ind, DETAY: 0, SATIRNO: i + 1, TARIH: d, FIRMANO: c.IND, STOKNO: l.u.IND,
        MALINCINSI: l.u.MALINCINSI, STOKKODU: l.u.STOKKODU, STOKTIPI: l.u.STOKTIPI, MIKTAR: l.miktar, BIRIMMIKTAR: 1, BIRIM: "ADET",
        BIRIMEX: l.u.BIRIMEX || null, FIYATI: l.fiyat, AFIYATI: l.afiyat, KDV: l.kdv, GERCEKTOPLAM: r2(l.miktar * l.fiyat), DEPO: 1,
        PARABIRIMI: ihracat ? "EUR" : "TL", KUR: kur, MASRAF: 0, PERSONEL: personel });
      if (!iptal && l.u.STOKTIPI === 0) this.envanter(d, l.u.IND, iade ? l.miktar : -l.miktar, iade ? 23 : 21, ind);
      if (!iptal && !iade && l.u.STOKTIPI === 0) { l.u.MALIYET = r2(l.afiyat * (ihracat ? kur : 1)); }
    });
    if (iptal) return null; // iptal faturası cariye yazılmaz
    const tl = r2(toplam * kur);
    if (iade) {
      this.cari(d, { cari: c, izahat: 23, alacak: tl, evrak: belgeno, ln: ind, iade: true });
      return null;
    }
    this.cari(d, { cari: c, izahat: 21, borc: tl, evrak: belgeno, ln: ind, vade: P.addDays(d, c._vade || 0), pb: ihracat ? "EUR" : "TL", kur });
    return { tutar: tl, belgeno, ind };
  }

  tahsilatPlanla(d, c, tutar) {
    const { rng } = this;
    if (c._batik && P.diffDays(c._baslangic, d) > c._batik) return; // batık müşteri artık ödemiyor
    const gun = Math.max(0, Math.round((c._vade || 0) + c._gecikme + rng.normal(0, 6)));
    const parts = rng.chance(0.25) ? 2 : 1;
    for (let i = 0; i < parts; i++) {
      const pd = P.addDays(d, gun + i * rng.int(7, 20));
      const tt = r2(tutar / parts);
      this.schedule(pd, (day) => this.tahsilat(day, c, tt));
    }
  }

  tahsilat(d, c, tutar) {
    const { rng } = this;
    const m = rng.chance(0.85) ? c._odeme : rng.pick(["havale", "nakit", "cek", "kart"]);
    const evrak = `A${pad(this.next("CG", "x"), 7)}`;
    if (m === "havale") {
      this.cari(d, { cari: c, izahat: 83, alacak: tutar, evrak });
      this.banka(d, { banka: rng.chance(0.7) ? this.bankaAna : this.bankaIki, borc: tutar, izahat: 83, aciklama: `${c.FIRMAADI} HAVALE` });
    } else if (m === "nakit") {
      this.cari(d, { cari: c, izahat: 13, alacak: tutar, evrak });
      this.kasa(d, { kasa: this.kasalar[0], gelir: tutar, belgeizahat: 13, aciklama: c.FIRMAADI });
    } else if (m === "kart") {
      this.cari(d, { cari: c, izahat: 13, alacak: tutar, evrak });
      if (rng.chance(0.15)) this.kasa(d, { kasa: this.kasalar[0], gelir: tutar, kredikasa: true, aciklama: `POS ${c.FIRMAADI}` });
      this.schedule(P.addDays(d, rng.int(1, 30)), (day) => this.banka(day, { banka: this.bankaAna, borc: r2(tutar * 0.975), izahat: 72, aciklama: "POS BLOKE ÇÖZÜM" }));
    } else {
      // çek / senet
      const tur = m === "senet" ? "senet" : "cek";
      this.cari(d, { cari: c, izahat: 13, alacak: tutar, evrak });
      const vade = P.addDays(d, rng.int(30, 120));
      const karsiliksiz = rng.chance(0.03);
      const ck = { tur, yon: "alinan", no: `${tur === "cek" ? "C" : "S"}${pad(++this.cekNo, 7)}`, tutar, vade, tarih: d, cari: c, banka: rng.pick(N.BANKALAR),
        durum: "Tahsilat Yok", karsiliksiz };
      this.cekler.push(ck);
      const tahsilGunu = karsiliksiz ? (rng.chance(0.8) ? P.addDays(vade, rng.int(20, 90)) : null) : vade;
      if (tahsilGunu) {
        this.schedule(tahsilGunu, (day) => {
          ck.durum = "Tahsil Edildi";
          ck.kapanis = day;
          if (tur === "cek") this.banka(day, { banka: this.bankaAna, borc: tutar, izahat: 72, aciklama: `ÇEK TAHSİLİ ${ck.no}` });
          else this.kasa(day, { kasa: this.kasalar[0], gelir: tutar, belgeizahat: 13, aciklama: `SENET TAHSİLİ ${ck.no}` });
        });
      }
    }
  }

  alis(d, ted, urunler) {
    const { rng } = this;
    const idx = priceIndex(d);
    const t = this.T(d, "TBLALFATBASLIK");
    if (!t) return;
    const ind = this.next("AFB", t.dn);
    const lines = urunler.map(({ u, miktar }) => {
      const fiyat = r2(u._base * idx * u._maliyetOran * (0.97 + rng.next() * 0.04));
      u.ALISFIYATI = fiyat; u.MALIYET = fiyat;
      return { u, miktar, fiyat, kdv: u._kdv };
    });
    const ara = r2(lines.reduce((s, l) => s + l.miktar * l.fiyat, 0));
    const toplam = r2(ara + lines.reduce((s, l) => s + l.miktar * l.fiyat * l.kdv / 100, 0));
    const belgeno = `A${pad(this.next("AFNO", "x"), 7)}`;
    t.rows.push({ IND: ind, BELGENO: belgeno, TARIH: d, ODEMETARIHI: P.addDays(d, ted.OPSIYON), FIRMANO: ted.IND, BELGETIPI: 20, TUTAR: toplam,
      ARATOPLAM: ara, IPTAL: 0, IADE: 0, GIRIS: 1, PARABIRIMI: "TL", KUR: 1 });
    const h = this.T(d, "TBLALFATHAREKET");
    for (const l of lines) {
      h.rows.push({ IND: this.next("AFH", t.dn), EVRAKNO: ind, TARIH: d, FIRMANO: ted.IND, STOKNO: l.u.IND, MALINCINSI: l.u.MALINCINSI,
        STOKKODU: l.u.STOKKODU, STOKTIPI: 0, MIKTAR: l.miktar, FIYATI: l.fiyat, AFIYATI: l.fiyat, KDV: l.kdv, GERCEKTOPLAM: r2(l.miktar * l.fiyat),
        PARABIRIMI: "TL", KUR: 1, DEPO: 1 });
      this.envanter(d, l.u.IND, l.miktar, 20, ind);
    }
    this.cari(d, { cari: ted, izahat: 20, alacak: toplam, evrak: belgeno, ln: ind, vade: P.addDays(d, ted.OPSIYON) });
    const pd = P.addDays(d, ted.OPSIYON + rng.int(-3, 8));
    this.schedule(pd, (day) => this.tediye(day, ted, toplam));
  }

  tediye(d, ted, tutar) {
    const { rng } = this;
    const m = rng.chance(0.85) ? ted._odeme : rng.pick(["havale", "cek", "nakit"]);
    const evrak = `A${pad(this.next("CC", "x"), 7)}`;
    if (m === "havale") {
      this.cari(d, { cari: ted, izahat: 84, borc: tutar, evrak });
      this.banka(d, { banka: rng.chance(0.75) ? this.bankaAna : this.bankaIki, alacak: tutar, izahat: 84, aciklama: `${ted.FIRMAADI} ÖDEME` });
    } else if (m === "nakit") {
      this.ensureCash(d, this.kasalar[0], tutar);
      this.cari(d, { cari: ted, izahat: 11, borc: tutar, evrak });
      this.kasa(d, { kasa: this.kasalar[0], gider: tutar, belgeizahat: 11, aciklama: ted.FIRMAADI });
    } else {
      this.cari(d, { cari: ted, izahat: 11, borc: tutar, evrak });
      const vade = P.addDays(d, rng.int(30, 100));
      const ck = { tur: rng.chance(0.9) ? "cek" : "senet", yon: "verilen", no: `V${pad(++this.cekNo, 7)}`, tutar, vade, tarih: d, cari: ted,
        banka: this.bankaAna.ADI, durum: "Ödenecek" };
      this.cekler.push(ck);
      const odemeGunu = rng.chance(0.03) ? P.addDays(vade, rng.int(2, 12)) : vade; // nadir gecikme (uyarı testi)
      this.schedule(odemeGunu, (day) => {
        ck.durum = ck.tur === "cek" ? "Çek Ödenmiş" : "Senet Ödenmiş";
        ck.kapanis = day;
        this.banka(day, { banka: this.bankaAna, alacak: tutar, izahat: 16, aciklama: `ÇEK ÖDEME ${ck.no}` });
      });
    }
  }

  // ─── Günlük döngü ─────────────────────────────────────────────────────
  run() {
    const { cfg, rng } = this;
    this.buildCards();
    const end = cfg.bitis && cfg.bitis < this.today ? cfg.bitis : this.today;
    // Açılış: kasa + banka başlangıç bakiyeleri (ilk günün açılış kaydı)
    const d0 = cfg.baslangic;
    this.kasa(d0, { kasa: this.kasalar[0], gelir: 150000, belgeizahat: 0, aciklama: `${d0.slice(0, 4)} AÇILIŞ DEVRİ` });
    this.banka(d0, { banka: this.bankaAna, borc: 2500000, izahat: 113, aciklama: `${d0.slice(0, 4)} AÇILIŞ DEVRİ` });
    this.banka(d0, { banka: this.bankaIki, borc: 600000, izahat: 113, aciklama: `${d0.slice(0, 4)} AÇILIŞ DEVRİ` });
    this.banka(d0, { banka: this.bankaKmh, alacak: 900000, izahat: 114, aciklama: `${d0.slice(0, 4)} AÇILIŞ DEVRİ` });
    this.banka(d0, { banka: this.bankaMus, borc: 75000, izahat: 72, aciklama: "MÜŞTERİ ÇEKİ BANKASI" });
    this.banka(d0, { banka: this.bankaPasif, borc: 1234, izahat: 113, aciklama: "ESKİ HESAP" });
    if (this.bankaEuro) this.banka(d0, { banka: this.bankaEuro, borc: 40000, izahat: 113, aciklama: "EURO HESAP AÇILIŞ" });
    if (this.kasalar[1]) this.kasa(d0, { kasa: this.kasalar[1], gelir: 12000, belgeizahat: 0, aciklama: "EURO KASA AÇILIŞ" });

    let d = d0;
    let yearsFromStart = 0;
    while (d <= end) {
      this.curDay = d;
      if (d.slice(5) === "01-01" && d !== d0) this.devir(d);
      yearsFromStart = P.diffDays(d0, d) / 365;
      // Planlanmış olaylar (tahsilat, ödeme, çek vadeleri)
      const ev = this.events.get(d);
      if (ev) { for (const fn of ev) fn(d); this.events.delete(d); }

      const wd = P.weekday(d);
      const m = Number(d.slice(5, 7));
      const lambda = cfg.gunlukFatura * this.olcekFatura() * MEVSIM[m - 1] * HAFTAGUNU[wd] * (1 + cfg.reelBuyume) ** yearsFromStart;
      const n = rng.poisson(lambda);
      const aktifMus = this.musteriler.filter((c) => c.STATUS === 1 && c._baslangic <= d);
      for (let i = 0; i < n && aktifMus.length; i++) {
        const c = rng.weighted(aktifMus, "_w");
        const iptal = rng.chance(0.005);
        if (rng.chance(0.62)) this.siparis(P.addDays(d, -rng.int(0, 4)), c, null);
        const f = this.satisFaturasi(d, c, { iptal });
        if (f) this.tahsilatPlanla(d, c, f.tutar);
      }
      if (wd < 5 && rng.chance(0.03)) { // iade
        const c = rng.weighted(aktifMus, "_w");
        this.satisFaturasi(d, c, { iade: true });
      }
      if (this.ihracatMusteri && wd < 5 && rng.chance(0.04)) {
        const f = this.satisFaturasi(d, this.ihracatMusteri, { ihracat: true });
        if (f) this.tahsilatPlanla(d, this.ihracatMusteri, f.tutar);
      }
      if (wd < 5 && rng.chance(0.15)) this.siparis(d, rng.weighted(aktifMus.length ? aktifMus : this.musteriler, "_w"), rng.chance(0.3) ? 1 : 0);

      // Stok yenileme (Pazartesi/Perşembe)
      if (wd === 0 || wd === 3) {
        const byTed = new Map();
        for (const u of this.urunler) {
          const q = this.stock.get(u.IND) || 0;
          if (q < (u.KRITIKSEVIYE || 20) * 1.5 && !rng.chance(0.03)) {
            const want = Math.round((u.KRITIKSEVIYE || 20) * 4 + rng.int(0, 60) - Math.min(q, 0));
            if (!byTed.has(u._ted.IND)) byTed.set(u._ted.IND, { ted: u._ted, list: [] });
            byTed.get(u._ted.IND).list.push({ u, miktar: want });
          }
        }
        for (const { ted, list } of byTed.values()) this.alis(d, ted, list);
      }

      // Masraflar
      const kasa0 = this.kasalar[0];
      if (wd < 6 && rng.chance(0.5)) {
        const amt = r2(rng.int(300, 4000) * priceIndex(d));
        this.ensureCash(d, kasa0, amt);
        this.kasa(d, { kasa: kasa0, gider: amt, belgeizahat: 0, aciklama: rng.pick(["YAKIT", "YEMEK", "KIRTASİYE", "KARGO", "TEMİZLİK", "ÇAY OCAĞI"]) });
      }
      const dom = Number(d.slice(8));
      if (dom === 1) { // maaş + personel avansı
        const maas = r2(cfg.gunlukFatura * 30000 * priceIndex(d) * (0.8 + 0.1 * yearsFromStart));
        this.banka(d, { banka: this.bankaAna, alacak: maas, izahat: 73, aciklama: "MAAŞ ÖDEMESİ" });
        for (const p of this.personel) {
          if (rng.chance(0.4)) {
            const av = r2(rng.int(2000, 8000) * priceIndex(d));
            this.ensureCash(d, kasa0, av);
            this.cari(d, { cari: p, izahat: 11, borc: av, evrak: `AV${pad(this.next("AV", "x"), 6)}` });
            this.kasa(d, { kasa: kasa0, gider: av, belgeizahat: 11, aciklama: `AVANS ${p.FIRMAADI}` });
          }
        }
      }
      if (dom === 5) this.banka(d, { banka: this.bankaAna, alacak: r2(cfg.gunlukFatura * 9000 * priceIndex(d)), izahat: 73, aciklama: "KİRA" });
      if (dom === 15) this.banka(d, { banka: this.bankaIki, alacak: r2(cfg.gunlukFatura * 3500 * priceIndex(d)), izahat: 73, aciklama: "ELEKTRİK SU DOĞALGAZ" });
      if (dom === 26) this.banka(d, { banka: this.bankaAna, alacak: r2(cfg.gunlukFatura * 11000 * priceIndex(d)), izahat: 73, aciklama: "KDV VE SGK ÖDEMESİ" });
      if (dom === 10) this.banka(d, { banka: this.bankaKmh, alacak: r2(900000 * 0.035 * priceIndex(d) ** 0.3), izahat: 73, aciklama: "KMH FAİZ" });
      if (dom === 12 && rng.chance(0.3)) { // kredi hesabı cari satırı (bakiyeye girmez)
        this.cari(d, { cari: this.krediCari, izahat: 13, alacak: 100000, evrak: "KRD", ozelkod: "KREDIHESABI" });
      }
      // Kasa fazlasını bankaya yatır (kasa GIDER ISLEMTIPI=1, banka 72 BORC)
      const kb = this.kasaBal.get(kasa0) || 0;
      if (wd < 5 && kb > 250000) {
        const amt = Math.floor((kb - 80000) / 1000) * 1000;
        this.kasa(d, { kasa: kasa0, gider: amt, islemtipi: 1, aciklama: `${this.bankaAna.ADI} YATIRILAN` });
        this.banka(d, { banka: this.bankaAna, borc: amt, izahat: 72, aciklama: "KASADAN YATIRILAN" });
      }
      // Nakit OLMAYAN kasa satırları (ISLEMTIPI 2 = virman, 3 = çek/senet transferi) — formülde hariç
      if (wd === 2 && rng.chance(0.6)) this.kasa(d, { kasa: kasa0, gelir: r2(rng.int(5000, 60000) * priceIndex(d)), islemtipi: 3, aciklama: "ÇEK PORTFÖYÜ TRANSFER" });
      if (wd === 4 && rng.chance(0.3)) this.kasa(d, { kasa: kasa0, gelir: r2(rng.int(2000, 20000) * priceIndex(d)), islemtipi: 2, aciklama: "VİRMAN" });
      // Banka ana hesap eksiye düşerse KMH'den aktar
      if ((this.bankBal.get(this.bankaAna.IND) || 0) < 100000) {
        const amt = 600000;
        this.banka(d, { banka: this.bankaKmh, alacak: amt, izahat: 73, aciklama: "KMH KULLANIM" });
        this.banka(d, { banka: this.bankaAna, borc: amt, izahat: 72, aciklama: "KMH AKTARIM" });
      } else if ((this.bankBal.get(this.bankaAna.IND) || 0) > 3500000 && (this.bankBal.get(this.bankaKmh.IND) || 0) < -100000) {
        const amt = Math.min(1000000, -(this.bankBal.get(this.bankaKmh.IND) || 0));
        this.banka(d, { banka: this.bankaAna, alacak: amt, izahat: 73, aciklama: "KMH KAPAMA" });
        this.banka(d, { banka: this.bankaKmh, borc: amt, izahat: 72, aciklama: "KMH KAPAMA" });
      }
      // Döviz kasa/hesap küçük hareketleri (yalnız adında EURO — PARABIRIMI 'TL')
      if (this.kasalar[1] && rng.chance(0.03)) this.kasa(d, { kasa: this.kasalar[1], gelir: rng.int(100, 900), belgeizahat: 0, aciklama: "EURO TAHSİLAT" });
      if (this.bankaEuro && rng.chance(0.03)) this.banka(d, { banka: this.bankaEuro, borc: rng.int(500, 3000), izahat: 72, aciklama: "EURO GİRİŞ" });
      d = P.addDays(d, 1);
    }
    this.finish(end);
  }

  olcekFatura() { return Math.max(0.15, this.olcek); }

  siparis(d, c, iptal) {
    const t = this.T(d, "TBLALSIPBASLIK");
    if (!t) return;
    const tutar = r2((1500 + this.rng.next() * 12000) * priceIndex(d));
    t.rows.push({ IND: this.next("SP", t.dn), BELGENO: `A${pad(++this.siparisNo, 7)}`, TARIH: d, CREDATE: `${d} 10:00:00`, FIRMANO: c.IND,
      TUTAR: tutar, IPTAL: iptal === null ? 0 : iptal, PARABIRIMI: "TL", KUR: 1 });
  }

  finish(end) {
    // Taksitli satış takvimi: birkaç müşteri için gelecek taksitler
    const dn = this.donemOf(this.today);
    if (dn && end >= this.today) {
      for (let i = 0; i < 6; i++) {
        const c = this.rng.pick(this.musteriler);
        const tutar = r2(this.rng.int(5000, 20000) * priceIndex(this.today));
        for (let k = 1; k <= 4; k++) {
          const t = this.T(dn, "TBLWSTAKSITLISATIS");
          t.rows.push({ IND: this.next("TK", dn), IZAHAT: 100, TARIH: P.addMonths(this.today, k), TUTAR: tutar, FIRMANO: c.IND });
        }
      }
    }
    // VARES çek/senet görünümleri: her dönem, o yıl alınan/verilen + yıl başında açık olanlar
    for (const [yil, dnNo] of Object.entries(this.cfg.donemler)) {
      const dnk = pad(dnNo, 4);
      const yStart = `${yil}-01-01`, yEnd = `${yil}-12-31`;
      if (yStart > end) continue;
      if (!this.F.D[dnk]) this.F.D[dnk] = {};
      const V = (name) => (this.F.D[dnk][name] = this.F.D[dnk][name] || []);
      let vid = 0;
      for (const ck of this.cekler) {
        const acikBasta = ck.tarih < yStart && (!ck.kapanis || ck.kapanis >= yStart);
        const buYil = ck.tarih >= yStart && ck.tarih <= yEnd;
        if (!buYil && !acikBasta) continue;
        const view = ck.yon === "alinan" ? (ck.tur === "cek" ? "VARESALINANCEKLER" : "VARESALINANSENETLER") : (ck.tur === "cek" ? "VARESVERILENCEKLER" : "VARESVERILENSENETLER");
        const base = { IND: ++vid, BELGENO: ck.no, TUTAR: ck.tutar, VADE: ck.vade, FIRMAADI: ck.cari.FIRMAADI, FIRMAKODU: ck.cari.FIRMAKODU,
          BANKAADI: ck.banka, PARABIRIMI: "TL", KUR: 1 };
        if (view === "VARESALINANCEKLER") V(view).push({ ...base, KESIDEEDEN: ck.cari.FIRMAADI, KESIDETARIHI: ck.tarih, TAHSILDURUMU: ck.durum, BANKASUBE: "MERKEZ", TAKIPNO: ck.no });
        else if (view === "VARESALINANSENETLER") V(view).push({ ...base, KESIDEEDEN: ck.cari.FIRMAADI, TARIH: ck.tarih, TAHSILDURUMU: ck.durum });
        else if (view === "VARESVERILENCEKLER") V(view).push({ ...base, KESIDEEDENFIRMAADI: "DEMO TİCARET", KESIDETARIHI: ck.tarih, VCEKISLEM: ck.durum, SUBE: "MERKEZ" });
        else V(view).push({ ...base, SENETVRENEFIRMAADI: "DEMO TİCARET", TARIH: ck.tarih, VSENETISLEM: ck.durum });
      }
    }
    // Kart özet alanları (BAKIYE, MALIYET) — köprü bunları okumaz ama gerçekçilik için
    for (const c of this.F.TBLCARI) c.BAKIYE = r2(this.cariBal.get(c.IND) || 0);
  }
}

// ─── Dış arayüz ───────────────────────────────────────────────────────────
function generateRaw({ today = P.todayTR(), seed = 20260924, olcek = 1, firmalar = DEFAULT_FIRMS } = {}) {
  const rng = new Rng(seed);
  const raw = { TBLFIRMA: [], TBLDONEM: [], F: {} };
  for (const f of firmalar) {
    raw.TBLFIRMA.push({ IND: f.ind, KOD: f.kod, KISAAD: f.kisa, AD1: f.unvan });
    for (const [yil, dn] of Object.entries(f.donemler)) raw.TBLDONEM.push({ FIND: f.ind, IND: dn, DONEM: Number(yil) });
    const sim = new FirmaSim(raw, f, new Rng(rng.int(1, 2 ** 31)), today, olcek);
    sim.run();
    // Boş dönem tabloları (ör. önceden açılmış 2027) — köprü var olan boş tabloyu görmeli
    for (const dn of Object.values(f.donemler)) {
      const k = pad(dn, 4);
      if (!sim.F.D[k]) sim.F.D[k] = {};
    }
  }
  return raw;
}

module.exports = { generateRaw, Rng, priceIndex, eurRate, DEFAULT_FIRMS };
