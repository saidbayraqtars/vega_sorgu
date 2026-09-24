// ═══════════════════════════════════════════════════════════════════════════
//  Eşitleme motoru
//   1. hello  — ajan bilgisi, sunucunun istediği aralık
//   2. keşif  — TBLFIRMA / TBLDONEM + gerekli tabloların kolonları (tek sorgu)
//   3. manifest — her veri kümesi için ay/kova bazlı parmak izi (COUNT + CHECKSUM_AGG + SUM)
//   4. sunucu yalnız değişen/yeni parçaları ister → parçalar gzip JSON olarak (≤ 20.000 satır/istek) gider
//   5. commit — sunucu silinen parçaları temizler, veri sürümünü artırır
//  Güncel ve bir önceki yılın dönemleri her döngüde; eski dönemler `eskiDonemSaat` saatte bir taranır.
//  Zamanlayıcı: aralikDk dakikada bir + 60 sn'de bir ping ("Şimdi güncelle" / "Tam eşitleme").
// ═══════════════════════════════════════════════════════════════════════════

const crypto = require("crypto");
const os = require("os");
const { EventEmitter } = require("events");
const { DATASETS, chunkKey, scopeKey } = require("../../shared/datasets");
const { Sql, discover } = require("./sql");
const { Cloud } = require("./http");
const X = require("./extract");
const pkg = require("../package.json");

const ROWS_PER_REQUEST = 20000;
const FIRMA_DS = ["cari", "stok", "banka"];
const DONEM_DS = ["cari_hareket", "kasa_hareket", "banka_hareket", "satis", "alis", "siparis", "taksit", "cek_senet", "stok_durum"];

function sha(rows) { return crypto.createHash("sha1").update(JSON.stringify(rows)).digest("hex").slice(0, 16); }

class SyncEngine extends EventEmitter {
  constructor(config, { log = console, now = () => new Date() } = {}) {
    super();
    this.config = config;
    this.log = log;
    this.now = now;
    this.running = false;
    this.timer = null;
    this.pingTimer = null;
    this.intervalMin = 15;
    this.status = { durum: "bekliyor", son: null, sonHata: null, ilerleme: null, sonuc: null };
  }

  setStatus(patch) {
    this.status = { ...this.status, ...patch };
    this.emit("status", this.status);
  }

  cloud() {
    return new Cloud(this.config.cloud(), { agent: { surum: pkg.version } });
  }

  // Tek eşitleme turu
  async runOnce({ full = false, reason = "zamanlayici" } = {}) {
    if (this.running) return { atlandi: true };
    this.running = true;
    const syncId = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
    const started = Date.now();
    let cloud = null, sql = null;
    const stats = { parca: 0, gonderilen: 0, satir: 0, bayt: 0, sure: 0, neden: reason };
    this.setStatus({ durum: "calisiyor", ilerleme: { adim: "Bağlanıyor", yuzde: 0 }, sonHata: null });
    try {
      cloud = this.cloud();
      sql = new Sql({ ...this.config.sqlConfig(), kirliOkuma: this.config.data.kirliOkuma });
      const info = await sql.info();
      const hello = await cloud.hello({ surum: pkg.version, makine: os.hostname(), sql: { surum: info.surum, veritabani: info.veritabani } });
      if (hello && hello.aralikDk) this.intervalMin = hello.aralikDk;

      // ── Keşif ──
      this.setStatus({ ilerleme: { adim: "Firma ve dönemler okunuyor", yuzde: 5 } });
      const disc = await discover(sql);
      const want = this.config.data.firmalar && this.config.data.firmalar.length ? new Set(this.config.data.firmalar) : null;
      const firmalar = disc.firmalar.filter((f) => !want || want.has(f.firma));
      const nowYear = this.now().getFullYear();
      const minYear = Number(this.config.data.baslangicYili) || nowYear - 5;
      const donemler = disc.donemler.filter((d) => firmalar.some((f) => f.firma === d.firma) && (d.yil === null || d.yil >= minYear));
      const state = this.config.state();
      const coldDue = full || !state.eskiTarama || Date.now() - new Date(state.eskiTarama).getTime() > (Number(this.config.data.eskiDonemSaat) || 6) * 3600000;
      const hot = (d) => d.yil === null || d.yil >= nowYear - 1;
      const scanDonem = donemler.filter((d) => hot(d) || coldDue);

      sql.forgetColumns();
      const cols = await sql.columnsFor(X.candidateTables(firmalar.map((f) => f.firma), scanDonem));

      // ── Manifest ──
      const manifest = [];
      const scopes = [];
      const plans = new Map(); // key → { ds, plan, part, rows? }
      const globalRows = {
        firma: firmalar.map((f) => [f.firma, f.ad, f.unvan]),
        donem: disc.donemler.filter((d) => firmalar.some((f) => f.firma === d.firma)).map((d) => [d.firma, d.donem, d.yil]),
      };
      for (const [ds, rows] of Object.entries(globalRows)) {
        const key = chunkKey(ds);
        manifest.push({ key, n: rows.length, ck: sha(rows), sm: 0 });
        plans.set(key, { ds, rows });
        scopes.push(scopeKey(ds));
      }
      const units = [];
      for (const f of firmalar) for (const ds of FIRMA_DS) units.push({ ds, firma: f.firma, donem: "" });
      for (const d of scanDonem) for (const ds of DONEM_DS) units.push({ ds, firma: d.firma, donem: d.donem });
      let i = 0;
      for (const u of units) {
        i++;
        this.setStatus({ ilerleme: { adim: `Değişiklikler taranıyor (${i}/${units.length})`, yuzde: 5 + Math.round((i / units.length) * 35) } });
        const plan = X.PLANS[u.ds](u.firma, u.donem, cols);
        if (!plan) continue; // tablo bu kurulumda yok
        scopes.push(scopeKey(u.ds, u.firma, u.donem));
        const rows = await sql.query(X.manifestSql(u.ds, plan));
        for (const r of rows) {
          const part = u.ds === "cek_senet" ? "" : DATASETS[u.ds].partition === "month" ? (r.p || "0000-00") : String(r.p || "");
          if (u.ds === "cek_senet" && !Number(r.n)) continue;
          const key = chunkKey(u.ds, u.firma, u.donem, part);
          manifest.push({ key, n: Number(r.n) || 0, ck: String(r.ck ?? ""), sm: Number(r.sm) || 0 });
          plans.set(key, { ds: u.ds, plan, part });
        }
      }

      const diff = await cloud.manifest({ syncId, chunks: manifest, scopes, tam: full });
      const byKey = new Map(manifest.map((x) => [x.key, x]));
      const need = diff.need || [];
      stats.parca = manifest.length;
      stats.gonderilen = need.length;

      // ── Parçaları gönder ──
      let k = 0;
      for (const key of need) {
        k++;
        const p = plans.get(key);
        if (!p) continue;
        const m = byKey.get(key);
        this.setStatus({ ilerleme: { adim: `Gönderiliyor (${k}/${need.length})`, yuzde: 40 + Math.round((k / need.length) * 58) } });
        let rows;
        if (p.rows) rows = p.rows;
        else {
          const q = X.fetchSql(p.ds, p.plan, p.part);
          rows = X.rowsToArrays(await sql.query(q.sql, q.params), q.width);
        }
        const colsDs = DATASETS[p.ds].cols.map((c) => c[0]);
        for (let off = 0, seq = 0; off < Math.max(rows.length, 1); off += ROWS_PER_REQUEST, seq++) {
          const part = rows.slice(off, off + ROWS_PER_REQUEST);
          const last = off + ROWS_PER_REQUEST >= rows.length;
          const res = await cloud.chunk({ syncId, key, n: m.n, ck: m.ck, sm: m.sm, cols: colsDs, rows: part, seq, last });
          stats.bayt += res.bytes;
        }
        stats.satir += rows.length;
      }

      const done = await cloud.commit({ syncId, istatistik: { ...stats, sure: Date.now() - started } });
      stats.sure = Date.now() - started;
      if (coldDue) this.config.setState({ eskiTarama: new Date().toISOString() });
      this.config.setState({ sonEsitleme: new Date().toISOString(), sonSonuc: stats });
      this.setStatus({ durum: "tamam", son: new Date().toISOString(), ilerleme: null, sonuc: { ...stats, veriSurumu: done.veriSurumu } });
      this.log.info(`[köprü] eşitleme tamam: ${stats.gonderilen}/${stats.parca} parça, ${stats.satir} satır, ${Math.round(stats.bayt / 1024)} KB, ${stats.sure} ms`);
      return stats;
    } catch (err) {
      const msg = humanError(err);
      this.setStatus({ durum: "hata", sonHata: { mesaj: msg, zaman: new Date().toISOString() }, ilerleme: null });
      this.log.error(`[köprü] eşitleme hatası: ${msg}`);
      if (cloud) await cloud.event("hata", msg, syncId);
      throw Object.assign(new Error(msg), { cause: err });
    } finally {
      this.running = false;
      if (sql) await sql.close();
    }
  }

  // Zamanlayıcı: aralık + ping
  start() {
    this.stopped = false;
    const loop = async (full = false, reason = "zamanlayici") => {
      if (this.stopped) return;
      clearTimeout(this.timer);
      try { await this.runOnce({ full, reason }); } catch { /* durumda */ }
      if (!this.stopped) this.timer = setTimeout(() => loop(), this.intervalMin * 60000);
    };
    this.loop = loop;
    loop(false, "baslangic");
    const ping = async () => {
      if (this.stopped) return;
      try {
        const p = await this.cloud().ping();
        if (p && p.aralikDk && p.aralikDk !== this.intervalMin) this.intervalMin = p.aralikDk;
        this.setStatus({ baglanti: "tamam", sonPing: new Date().toISOString() });
        if (p && (p.simdiEsitle || p.tamEsitleme) && !this.running) loop(!!p.tamEsitleme, p.tamEsitleme ? "tam-esitleme" : "kullanici-istegi");
      } catch (e) {
        this.setStatus({ baglanti: "yok", sonPingHata: humanError(e) });
      }
      if (!this.stopped) this.pingTimer = setTimeout(ping, 60000);
    };
    this.pingTimer = setTimeout(ping, 60000);
  }

  syncNow(full = false) { if (this.loop && !this.running) this.loop(full, "elle"); }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.pingTimer);
  }
}

function humanError(err) {
  const m = String((err && err.message) || err);
  if (/Login failed|Oturum açma/i.test(m)) return "SQL Server girişi reddedildi: kullanıcı adı/şifreyi kontrol edin.";
  if (/ECONNREFUSED|Failed to connect|ESOCKET|getaddrinfo|ETIMEOUT/i.test(m) && !/Sunucuya ulaşılamadı/.test(m)) return `SQL Server'a bağlanılamadı (${m.slice(0, 120)}). Sunucu adı, port ve SQL Server hizmetini kontrol edin.`;
  if (/Geçersiz köprü anahtarı/.test(m)) return "Köprü anahtarı geçersiz ya da iptal edilmiş. Panelden yeni anahtar alın.";
  return m.slice(0, 500);
}

module.exports = { SyncEngine, humanError, FIRMA_DS, DONEM_DS };
