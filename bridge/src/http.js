// Buluta HTTPS istekleri (gzip gövde, Bearer anahtar, zaman aşımı, yeniden deneme).

const zlib = require("zlib");

class CloudError extends Error {
  constructor(message, status, retryable) { super(message); this.status = status; this.retryable = retryable; }
}

class Cloud {
  constructor({ url, anahtar }, { agent = {}, timeoutMs = 120000, fetchImpl = globalThis.fetch } = {}) {
    if (!url) throw new Error("Bulut adresi girilmemiş.");
    if (!anahtar) throw new Error("Köprü anahtarı girilmemiş.");
    this.base = url.replace(/\/+$/, "") + "/api/kopru/v1";
    this.key = anahtar;
    this.agent = agent;
    this.timeoutMs = timeoutMs;
    this.fetch = fetchImpl;
  }

  async request(method, path, body, { gzip = false, retries = 3 } = {}) {
    let attempt = 0;
    for (;;) {
      attempt++;
      try {
        return await this.once(method, path, body, gzip);
      } catch (err) {
        if (!err.retryable || attempt > retries) throw err;
        await new Promise((r) => setTimeout(r, Math.min(30000, 1000 * 2 ** attempt)));
      }
    }
  }

  async once(method, path, body, gzip) {
    const headers = { Authorization: `Bearer ${this.key}`, "User-Agent": `VegaKopru/${this.agent.surum || "?"}` };
    let payload;
    if (body !== undefined) {
      const json = Buffer.from(JSON.stringify(body));
      headers["Content-Type"] = "application/json";
      if (gzip && json.length > 1024) { payload = zlib.gzipSync(json, { level: 6 }); headers["Content-Encoding"] = "gzip"; }
      else payload = json;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    let res;
    try {
      res = await this.fetch(this.base + path, { method, headers, body: payload, signal: ctrl.signal });
    } catch (e) {
      throw new CloudError(`Sunucuya ulaşılamadı: ${e.cause ? e.cause.code || e.cause.message : e.message}`, 0, true);
    } finally {
      clearTimeout(timer);
    }
    let data = null;
    const text = await res.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) {
      const msg = (data && data.hata) || `HTTP ${res.status}`;
      throw new CloudError(msg, res.status, res.status >= 500 || res.status === 429);
    }
    return { data, bytes: payload ? payload.length : 0 };
  }

  hello(ajan) { return this.request("POST", "/hello", { ajan }).then((r) => r.data); }
  ping() { return this.request("GET", "/ping", undefined, { retries: 0 }).then((r) => r.data); }
  manifest(body) { return this.request("POST", "/manifest", body, { gzip: true }).then((r) => r.data); }
  chunk(body) { return this.request("POST", "/chunk", body, { gzip: true }); }
  commit(body) { return this.request("POST", "/commit", body).then((r) => r.data); }
  event(seviye, mesaj, syncId) { return this.request("POST", "/olay", { seviye, mesaj, syncId }, { retries: 0 }).then((r) => r.data).catch(() => null); }
}

module.exports = { Cloud, CloudError };
