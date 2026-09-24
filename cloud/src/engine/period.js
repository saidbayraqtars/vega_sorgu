// Dönem / tarih yardımcıları. Tüm tarihler 'YYYY-MM-DD' metni (Türkiye saati).
// Arctos tarihleri yerel saattir; köprü de CONVERT(char(10), TARIH, 120) ile
// saat dilimi dönüşümü olmadan gönderir.

const TZ = "Europe/Istanbul";
const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const AYLAR_UZUN = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const GUNLER = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function todayTR(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return p; // en-CA → YYYY-MM-DD
}

function parse(d) {
  const [y, m, dd] = String(d).split("-").map(Number);
  return { y, m, d: dd };
}
function fmt(y, m, d) {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function toUTC(d) { const p = parse(d); return Date.UTC(p.y, p.m - 1, p.d); }
function fromUTC(ms) { const x = new Date(ms); return fmt(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate()); }
function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

function addDays(d, n) { return fromUTC(toUTC(d) + n * 86400000); }
function diffDays(a, b) { return Math.round((toUTC(b) - toUTC(a)) / 86400000); } // b - a
function addMonths(d, n) {
  const p = parse(d);
  let m = p.m - 1 + n;
  const y = p.y + Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return fmt(y, m + 1, Math.min(p.d, daysInMonth(y, m + 1)));
}
function addYears(d, n) { return addMonths(d, 12 * n); }
function startOfMonth(d) { const p = parse(d); return fmt(p.y, p.m, 1); }
function endOfMonth(d) { const p = parse(d); return fmt(p.y, p.m, daysInMonth(p.y, p.m)); }
function startOfYear(d) { return `${d.slice(0, 4)}-01-01`; }
function endOfYear(d) { return `${d.slice(0, 4)}-12-31`; }
function weekday(d) { return (new Date(toUTC(d)).getUTCDay() + 6) % 7; } // 0=Pzt … 6=Paz
function startOfWeek(d) { return addDays(d, -weekday(d)); }
function quarter(d) { return Math.floor((parse(d).m - 1) / 3) + 1; }
function startOfQuarter(d) { const p = parse(d); return fmt(p.y, (quarter(d) - 1) * 3 + 1, 1); }
function endOfQuarter(d) { return endOfMonth(addMonths(startOfQuarter(d), 2)); }
function minDate(a, b) { return a <= b ? a : b; }
function maxDate(a, b) { return a >= b ? a : b; }
function isDate(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUTC(s)); }

// ─── Hazır dönemler ────────────────────────────────────────────────────────
const PRESETS = {
  bugun: { ad: "Bugün", ikon: "Sun" },
  dun: { ad: "Dün", ikon: "Sunset" },
  bu_hafta: { ad: "Bu hafta", ikon: "CalendarDays" },
  gecen_hafta: { ad: "Geçen hafta", ikon: "CalendarMinus" },
  bu_ay: { ad: "Bu ay", ikon: "Calendar" },
  gecen_ay: { ad: "Geçen ay", ikon: "CalendarMinus2" },
  son30: { ad: "Son 30 gün", ikon: "CalendarRange" },
  son90: { ad: "Son 90 gün", ikon: "CalendarRange" },
  bu_ceyrek: { ad: "Bu çeyrek", ikon: "CalendarClock" },
  bu_yil: { ad: "Bu yıl", ikon: "CalendarCheck" },
  gecen_yil: { ad: "Geçen yıl", ikon: "History" },
  son12: { ad: "Son 12 ay", ikon: "Repeat" },
  tumu: { ad: "Tüm zamanlar", ikon: "Infinity" },
};

function resolvePeriod(preset = "bu_ay", { bas, bit, today = todayTR(), ilkTarih } = {}) {
  const t = today;
  let r;
  switch (preset) {
    case "bugun": r = [t, t]; break;
    case "dun": r = [addDays(t, -1), addDays(t, -1)]; break;
    case "bu_hafta": r = [startOfWeek(t), t]; break;
    case "gecen_hafta": { const s = addDays(startOfWeek(t), -7); r = [s, addDays(s, 6)]; break; }
    case "bu_ay": r = [startOfMonth(t), t]; break;
    case "gecen_ay": { const s = startOfMonth(addMonths(t, -1)); r = [s, endOfMonth(s)]; break; }
    case "son30": r = [addDays(t, -29), t]; break;
    case "son90": r = [addDays(t, -89), t]; break;
    case "bu_ceyrek": r = [startOfQuarter(t), t]; break;
    case "bu_yil": r = [startOfYear(t), t]; break;
    case "gecen_yil": { const y = Number(t.slice(0, 4)) - 1; r = [`${y}-01-01`, `${y}-12-31`]; break; }
    case "son12": r = [addDays(addYears(t, -1), 1), t]; break;
    case "tumu": r = [ilkTarih && isDate(ilkTarih) ? ilkTarih : addYears(startOfYear(t), -5), t]; break;
    case "ozel": {
      if (!isDate(bas) || !isDate(bit)) throw Object.assign(new Error("Özel dönem için bas ve bit (YYYY-AA-GG) gerekli."), { status: 400 });
      r = bas <= bit ? [bas, bit] : [bit, bas];
      if (diffDays(r[0], r[1]) > 366 * 15) throw Object.assign(new Error("Dönem en fazla 15 yıl olabilir."), { status: 400 });
      break;
    }
    default:
      throw Object.assign(new Error(`Bilinmeyen dönem: ${preset}`), { status: 400 });
  }
  return { kod: preset, ad: preset === "ozel" ? `${trDate(r[0])} – ${trDate(r[1])}` : PRESETS[preset].ad, bas: r[0], bit: r[1], gun: diffDays(r[0], r[1]) + 1 };
}

// Hemen önceki eş uzunluktaki dönem. Takvim dönemlerinde (ay/çeyrek/yıl) takvimle hizalanır.
function previousPeriod(p) {
  const { kod, bas, bit } = p;
  let r;
  if (kod === "bu_ay" || kod === "gecen_ay") {
    const s = startOfMonth(addMonths(bas, -1));
    const len = diffDays(bas, bit);
    r = [s, minDate(addDays(s, len), endOfMonth(s))];
  } else if (kod === "bu_ceyrek") {
    const s = startOfQuarter(addMonths(bas, -3));
    r = [s, minDate(addDays(s, diffDays(bas, bit)), endOfQuarter(s))];
  } else if (kod === "bu_yil" || kod === "gecen_yil") {
    r = [addYears(bas, -1), addYears(bit, -1)];
  } else {
    const len = diffDays(bas, bit) + 1;
    r = [addDays(bas, -len), addDays(bas, -1)];
  }
  return { kod: "onceki", ad: "Önceki dönem", bas: r[0], bit: r[1], gun: diffDays(r[0], r[1]) + 1 };
}

function lastYearPeriod(p) {
  const r = [addYears(p.bas, -1), addYears(p.bit, -1)];
  return { kod: "gecen_yil_ayni", ad: "Geçen yıl aynı dönem", bas: r[0], bit: r[1], gun: diffDays(r[0], r[1]) + 1 };
}

// ─── Zaman kovaları (SQLite ifadeleri) ──────────────────────────────────────
const GRANS = { gun: "Gün", hafta: "Hafta", ay: "Ay", ceyrek: "Çeyrek", yil: "Yıl" };

function bucketSql(gran, col) {
  switch (gran) {
    case "gun": return col;
    case "hafta": return `date(${col}, '-' || ((CAST(strftime('%w', ${col}) AS INTEGER) + 6) % 7) || ' days')`;
    case "ay": return `substr(${col}, 1, 7)`;
    case "ceyrek": return `substr(${col}, 1, 4) || '-Q' || ((CAST(substr(${col}, 6, 2) AS INTEGER) + 2) / 3)`;
    case "yil": return `substr(${col}, 1, 4)`;
    default: throw Object.assign(new Error(`Geçersiz kırılım: ${gran}`), { status: 400 });
  }
}

function bucketOf(gran, d) {
  switch (gran) {
    case "gun": return d;
    case "hafta": return startOfWeek(d);
    case "ay": return d.slice(0, 7);
    case "ceyrek": return `${d.slice(0, 4)}-Q${quarter(d)}`;
    case "yil": return d.slice(0, 4);
    default: throw new Error(gran);
  }
}

function enumerateBuckets(gran, bas, bit) {
  const out = [];
  let d = gran === "gun" ? bas : gran === "hafta" ? startOfWeek(bas) : gran === "ay" ? startOfMonth(bas)
    : gran === "ceyrek" ? startOfQuarter(bas) : startOfYear(bas);
  let guard = 0;
  while (d <= bit && guard++ < 6000) {
    out.push(bucketOf(gran, d));
    d = gran === "gun" ? addDays(d, 1) : gran === "hafta" ? addDays(d, 7) : gran === "ay" ? addMonths(d, 1)
      : gran === "ceyrek" ? addMonths(d, 3) : addYears(d, 1);
  }
  return out;
}

// Kovanın son günü (bakiye serileri için örnekleme noktası)
function bucketEnd(gran, key) {
  switch (gran) {
    case "gun": return key;
    case "hafta": return addDays(key, 6);
    case "ay": return endOfMonth(`${key}-01`);
    case "ceyrek": { const [y, q] = key.split("-Q"); return endOfMonth(fmt(+y, +q * 3, 1)); }
    case "yil": return `${key}-12-31`;
    default: throw new Error(gran);
  }
}

function bucketLabel(gran, key) {
  switch (gran) {
    case "gun": { const p = parse(key); return `${p.d} ${AYLAR[p.m - 1]}`; }
    case "hafta": { const p = parse(key); return `${p.d} ${AYLAR[p.m - 1]} haftası`; }
    case "ay": { const [y, m] = key.split("-"); return `${AYLAR[+m - 1]} ${y}`; }
    case "ceyrek": { const [y, q] = key.split("-Q"); return `${q}. Çeyrek ${y}`; }
    case "yil": return key;
    default: return key;
  }
}

// Dönem uzunluğuna göre makul varsayılan kırılım
function autoGran(p) {
  if (p.gun <= 45) return "gun";
  if (p.gun <= 190) return "hafta";
  if (p.gun <= 1100) return "ay";
  return "ceyrek";
}

function trDate(d) {
  if (!isDate(d)) return "—";
  const p = parse(d);
  return `${String(p.d).padStart(2, "0")}.${String(p.m).padStart(2, "0")}.${p.y}`;
}

module.exports = {
  TZ, AYLAR, AYLAR_UZUN, GUNLER, PRESETS, GRANS,
  todayTR, addDays, diffDays, addMonths, addYears, startOfMonth, endOfMonth, startOfYear, endOfYear,
  startOfWeek, startOfQuarter, endOfQuarter, weekday, quarter, minDate, maxDate, isDate,
  resolvePeriod, previousPeriod, lastYearPeriod, bucketSql, bucketOf, enumerateBuckets, bucketEnd,
  bucketLabel, autoGran, trDate, parse, fmt,
};
