// ═══════════════════════════════════════════════════════════════════════════
//  Kanonik veri kümeleri — Köprü (müşteri makinesi) ile Bulut (VPS) arasındaki
//  TEK sözleşme. Köprü VEGADB'den bu kolonları üretir; Bulut VEGADB şemasını
//  hiç bilmez, yalnızca bu satırları alır (Vega Kılavuzu §43.8 / §51.1).
//
//  Kolon tipleri: i = tam sayı, r = ondalık, t = metin, d = tarih ('YYYY-MM-DD')
//
//  Bölümleme (chunk) türleri:
//    month  → ay bazında (tarih kolonuna göre), anahtar parçası 'YYYY-MM'
//    bucket → kimlik aralığı (id / bucketSize), anahtar parçası 'b<no>'
//    none   → tek parça
//
//  Chunk anahtarı: `${ds}|${firma}|${donem}|${part}` (boş parçalar '' olur).
// ═══════════════════════════════════════════════════════════════════════════

const DATASETS = {
  // Global listeler
  firma: {
    scope: "global", partition: "none",
    cols: [["firma", "t"], ["ad", "t"], ["unvan", "t"]],
  },
  donem: {
    scope: "global", partition: "none",
    cols: [["firma", "t"], ["donem", "t"], ["yil", "i"]],
  },

  // ── Kart (master) tabloları — firmaya özel, dönemsiz ──
  cari: {
    scope: "firma", partition: "bucket", bucketSize: 2000, idCol: "id",
    cols: [
      ["id", "i"], ["kod", "t"], ["ad", "t"], ["tip", "i"], ["aktif", "i"],
      ["il", "t"], ["ilce", "t"], ["grup", "t"], ["temsilci", "t"],
      ["vade_gun", "i"], ["kredi_limit", "r"], ["risk_limit", "r"], ["ozelkod5", "t"],
    ],
  },
  stok: {
    scope: "firma", partition: "bucket", bucketSize: 2000, idCol: "id",
    cols: [
      ["id", "i"], ["kod", "t"], ["ad", "t"], ["tip", "i"], ["tur", "t"], ["sinif", "t"],
      ["marka", "t"], ["pasif", "i"], ["birim", "t"], ["maliyet", "r"], ["alis_fiyat", "r"],
      ["kritik", "r"],
    ],
  },
  banka: {
    scope: "firma", partition: "none",
    cols: [
      ["id", "i"], ["ad", "t"], ["kod", "t"], ["sube", "t"], ["pb", "t"],
      ["musbanka", "i"], ["status", "i"],
    ],
  },

  // ── Hareket tabloları — firma + dönem ──
  cari_hareket: {
    scope: "donem", partition: "month", dateCol: "tarih",
    cols: [
      ["id", "i"], ["tarih", "d"], ["cari_id", "i"], ["izahat", "i"], ["borc", "r"],
      ["alacak", "r"], ["kur", "r"], ["pb", "t"], ["vade", "d"], ["ozelkod", "t"],
      ["iade", "i"], ["evrak", "t"], ["saat", "i"],
    ],
  },
  kasa_hareket: {
    scope: "donem", partition: "month", dateCol: "tarih",
    cols: [
      ["id", "i"], ["tarih", "d"], ["kasa", "t"], ["sube", "t"], ["gelir", "r"], ["gider", "r"],
      ["kur", "r"], ["pb", "t"], ["islemtipi", "i"], ["kredikasa", "i"], ["belgeizahat", "i"],
      ["aciklama", "t"],
    ],
  },
  banka_hareket: {
    scope: "donem", partition: "month", dateCol: "tarih",
    cols: [
      ["id", "i"], ["tarih", "d"], ["banka_id", "i"], ["izahat", "i"], ["borc", "r"],
      ["alacak", "r"], ["kur", "r"], ["pb", "t"], ["aciklama", "t"],
    ],
  },
  satis: {
    scope: "donem", partition: "month", dateCol: "tarih",
    cols: [
      ["id", "i"], ["tarih", "d"], ["fatura_id", "i"], ["cari_id", "i"], ["stok_id", "i"],
      ["miktar", "r"], ["tutar", "r"], ["afiyat", "r"], ["masraf", "r"], ["stoktipi", "i"],
      ["detay", "i"], ["kdv", "r"], ["kur", "r"], ["pb", "t"], ["personel", "t"], ["depo", "i"],
      ["iptal", "i"], ["iade", "i"],
    ],
  },
  alis: {
    scope: "donem", partition: "month", dateCol: "tarih",
    cols: [
      ["id", "i"], ["tarih", "d"], ["fatura_id", "i"], ["cari_id", "i"], ["stok_id", "i"],
      ["miktar", "r"], ["tutar", "r"], ["fiyat", "r"], ["stoktipi", "i"], ["kdv", "r"],
      ["kur", "r"], ["pb", "t"], ["iptal", "i"], ["iade", "i"],
    ],
  },
  siparis: {
    scope: "donem", partition: "month", dateCol: "tarih",
    cols: [
      ["id", "i"], ["tarih", "d"], ["cari_id", "i"], ["tutar", "r"], ["kur", "r"], ["pb", "t"],
      ["iptal", "i"],
    ],
  },
  taksit: {
    scope: "donem", partition: "month", dateCol: "tarih",
    cols: [["id", "i"], ["tarih", "d"], ["cari_id", "i"], ["tutar", "r"]],
  },
  // Çek/senet portföyü (VARES* görünümleri) — dönem başına tek parça
  cek_senet: {
    scope: "donem", partition: "none",
    cols: [
      ["id", "i"], ["tur", "t"], ["yon", "t"], ["belgeno", "t"], ["tutar", "r"], ["vade", "d"],
      ["tarih", "d"], ["durum", "t"], ["cari", "t"], ["cari_kod", "t"], ["banka", "t"],
      ["pb", "t"], ["kur", "r"],
    ],
  },
  // Depo envanteri (SUM(ENVANTER), BELGETIPI<>67) — stok × depo kalan miktarı
  stok_durum: {
    scope: "donem", partition: "bucket", bucketSize: 2000, idCol: "stok_id",
    cols: [["stok_id", "i"], ["depo", "i"], ["miktar", "r"]],
  },
};

const DATASET_NAMES = Object.keys(DATASETS);

function chunkKey(ds, firma = "", donem = "", part = "") {
  return `${ds}|${firma || ""}|${donem || ""}|${part || ""}`;
}

function parseChunkKey(key) {
  const [ds, firma, donem, part] = String(key).split("|");
  return { ds, firma: firma || "", donem: donem || "", part: part || "" };
}

// Bir chunk anahtarının hangi "kapsama" (scope) ait olduğu — manifest'te kapsanan
// kapsamlar dışındaki chunk'lar silinmez (eski dönemler her döngüde taranmaz).
function scopeKey(ds, firma = "", donem = "") {
  const def = DATASETS[ds];
  if (!def) throw new Error(`Bilinmeyen veri kümesi: ${ds}`);
  if (def.scope === "global") return `${ds}||`;
  if (def.scope === "firma") return `${ds}|${firma}|`;
  return `${ds}|${firma}|${donem}`;
}

// Ay parçası için tarih aralığı: '2026-05' → ['2026-05-01', '2026-06-01')
function monthRange(part) {
  if (!/^\d{4}-\d{2}$/.test(part) || part === "0000-00") return null;
  const [y, m] = part.split("-").map(Number);
  const start = `${part}-01`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const end = `${ny}-${String(nm).padStart(2, "0")}-01`;
  return [start, end];
}

function validateDatasetRow(ds, cols) {
  const def = DATASETS[ds];
  if (!def) throw new Error(`Bilinmeyen veri kümesi: ${ds}`);
  const expected = def.cols.map((c) => c[0]);
  if (cols.length !== expected.length || cols.some((c, i) => c !== expected[i])) {
    throw new Error(`${ds}: kolonlar uyuşmuyor. Beklenen [${expected.join(",")}], gelen [${cols.join(",")}]`);
  }
  return true;
}

module.exports = {
  DATASETS, DATASET_NAMES, chunkKey, parseChunkKey, scopeKey, monthRange, validateDatasetRow,
  PROTOCOL_VERSION: 1,
};
