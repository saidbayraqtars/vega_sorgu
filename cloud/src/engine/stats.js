// Saf istatistik yardımcıları (bağımlılıksız).

function sum(a) { let s = 0; for (const x of a) s += Number(x) || 0; return s; }
function mean(a) { return a.length ? sum(a) / a.length : null; }
function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function stdev(a) {
  if (a.length < 2) return null;
  const m = mean(a);
  return Math.sqrt(a.reduce((acc, x) => acc + (x - m) ** 2, 0) / (a.length - 1));
}
// Değişkenlik katsayısı (CV): std / ortalama
function cv(a) {
  const m = mean(a);
  const s = stdev(a);
  return m && s !== null && m > 0 ? s / m : null;
}
function quantile(a, q) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

// Büyüme oranı: (yeni / eski) − 1. Taban sıfıra yakınsa null (anlamsız).
function growth(cur, prev, { minBase = 1 } = {}) {
  cur = Number(cur); prev = Number(prev);
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  if (Math.abs(prev) < minBase) return null;
  if (prev < 0) return (cur - prev) / Math.abs(prev); // negatif tabanda işaret korunur
  return cur / prev - 1;
}

// Theil–Sen eğimi: aykırı değerlere dayanıklı doğrusal eğilim (y ~ a + b·x)
function theilSen(xs, ys) {
  const slopes = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      if (xs[j] !== xs[i]) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
    }
  }
  if (!slopes.length) return null;
  const b = median(slopes);
  const a = median(xs.map((x, i) => ys[i] - b * x));
  return { a, b };
}

// Aylık seriden yıllıklandırılmış eğilim büyümesi: log(y) üzerinde Theil–Sen.
// Sıfır/negatif aylar atlanır. En az 6 pozitif ay gerekir.
function annualizedTrend(values) {
  const xs = [], ys = [];
  values.forEach((v, i) => { if (Number(v) > 0) { xs.push(i); ys.push(Math.log(v)); } });
  if (xs.length < 6) return null;
  const fit = theilSen(xs, ys);
  if (!fit) return null;
  return Math.exp(12 * fit.b) - 1;
}

// Holt-Winters (toplamsal mevsimsellik, periyot m). En az 2 tam sezon gerekir.
function holtWinters(series, m = 12, horizon = 3, { alpha = 0.35, beta = 0.1, gamma = 0.3 } = {}) {
  const n = series.length;
  if (n < 2 * m) return null;
  const s0 = mean(series.slice(0, m));
  const s1 = mean(series.slice(m, 2 * m));
  let level = s0;
  let trend = (s1 - s0) / m;
  const season = series.slice(0, m).map((v) => v - s0);
  const fitted = [];
  for (let t = 0; t < n; t++) {
    const si = season[t % m];
    const y = series[t];
    fitted.push(level + trend + si);
    const prevLevel = level;
    level = alpha * (y - si) + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
    season[t % m] = gamma * (y - level) + (1 - gamma) * si;
  }
  const resid = series.map((y, i) => y - fitted[i]).slice(m);
  const sd = stdev(resid) || 0;
  const out = [];
  for (let h = 1; h <= horizon; h++) {
    const v = level + h * trend + season[(n + h - 1) % m];
    out.push({ deger: v, alt: v - 1.28 * sd * Math.sqrt(h), ust: v + 1.28 * sd * Math.sqrt(h) });
  }
  return out;
}

// Holt doğrusal eğilim (mevsimsiz) — kısa geçmiş için
function holtLinear(series, horizon = 3, { alpha = 0.5, beta = 0.2 } = {}) {
  const n = series.length;
  if (n < 4) return null;
  let level = series[0];
  let trend = series[1] - series[0];
  const fitted = [];
  for (let t = 1; t < n; t++) {
    fitted.push(level + trend);
    const prev = level;
    level = alpha * series[t] + (1 - alpha) * (level + trend);
    trend = beta * (level - prev) + (1 - beta) * trend;
  }
  const resid = series.slice(1).map((y, i) => y - fitted[i]);
  const sd = stdev(resid) || 0;
  const out = [];
  for (let h = 1; h <= horizon; h++) {
    const v = level + h * trend;
    out.push({ deger: v, alt: v - 1.28 * sd * Math.sqrt(h), ust: v + 1.28 * sd * Math.sqrt(h) });
  }
  return out;
}

// Parçalı doğrusal puanlama: anchors = [[x0, s0], [x1, s1], ...] (x artan).
function scorePiecewise(x, anchors) {
  if (x === null || x === undefined || !Number.isFinite(Number(x))) return null;
  x = Number(x);
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    const [x0, s0] = anchors[i - 1];
    const [x1, s1] = anchors[i];
    if (x <= x1) return s0 + ((x - x0) / (x1 - x0)) * (s1 - s0);
  }
  return anchors[anchors.length - 1][1];
}

// Yoğunlaşma: ilk k payı ve Herfindahl-Hirschman endeksi (0-10000)
function concentration(values, k = 5) {
  const v = values.filter((x) => x > 0).sort((a, b) => b - a);
  const tot = sum(v);
  if (!tot) return { topShare: null, hhi: null, n: 0 };
  const top = sum(v.slice(0, k)) / tot;
  const hhi = v.reduce((acc, x) => acc + ((x / tot) * 100) ** 2, 0);
  return { topShare: top, hhi, n: v.length };
}

function zscore(x, arr) {
  const m = mean(arr), s = stdev(arr);
  if (m === null || !s) return null;
  return (x - m) / s;
}

function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
function round(x, d = 2) {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  const f = 10 ** d;
  return Math.round(x * f) / f;
}

module.exports = {
  sum, mean, median, stdev, cv, quantile, growth, theilSen, annualizedTrend, holtWinters, holtLinear,
  scorePiecewise, concentration, zscore, clamp, round,
};
