// TCMB döviz kurları (today.xml). Saatlik yenilenir, son başarılı değer diske yazılır.
// Kurlar yalnız döviz kasa/hesaplarının TL karşılığını göstermek için kullanılır.

const fs = require("fs");
const path = require("path");
const log = require("./log");

const URL = "https://www.tcmb.gov.tr/kurlar/today.xml";

function parseTcmb(xml) {
  const out = {};
  const re = /<Currency[^>]*CurrencyCode="([A-Z]{3})"[^>]*>([\s\S]*?)<\/Currency>/g;
  let m;
  while ((m = re.exec(xml))) {
    const body = m[2];
    const unit = Number((/<Unit>(\d+)<\/Unit>/.exec(body) || [])[1] || 1);
    const sell = (/<ForexSelling>([\d.]+)<\/ForexSelling>/.exec(body) || [])[1];
    if (sell && Number(sell) > 0) out[m[1]] = Number(sell) / unit;
  }
  const date = (/Tarih="([\d.]+)"/.exec(xml) || [])[1] || null;
  return { kurlar: out, tarih: date };
}

class FxService {
  constructor(dataDir, { enabled = true } = {}) {
    this.file = path.join(dataDir, "kurlar.json");
    this.enabled = enabled;
    this.state = { kurlar: null, tarih: null, alindi: null };
    try { this.state = JSON.parse(fs.readFileSync(this.file, "utf8")); } catch { /* ilk çalıştırma */ }
  }

  current() { return this.state.kurlar ? this.state : null; }

  async refresh() {
    if (!this.enabled) return;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(URL, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parseTcmb(await res.text());
      if (!Object.keys(parsed.kurlar).length) throw new Error("kur bulunamadı");
      this.state = { ...parsed, alindi: new Date().toISOString() };
      fs.writeFileSync(this.file, JSON.stringify(this.state));
      log.info("TCMB kurları güncellendi", { tarih: parsed.tarih, adet: Object.keys(parsed.kurlar).length });
    } catch (err) {
      log.warn("TCMB kurları alınamadı", { hata: err.message });
    }
  }

  start() {
    if (!this.enabled) return;
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 60 * 60000);
    this.timer.unref();
  }
  stop() { if (this.timer) clearInterval(this.timer); }
}

module.exports = { FxService, parseTcmb };
