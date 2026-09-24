// Demo verisini bir kiracı deposuna köprü protokolüyle aynı yoldan (manifest → chunk → commit) yükler.

const crypto = require("crypto");
const { generateRaw } = require("./generator");
const { rawToCanonical } = require("./canonical");
const { scopeKey, parseChunkKey } = require("../../../shared/datasets");

function fingerprint(rows) {
  const h = crypto.createHash("sha1");
  for (const r of rows) h.update(JSON.stringify(r));
  return h.digest("hex").slice(0, 16);
}

function loadCanonical(store, chunks, { syncId = `demo-${Date.now()}` } = {}) {
  const manifest = chunks.map((c) => ({ key: c.key, n: c.rows.length, ck: fingerprint(c.rows), sm: 0 }));
  const scopes = [...new Set(chunks.map((c) => { const p = parseChunkKey(c.key); return scopeKey(p.ds, p.firma, p.donem); }))];
  const { need } = store.diffManifest(syncId, manifest, scopes);
  const needSet = new Set(need);
  let rows = 0;
  for (const c of chunks) {
    if (!needSet.has(c.key)) continue;
    const m = manifest.find((x) => x.key === c.key);
    // Büyük parçaları köprü gibi bölerek gönder (staging yolunu da sınar)
    const size = 20000;
    for (let i = 0, seq = 0; i < Math.max(c.rows.length, 1); i += size, seq++) {
      const part = c.rows.slice(i, i + size);
      const last = i + size >= c.rows.length;
      store.receiveChunk({ syncId, key: c.key, n: m.n, ck: m.ck, sm: m.sm, cols: c.cols, rows: part, seq, last });
    }
    rows += c.rows.length;
  }
  const res = store.commit(syncId);
  return { chunks: chunks.length, sent: need.length, rows, ...res };
}

function loadDemo(store, opts = {}) {
  const raw = generateRaw(opts);
  const chunks = rawToCanonical(raw);
  return loadCanonical(store, chunks, opts);
}

module.exports = { loadDemo, loadCanonical, fingerprint };
