// Ölçü × boyut × dönem sorgu çalıştırıcı (kiracı SQLite'ı üzerinde).

const { SOURCES, MEASURES, DIMENSIONS } = require("./model");
const P = require("./period");

function err(msg, status = 400) { return Object.assign(new Error(msg), { status }); }

function measure(id) {
  const m = MEASURES[id];
  if (!m) throw err(`Bilinmeyen ölçü: ${id}`);
  return m;
}

function baseParts(ctx, m) {
  const src = SOURCES[m.src];
  const a = src.alias;
  const where = [src.where(ctx)];
  if (m.filter) where.push(m.filter(ctx));
  return { src, a, from: src.from(ctx), where };
}

function selectValue(ctx, m) {
  const parts = [`${m.n(ctx)} AS n`];
  if (m.d) parts.push(`${m.d(ctx)} AS d`);
  return parts.join(", ");
}

function valueOf(m, row) {
  if (!row) return m.d ? null : 0;
  const n = Number(row.n) || 0;
  if (m.d) return m.calc(n, Number(row.d) || 0);
  return m.calc ? m.calc(n) : n;
}

function labelMap(ctx, map, key) {
  if (map === "firma") return ctx.firmaAd(key);
  if (map === "gun") return P.GUNLER[Number(key)] ?? String(key);
  if (map === "ay") return P.AYLAR_UZUN[Number(key) - 1] ?? String(key);
  if (map === "saat") return key === null || key === undefined ? "(Saatsiz)" : `${String(key).padStart(2, "0")}:00`;
  return key;
}

// ─── Toplam ───────────────────────────────────────────────────────────────
function total(ctx, mid, { bas, bit }) {
  const m = measure(mid);
  if (m.combo) {
    let v = 0;
    for (const [id, w] of m.combo) v += w * (total(ctx, id, { bas, bit }) || 0);
    return v;
  }
  return ctx.cached(`t:${mid}:${bas}:${bit}`, () => {
    const b = baseParts(ctx, m);
    const sql = `SELECT ${selectValue(ctx, m)} FROM ${b.from} WHERE ${b.where.join(" AND ")} AND ${b.a}.tarih BETWEEN ? AND ?`;
    return valueOf(m, ctx.db.get(sql, bas, bit));
  });
}

// ─── Zaman serisi ─────────────────────────────────────────────────────────
function series(ctx, mid, { bas, bit, gran }) {
  const m = measure(mid);
  const keys = P.enumerateBuckets(gran, bas, bit);
  if (m.combo) {
    const acc = new Map(keys.map((k) => [k, 0]));
    for (const [id, w] of m.combo) {
      for (const p of series(ctx, id, { bas, bit, gran })) acc.set(p.k, (acc.get(p.k) || 0) + w * (p.v || 0));
    }
    return keys.map((k) => ({ k, v: acc.get(k) }));
  }
  return ctx.cached(`s:${mid}:${bas}:${bit}:${gran}`, () => {
    const b = baseParts(ctx, m);
    const bk = P.bucketSql(gran, `${b.a}.tarih`);
    const sql = `SELECT ${bk} AS k, ${selectValue(ctx, m)} FROM ${b.from}
      WHERE ${b.where.join(" AND ")} AND ${b.a}.tarih BETWEEN ? AND ? GROUP BY k`;
    const rows = new Map(ctx.db.all(sql, bas, bit).map((r) => [r.k, r]));
    return keys.map((k) => ({ k, v: rows.has(k) ? valueOf(m, rows.get(k)) : (m.d ? null : 0) }));
  });
}

// ─── Boyut kırılımı ───────────────────────────────────────────────────────
// sort: 'desc' | 'asc' | 'key'; limit: ilk N (kalanı "Diğer" olarak toplanır — yalnız toplanabilir ölçülerde)
function byDim(ctx, mid, did, { bas, bit, limit = 10, sort = "desc", diger = true }) {
  const m = measure(mid);
  const dim = DIMENSIONS[did];
  if (!dim) throw err(`Bilinmeyen boyut: ${did}`);
  if (m.combo) {
    const acc = new Map();
    for (const [id, w] of m.combo) {
      for (const r of byDim(ctx, id, did, { bas, bit, limit: 100000, sort: "key", diger: false }).satirlar) {
        const cur = acc.get(r.k) || { k: r.k, ad: r.ad, v: 0 };
        cur.v += w * (r.v || 0);
        acc.set(r.k, cur);
      }
    }
    return finishDim([...acc.values()], m, dim, { limit, sort, diger });
  }
  const ds = dim.src[m.src];
  if (!ds) throw err(`'${m.ad}' ölçüsü '${dim.ad}' kırılımını desteklemiyor.`);
  const rows = ctx.cached(`d:${mid}:${did}:${bas}:${bit}`, () => {
    const b = baseParts(ctx, m);
    const label = ds.label ? `, MAX(${ds.label}) AS ad` : "";
    const sql = `SELECT ${ds.key} AS k${label}, ${selectValue(ctx, m)} FROM ${b.from}
      WHERE ${b.where.join(" AND ")} AND ${b.a}.tarih BETWEEN ? AND ? GROUP BY k`;
    return ctx.db.all(sql, bas, bit).map((r) => ({
      k: r.k, ad: r.ad ?? labelMap(ctx, ds.map, r.k), v: valueOf(m, r), n: Number(r.n) || 0, d: r.d !== undefined ? Number(r.d) || 0 : undefined,
    }));
  });
  return finishDim(rows.map((r) => ({ ...r })), m, dim, { limit, sort, diger });
}

function finishDim(rows, m, dim, { limit, sort, diger }) {
  const additive = m.additive !== false && !m.d;
  const toplam = additive ? rows.reduce((s, r) => s + (r.v || 0), 0) : null;
  if (sort === "key" || dim.sirali) rows.sort((a, b) => (a.k > b.k ? 1 : a.k < b.k ? -1 : 0));
  else if (sort === "asc") rows.sort((a, b) => (a.v ?? Infinity) - (b.v ?? Infinity));
  else rows.sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity));
  let out = rows;
  let digerSatir = null;
  if (limit && rows.length > limit && !(dim.sirali && sort === "key")) {
    out = rows.slice(0, limit);
    if (diger && additive) {
      const rest = rows.slice(limit);
      digerSatir = { k: "__diger", ad: `Diğer (${rest.length})`, v: rest.reduce((s, r) => s + (r.v || 0), 0) };
    }
  }
  if (toplam) out.forEach((r) => { r.pay = r.v / toplam; });
  if (digerSatir && toplam) digerSatir.pay = digerSatir.v / toplam;
  return { satirlar: out, diger: digerSatir, toplam, adet: rows.length };
}

// ─── İki boyutlu matris (ısı haritası) ─────────────────────────────────────
// x: zaman kırılımı ('hafta' | 'ay' | 'yil') veya boyut; y: boyut
function matrix(ctx, mid, { bas, bit, x, y }) {
  const m = measure(mid);
  if (m.combo) throw err("Bu ölçü için ısı haritası yok.");
  const b = baseParts(ctx, m);
  const exprOf = (axis) => {
    if (P.GRANS[axis]) return { key: P.bucketSql(axis, `${b.a}.tarih`), gran: axis };
    const dim = DIMENSIONS[axis];
    if (!dim || !dim.src[m.src]) throw err(`Geçersiz eksen: ${axis}`);
    return { key: dim.src[m.src].key, map: dim.src[m.src].map, label: dim.src[m.src].label };
  };
  const ex = exprOf(x), ey = exprOf(y);
  const sql = `SELECT ${ex.key} AS x, ${ey.key} AS y, ${selectValue(ctx, m)} FROM ${b.from}
    WHERE ${b.where.join(" AND ")} AND ${b.a}.tarih BETWEEN ? AND ? GROUP BY x, y`;
  const rows = ctx.db.all(sql, bas, bit);
  const xs = ex.gran ? P.enumerateBuckets(ex.gran, bas, bit) : [...new Set(rows.map((r) => r.x))].sort((a, b2) => (a > b2 ? 1 : -1));
  const ys = [...new Set(rows.map((r) => r.y))].sort((a, b2) => (a > b2 ? 1 : -1));
  const xi = new Map(xs.map((k, i) => [k, i]));
  const yi = new Map(ys.map((k, i) => [k, i]));
  const hucreler = [];
  for (const r of rows) {
    if (!xi.has(r.x) || !yi.has(r.y)) continue;
    hucreler.push([xi.get(r.x), yi.get(r.y), valueOf(m, r)]);
  }
  return {
    x: xs.map((k) => ({ k, ad: ex.gran ? P.bucketLabel(ex.gran, k) : labelMap(ctx, ex.map, k) })),
    y: ys.map((k) => ({ k, ad: ey.gran ? P.bucketLabel(ey.gran, k) : labelMap(ctx, ey.map, k) })),
    hucreler,
  };
}

module.exports = { measure, total, series, byDim, matrix, valueOf, labelMap };
