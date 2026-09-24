// ═══════════════════════════════════════════════════════════════════════════
//  Bakiye serileri — dönemleri TOPLAMADAN (Kılavuz §5 kural 12, §24.6).
//
//  Vega her dönemin (yılın) başına açılış devrini normal hareket olarak yazar.
//  Bu yüzden D tarihindeki bakiye = D'yi "kapsayan" TEK dönemin, tarihi ≤ D olan
//  satırlarının toplamıdır. Kapsama: dönem Y, kendi ilk satır tarihinden
//  (devir, genelde (Y-1)-12-31) başlar ve bir sonraki dönem başlayana kadar sürer.
//  Başlangıç [(Y-1)-12-25, Y-01-10] aralığına sıkıştırılır (tek tük hatalı tarihler
//  kapsamı bozmasın). Yeni yıl dönemi hiç açılmamışsa önceki dönem devam eder.
// ═══════════════════════════════════════════════════════════════════════════

const P = require("./period");

function clampStart(minDate, yil) {
  if (!yil) return minDate;
  const lo = `${Number(yil) - 1}-12-25`;
  const hi = `${Number(yil)}-01-10`;
  if (!minDate) return hi;
  return minDate < lo ? lo : minDate > hi ? hi : minDate;
}

// rows: [{donem, tarih, key, v}] tek firma için. sampleDates: artan tarih listesi.
// Dönüş: Map(tarih → {net, pos, neg}) — pos/neg: anahtar bazında pozitif/negatif bakiyeler toplamı.
function sweep(rows, yilOf, sampleDates) {
  const byDonem = new Map();
  for (const r of rows) {
    if (!byDonem.has(r.donem)) byDonem.set(r.donem, []);
    byDonem.get(r.donem).push({ ...r, tarih: r.tarih || "0000-00-00" }); // tarihsiz satır en başa
  }
  const donems = [...byDonem.entries()].map(([donem, list]) => {
    list.sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : 0));
    const minD = list.find((r) => r.tarih !== "0000-00-00")?.tarih || null;
    return { donem, yil: yilOf(donem), list, start: clampStart(minD, yilOf(donem)) };
  }).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : (a.yil || 0) - (b.yil || 0)));

  const out = new Map();
  for (const t of sampleDates) out.set(t, { net: 0, pos: 0, neg: 0 });
  if (!donems.length) return out;

  for (let i = 0; i < donems.length; i++) {
    const d = donems[i];
    const end = i + 1 < donems.length ? donems[i + 1].start : "9999-12-31"; // hariç
    const bal = new Map();
    let pos = 0, neg = 0, net = 0, j = 0;
    const list = d.list;
    for (const t of sampleDates) {
      if (t < d.start || t >= end) continue;
      while (j < list.length && list[j].tarih <= t) {
        const r = list[j++];
        const k = r.key ?? "_";
        const b0 = bal.get(k) || 0;
        const b1 = b0 + (Number(r.v) || 0);
        bal.set(k, b1);
        pos += Math.max(b1, 0) - Math.max(b0, 0);
        neg += Math.min(b1, 0) - Math.min(b0, 0);
        net += b1 - b0;
      }
      out.set(t, { net, pos, neg });
    }
  }
  return out;
}

// Seçili firmalar için bakiye serisi. fetch(firma) → satırlar.
function multiFirmaSeries(ctx, fetch, sampleDates) {
  const acc = new Map(sampleDates.map((t) => [t, { net: 0, pos: 0, neg: 0 }]));
  for (const firma of ctx.firmalar) {
    const yil = new Map(ctx.donemler(firma).map((d) => [d.donem, Number(d.yil)]));
    const res = sweep(fetch(firma), (dn) => yil.get(dn), sampleDates);
    for (const [t, v] of res) {
      const a = acc.get(t);
      a.net += v.net; a.pos += v.pos; a.neg += v.neg;
    }
  }
  return acc;
}

// ─── Kaynak sorguları (günlük toplulaştırılmış) ───────────────────────────
function kasaRows(ctx, firma) {
  return ctx.cached(`bk:kasa:${firma}`, () => ctx.db.all(`
    SELECT donem, tarih, NULL AS key, SUM((IFNULL(gelir,0) - IFNULL(gider,0)) / IFNULL(NULLIF(kur,0),1)) AS v
    FROM kasa_hareket WHERE firma = ? AND islemtipi = 1 AND IFNULL(kredikasa,0) = 0 AND dv IS NULL
    GROUP BY donem, tarih`, firma));
}

function bankaRows(ctx, firma) {
  return ctx.cached(`bk:banka:${firma}`, () => ctx.db.all(`
    SELECT b.donem, b.tarih, b.banka_id AS key, SUM((IFNULL(b.borc,0) - IFNULL(b.alacak,0)) / IFNULL(NULLIF(b.kur,0),1)) AS v
    FROM banka_hareket b JOIN banka ba ON ba.firma = b.firma AND ba.id = b.banka_id
    WHERE b.firma = ? AND IFNULL(ba.musbanka,0) = 0 AND IFNULL(ba.status,1) <> 2 AND ba.dv IS NULL
    GROUP BY b.donem, b.tarih, b.banka_id`, firma));
}

function cariRows(ctx, firma) {
  return ctx.cached(`bk:cari:${firma}`, () => ctx.db.all(`
    SELECT h.donem, h.tarih, h.cari_id AS key, SUM(IFNULL(h.borc,0) - IFNULL(h.alacak,0)) AS v
    FROM cari_hareket h LEFT JOIN cari c ON c.firma = h.firma AND c.id = h.cari_id
    WHERE h.firma = ? AND IFNULL(h.ozelkod,'') <> 'KREDIHESABI' AND NOT ${ctx.personel("c")}
    GROUP BY h.donem, h.tarih, h.cari_id`, firma));
}

const KINDS = { kasa: kasaRows, banka: bankaRows, cari: cariRows };

// kind: kasa | banka | cari ; sampleDates artan
function balanceAt(ctx, kind, sampleDates) {
  const fetch = KINDS[kind];
  if (!fetch) throw new Error(kind);
  return multiFirmaSeries(ctx, (f) => fetch(ctx, f), sampleDates);
}

// Zaman kovaları için bakiye serisi (kova sonu örneklenir, bugünü geçmez)
function balanceSeries(ctx, kind, { bas, bit, gran }) {
  const keys = P.enumerateBuckets(gran, bas, bit);
  const samples = keys.map((k) => P.minDate(P.bucketEnd(gran, k), ctx.today));
  const uniq = [...new Set(samples)].sort();
  const res = balanceAt(ctx, kind, uniq);
  return keys.map((k, i) => ({ k, ...res.get(samples[i]) }));
}

// ─── Anlık (aktif dönem, tüm satırlar — Arctos ekranlarıyla birebir) ──────
function currentKasa(ctx) {
  return ctx.cached("cur:kasa", () => {
    const out = { tl: 0, kasalar: [], doviz: {} };
    for (const firma of ctx.firmalar) {
      const donem = ctx.activeDonem(firma);
      if (!donem) continue;
      const rows = ctx.db.all(`
        SELECT COALESCE(NULLIF(TRIM(kasa),''),'(Tanımsız)') AS kasa, dv,
               SUM((IFNULL(gelir,0) - IFNULL(gider,0)) / IFNULL(NULLIF(kur,0),1)) AS net, COUNT(*) AS n, MAX(tarih) AS son
        FROM kasa_hareket WHERE firma = ? AND donem = ? AND islemtipi = 1 AND IFNULL(kredikasa,0) = 0
        GROUP BY COALESCE(NULLIF(TRIM(kasa),''),'(Tanımsız)'), dv`, firma, donem);
      for (const r of rows) {
        out.kasalar.push({ firma, kasa: r.kasa, doviz: r.dv || null, bakiye: r.net, hareket: r.n, son: r.son });
        if (r.dv) out.doviz[r.dv] = (out.doviz[r.dv] || 0) + r.net;
        else out.tl += r.net;
      }
    }
    out.kasalar.sort((a, b) => Math.abs(b.bakiye) - Math.abs(a.bakiye));
    return out;
  });
}

function currentBanka(ctx) {
  return ctx.cached("cur:banka", () => {
    const out = { tl: 0, varlik: 0, kredi: 0, hesaplar: [], doviz: {} };
    for (const firma of ctx.firmalar) {
      const donem = ctx.activeDonem(firma);
      if (!donem) continue;
      const rows = ctx.db.all(`
        SELECT ba.id, ba.ad, ba.sube, ba.dv, SUM((IFNULL(b.borc,0) - IFNULL(b.alacak,0)) / IFNULL(NULLIF(b.kur,0),1)) AS bakiye,
               COUNT(*) AS n, MAX(b.tarih) AS son
        FROM banka ba JOIN banka_hareket b ON b.firma = ba.firma AND b.banka_id = ba.id AND b.donem = ?
        WHERE ba.firma = ? AND IFNULL(ba.musbanka,0) = 0 AND IFNULL(ba.status,1) <> 2
        GROUP BY ba.id, ba.ad, ba.sube, ba.dv HAVING COUNT(*) > 0`, donem, firma);
      for (const r of rows) {
        out.hesaplar.push({ firma, id: r.id, ad: r.ad, sube: r.sube, doviz: r.dv || null, bakiye: r.bakiye, hareket: r.n, son: r.son });
        if (r.dv) { out.doviz[r.dv] = (out.doviz[r.dv] || 0) + r.bakiye; continue; }
        out.tl += r.bakiye;
        if (r.bakiye > 0) out.varlik += r.bakiye; else out.kredi += r.bakiye;
      }
    }
    out.hesaplar.sort((a, b) => Math.abs(b.bakiye) - Math.abs(a.bakiye));
    return out;
  });
}

// Müşteri bazında güncel bakiye (aktif dönem)
function currentCari(ctx) {
  return ctx.cached("cur:cari", () => {
    const list = [];
    for (const firma of ctx.firmalar) {
      const donem = ctx.activeDonem(firma);
      if (!donem) continue;
      const rows = ctx.db.all(`
        SELECT h.cari_id AS id, MAX(c.ad) AS ad, MAX(c.kod) AS kod, MAX(c.il) AS il, MAX(c.tip) AS tip,
               MAX(c.kredi_limit) AS limit_, MAX(c.risk_limit) AS risk, MAX(c.vade_gun) AS vade_gun,
               SUM(IFNULL(h.borc,0) - IFNULL(h.alacak,0)) AS bakiye, MAX(CASE WHEN h.izahat NOT IN (${ctx.iz("DEVIR")}) THEN h.tarih END) AS son
        FROM cari_hareket h LEFT JOIN cari c ON c.firma = h.firma AND c.id = h.cari_id
        WHERE h.firma = ? AND h.donem = ? AND IFNULL(h.ozelkod,'') <> 'KREDIHESABI' AND NOT ${ctx.personel("c")}
        GROUP BY h.cari_id HAVING ABS(SUM(IFNULL(h.borc,0) - IFNULL(h.alacak,0))) > 0.009`, firma, donem);
      for (const r of rows) {
        list.push({ firma, id: r.id, ad: r.ad || `#${r.id}`, kod: r.kod, il: r.il, tip: r.tip, bakiye: r.bakiye,
          kredi_limit: r.limit_, risk_limit: r.risk, vade_gun: r.vade_gun, son: r.son });
      }
    }
    const alacak = list.filter((r) => r.bakiye > 0).reduce((s, r) => s + r.bakiye, 0);
    const borc = -list.filter((r) => r.bakiye < 0).reduce((s, r) => s + r.bakiye, 0);
    return { list, alacak, borc, net: alacak - borc };
  });
}

// ─── Alacak yaşlandırma (FIFO): açık bakiye en yeni borçlandırmalara dağıtılır ─
// Vade = ODEMETARIHI (yoksa tarih + kart vade günü). Bucket: gelmemiş / 1-30 / 31-60 / 61-90 / 90+
function receivableAging(ctx) {
  return ctx.cached("aging", () => {
    const today = ctx.today;
    const buckets = { gelmemis: 0, g0_30: 0, g31_60: 0, g61_90: 0, g90: 0 };
    const perCari = [];
    const { list } = currentCari(ctx);
    const pos = list.filter((c) => c.bakiye > 0.009);
    const byFirma = new Map();
    for (const c of pos) {
      if (!byFirma.has(c.firma)) byFirma.set(c.firma, []);
      byFirma.get(c.firma).push(c);
    }
    for (const [firma, custs] of byFirma) {
      const donem = ctx.activeDonem(firma);
      const ids = new Set(custs.map((c) => c.id));
      const rows = ctx.db.all(`
        SELECT cari_id, tarih, vade, borc - alacak AS v FROM cari_hareket
        WHERE firma = ? AND donem = ? AND IFNULL(ozelkod,'') <> 'KREDIHESABI' AND borc > alacak
        ORDER BY cari_id, tarih DESC, id DESC`, firma, donem);
      const debits = new Map();
      for (const r of rows) {
        if (!ids.has(r.cari_id)) continue;
        if (!debits.has(r.cari_id)) debits.set(r.cari_id, []);
        debits.get(r.cari_id).push(r);
      }
      for (const c of custs) {
        let remaining = c.bakiye;
        const b = { gelmemis: 0, g0_30: 0, g31_60: 0, g61_90: 0, g90: 0 };
        let enEskiGecikme = 0;
        for (const d of debits.get(c.id) || []) {
          if (remaining <= 0.009) break;
          const part = Math.min(remaining, d.v);
          remaining -= part;
          const due = d.vade && d.vade >= d.tarih ? d.vade : P.addDays(d.tarih || today, Number(c.vade_gun) || 0);
          const late = P.diffDays(due, today);
          const key = late <= 0 ? "gelmemis" : late <= 30 ? "g0_30" : late <= 60 ? "g31_60" : late <= 90 ? "g61_90" : "g90";
          b[key] += part;
          if (late > enEskiGecikme) enEskiGecikme = late;
        }
        if (remaining > 0.009) { b.g90 += remaining; enEskiGecikme = Math.max(enEskiGecikme, 91); } // eşleşmeyen = çok eski/devir
        for (const k of Object.keys(b)) buckets[k] += b[k];
        perCari.push({ ...c, ...b, gecikme: enEskiGecikme, vadesiGecen: b.g0_30 + b.g31_60 + b.g61_90 + b.g90 });
      }
    }
    const toplam = Object.values(buckets).reduce((s, v) => s + v, 0);
    return { buckets, toplam, vadesiGecen: toplam - buckets.gelmemis, cariler: perCari.sort((a, b) => b.vadesiGecen - a.vadesiGecen) };
  });
}

module.exports = { sweep, clampStart, balanceAt, balanceSeries, currentKasa, currentBanka, currentCari, receivableAging };
