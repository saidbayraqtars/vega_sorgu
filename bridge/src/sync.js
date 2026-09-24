// ═══════════════════════════════════════════════════════════════════════════
//  Eşitleme motoru
//   1. hello  — ajan bilgisi, sunucunun istediği aralık
//   2. keşif  — TBLFIRMA / TBLDONEM + gerekli tabloların kolonları (tek sorgu)
//   3. manifest — her veri kümesi için ay/kova bazlı parmak izi (COUNT + CHECKSUM_AGG + SUM)
//   4. sunucu yalnız değişen/yeni parçaları ister → parçalar gzip JSON olarak (≤ 20.000 satır/istek) gider
//   5. commit — sunucu silinen parçaları temizler; veri değiştiyse sürümü artırır
//  Güncel ve bir önceki yılın dönemleri her döngüde; eski dönemler `eskiDonemSaat` saatte bir taranır.
//  Zamanlayıcı: aralikDk dakikada bir + 60 sn'de bir ping ("Şimdi güncelle" / "Tam eşitleme").
// ═══════════════════════════════════════════════════════════════════════════

const crypto = require("crypto");
const os = require("os");
const { EventEmitter } = require("events");
const { DATASETS, chunkKey, scopeKey } = require("../../shared/datasets");
const { Sql, discover } = require("./sql");
const { Cloud } = require("./http");
const { Lock } = require("./lock");
const X = require("./extract");
const pkg = require("../package.json");

const ROWS_PER_REQUEST = 20000;
const FIRMA_DS = ["cari", "stok", "banka"];
const DONEM_DS = ["cari_hareket", "kasa_hareket", "banka_hareket", "satis", "alis", "siparis", "taksit", "cek_senet", "stok_durum"];

function sha(rows) { return crypto.createHash("sha1").update(JSON.stringify(rows)).digest("hex").slice(0, 16); }

class SyncEngine extends EventEmitter {
  constructor(config, { log = console, now = () => new Date(), sahip = "kopru", yoklamaMs = {} } = {}) {
    super();
    this.config = config;
    this.log = log;
    this.now = now;
    this.sahip = sahip;        // tepsi | servis | komut — kilitte ve canlı durumda görünür
    this.mode = "durdu";       // etkin | izleyici (başka süreç eşitliyor) | durdu
    this.running = false;
    this.timer = null;
    this.pingTimer = null;
    this.localTimer = null;
    this.lockTimer = null;
    this.lock = null;
    this.nextAt = null;
    this.intervalMin = 15;
    this.lastPersist = 0;
    this.yoklama = { yerel: 10000, kilit: 60000, ping: 60000, ...yoklamaMs };
    this.status = { durum: "bekliyor", son: null, sonHata: null, ilerleme: null, sonuc: null };
  }

  setStatus(patch) {
    this.status = { ...this.status, ...patch };
    this.emit("status", this.status);
    this.persist(!patch.ilerleme);
  }

  // Canlı durum ayar klasörüne yazılır: izleyici süreç (ör. sunucu modunda tepsi) buradan okur
  persist(force = false) {
    if (this.mode !== "etkin") return;
    const t = Date.now();
    if (!force && t - this.lastPersist < 1500) return;
    this.lastPersist = t;
    this.config.setState({ canli: { ...this.status, mod: this.mode, sahip: this.sahip, pid: process.pid, sonraki: this.nextAt, aralikDk: this.intervalMin, at: new Date().toISOString() } });
  }

  cloud() {
    return new Cloud(this.config.cloud(), { agent: { surum: pkg.version } });
  }

  // Tek eşitleme turu
  async runOnce({ full = false, reason = "zamanlayici" } = {}) {
    if (this.running) return { atlandi: true };
    this.running = true;
    if (this.config.reloadIfChanged && this.config.reloadIfChanged()) this.log.info("[köprü] ayarlar yeniden okundu");
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
      this.setStatus({ firma: hello && hello.firma ? hello.firma : null, kaynak: { makine: info.makine, veritabani: info.veritabani } });

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

  // Zamanlayıcı: aralık + ping + yerel istek dosyası. kilit=true iken aynı klasörde
  // yalnız bir süreç eşitler; diğeri izleyici olur ve 60 sn'de bir kilidi yeniden dener.
  start({ kilit = true } = {}) {
    this.stopped = false;
    if (kilit && !this.lock) this.lock = new Lock(this.config.dir, this.sahip);
    const tryStart = () => {
      if (this.stopped) return;
      if (this.lock && !this.lock.tryAcquire()) {
        const h = this.lock.holder();
        this.mode = "izleyici";
        this.emit("status", { ...this.status, durum: "baska", baskaSahip: h ? h.sahip : null });
        this.lockTimer = setTimeout(tryStart, this.yoklama.kilit);
        return;
      }
      if (this.lock) {
        this.lock.onLost = () => {
          this.log.info("[köprü] kilit başka sürece geçti; izleyici moduna dönülüyor");
          this.stopLoops();
          tryStart();
        };
      }
      this.mode = "etkin";
      this.startLoops();
    };
    tryStart();
  }

  startLoops() {
    const loop = async (full = false, reason = "zamanlayici") => {
      if (this.stopped || this.mode !== "etkin") return;
      clearTimeout(this.timer);
      this.nextAt = null;
      try { await this.runOnce({ full, reason }); } catch { /* durumda */ }
      if (!this.stopped && this.mode === "etkin") {
        this.timer = setTimeout(() => loop(), this.intervalMin * 60000);
        this.nextAt = new Date(Date.now() + this.intervalMin * 60000).toISOString();
        this.persist(true);
      }
    };
    this.loop = loop;
    loop(false, "baslangic");
    const ping = async () => {
      if (this.stopped || this.mode !== "etkin") return;
      try {
        const p = await this.cloud().ping();
        if (p && p.aralikDk && p.aralikDk !== this.intervalMin) this.intervalMin = p.aralikDk;
        this.setStatus({ baglanti: "tamam", sonPing: new Date().toISOString() });
        if (p && (p.simdiEsitle || p.tamEsitleme) && !this.running) loop(!!p.tamEsitleme, p.tamEsitleme ? "tam-esitleme" : "kullanici-istegi");
      } catch (e) {
        this.setStatus({ baglanti: "yok", sonPingHata: humanError(e) });
      }
      if (!this.stopped && this.mode === "etkin") this.pingTimer = setTimeout(ping, this.yoklama.ping);
    };
    this.pingTimer = setTimeout(ping, this.yoklama.ping);
    // İzleyici süreçlerin "Şimdi eşitle" isteği (kopru-istek.json)
    const local = () => {
      if (this.stopped || this.mode !== "etkin") return;
      const req = this.config.takeRequest();
      if (req && !this.running) loop(!!req.tam, "elle");
      this.localTimer = setTimeout(local, this.yoklama.yerel);
    };
    this.localTimer = setTimeout(local, this.yoklama.yerel);
  }

  // Etkin süreçte hemen eşitle; izleyicide isteği dosyaya bırak (etkin süreç ≤ 10 sn'de alır)
  syncNow(full = false) {
    if (this.mode === "etkin") { if (this.loop && !this.running) this.loop(full, "elle"); return "basladi"; }
    this.config.request({ tam: !!full });
    return "istendi";
  }

  stopLoops() {
    clearTimeout(this.timer);
    clearTimeout(this.pingTimer);
    clearTimeout(this.localTimer);
    this.nextAt = null;
    this.mode = "durdu";
  }

  stop() {
    this.stopped = true;
    this.stopLoops();
    clearTimeout(this.lockTimer);
    if (this.lock) this.lock.release();
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
