import { useState, useMemo } from "react";
import { IZAHAT_MAP } from "../context/ConnectionContext";

// ─── IZAHAT → Kullanıcı Dostu Etiket ─────────────────────────
function getPaymentLabel(izahat) {
  const mapped = IZAHAT_MAP[izahat];
  return mapped ? mapped.label : `Bilinmeyen (${izahat})`;
}

function getPaymentType(izahat) {
  const mapped = IZAHAT_MAP[izahat];
  return mapped ? mapped.type : "unknown";
}

const FILTER_OPTIONS = [
  { label: "Tümü", value: "all" },
  { label: "💵 Nakit", value: "cash" },
  { label: "💳 Visa", value: "visa" },
];

export default function TransactionTable({ data, isLoading }) {
  const [filter, setFilter] = useState("all");
  const [sortKey, setSortKey] = useState("ISLEMTARIHI");
  const [sortDir, setSortDir] = useState("asc");
  const [search, setSearch] = useState("");

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.map((row) => ({
      ...row,
      _paymentType: getPaymentType(row.IZAHAT),
      _paymentLabel: getPaymentLabel(row.IZAHAT),
    }));

    // Tip filtresi
    if (filter !== "all") {
      rows = rows.filter((r) => r._paymentType === filter);
    }

    // Arama
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r._paymentLabel.toLowerCase().includes(s) ||
          String(r.ALACAK).includes(s) ||
          (r.ISLEMTARIHI || "").toString().toLowerCase().includes(s)
      );
    }

    // Sıralama
    rows.sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }, [data, filter, sortKey, sortDir, search]);

  // Toplam hesapla
  const totalAmount = useMemo(() => {
    return filtered.reduce((sum, r) => sum + (Number(r.ALACAK) || 0), 0);
  }, [filtered]);

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <span className="text-dark-600 ml-1">↕</span>;
    return <span className="text-cyan-400 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const columns = [
    { key: "ISLEMTARIHI", label: "Tarih / Saat" },
    { key: "ALACAK", label: "Tutar (₺)" },
    { key: "IZAHAT", label: "Ödeme Tipi" },
  ];

  // Tarih formatlama
  function formatDate(dateVal) {
    if (!dateVal) return "—";
    try {
      const d = new Date(dateVal);
      return d.toLocaleString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return String(dateVal);
    }
  }

  return (
    <div className="glass-card overflow-hidden animate-slide-up" style={{ animationDelay: "200ms", animationFillMode: "backwards" }}>
      {/* Toolbar */}
      <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <h2 className="text-white font-semibold">İşlem Detayları</h2>
          {filtered.length > 0 && (
            <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-dark-700 text-dark-300">
              {filtered.length} kayıt
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg bg-dark-900/60 border border-white/10 text-white text-sm placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 w-full sm:w-48 transition-all"
            />
          </div>

          {/* Filter */}
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
                  filter === opt.value
                    ? "bg-cyan-600/30 text-cyan-300 border-cyan-500/30"
                    : "bg-dark-900/40 text-dark-400 hover:text-dark-300 hover:bg-dark-800/60"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-5 py-3.5 text-left text-xs font-semibold text-dark-400 uppercase tracking-wider cursor-pointer hover:text-dark-300 transition-colors select-none"
                >
                  {col.label}
                  <SortIcon col={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {columns.map((col) => (
                    <td key={col.key} className="px-5 py-3.5">
                      <div className="skeleton h-5 w-full rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-dark-500">
                    <svg className="w-12 h-12 text-dark-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                    <p className="font-medium">Bu tarihte işlem bulunamadı</p>
                    <p className="text-xs text-dark-600">Farklı bir tarih veya filtre deneyin</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr key={i} className="border-b border-white/5 table-row-hover">
                  <td className="px-5 py-3.5 text-dark-300 font-mono text-xs">
                    {formatDate(row.ISLEMTARIHI)}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-white">
                    {Number(row.ALACAK).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      row._paymentType === "cash"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : row._paymentType === "visa"
                        ? "bg-violet-500/15 text-violet-400"
                        : "bg-dark-700 text-dark-400"
                    }`}>
                      <span>{row._paymentType === "cash" ? "💵" : row._paymentType === "visa" ? "💳" : "❓"}</span>
                      {row._paymentLabel}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>

          {/* Footer Total */}
          {!isLoading && filtered.length > 0 && (
            <tfoot>
              <tr className="border-t border-white/10 bg-dark-800/30">
                <td className="px-5 py-3.5 text-xs font-semibold text-dark-400 uppercase">
                  Toplam
                </td>
                <td className="px-5 py-3.5 font-bold text-cyan-400">
                  {totalAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                </td>
                <td className="px-5 py-3.5" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
