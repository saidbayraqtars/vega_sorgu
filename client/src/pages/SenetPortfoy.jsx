import { useState, useEffect } from "react";
import { useConnection } from "../context/ConnectionContext";
import { apiGet, formatTL, formatDate } from "../utils/api";

// Tahsil/ödeme durumu etiketi. Verilen senet: VSENETISLEM (Ödenecek / Senet
// Ödenmiş). Alınan senet: TAHSILDURUMU ('Tahsilat Yok' = portföyde).
function durumBadge(row) {
  const raw = (row.DURUM || "").trim();
  if (!raw) return null;
  const text = /yok/i.test(raw) ? "Portföyde" : raw;
  const cls = /iade/i.test(raw) ? "bg-rose-500/15 text-rose-300"
            : /(ödenecek|yok)/i.test(raw) ? "bg-amber-500/15 text-amber-300"
            : "bg-emerald-500/15 text-emerald-300";
  return { text, cls };
}

export default function SenetPortfoy() {
  const { selectedFirma, selectedDonem } = useConnection();
  const [yonFilter, setYonFilter] = useState("all");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Alınan + verilen senetler tek listede.
  useEffect(() => {
    let on = true;
    setLoading(true); setError(null);
    Promise.all([
      apiGet("/senet", { firmaNo: selectedFirma, donemNo: selectedDonem, yon: "giris" }),
      apiGet("/senet", { firmaNo: selectedFirma, donemNo: selectedDonem, yon: "cikis" }),
    ])
      .then(([g, c]) => {
        if (!on) return;
        const merged = [
          ...(g.data || []).map(r => ({ ...r, _yon: "giris" })),
          ...(c.data || []).map(r => ({ ...r, _yon: "cikis" })),
        ].sort((a, b) => new Date(b.VADE || b.TARIH || 0) - new Date(a.VADE || a.TARIH || 0));
        setRows(merged);
      })
      .catch(e => { if (on) setError(e.message); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [selectedFirma, selectedDonem]);

  const filtered = yonFilter === "all" ? rows : rows.filter(s => s._yon === yonFilter);
  const toplam = filtered.reduce((s, r) => s + (Number(r.TUTAR) || 0), 0);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Senet Portföy</h1>
        <p className="text-dark-400 mt-1">Alınan ve verilen senetler tek listede</p>
      </div>

      <div className="glass-card p-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {[["all", "Tümü"], ["giris", "Alınan (Aldı)"], ["cikis", "Verilen (Verdi)"]].map(([v, l]) => (
            <button key={v} onClick={() => setYonFilter(v)} className={`px-4 py-2 text-sm font-medium transition-colors ${yonFilter === v ? "bg-violet-600 text-white" : "bg-dark-800 text-dark-300 hover:bg-dark-700"}`}>{l}</button>
          ))}
        </div>
        <span className="text-sm text-dark-400">{loading ? "Yükleniyor..." : `${filtered.length} kayıt`}</span>
        <span className="ml-auto text-sm text-dark-300">Toplam: <span className="font-bold text-amber-400">{formatTL(toplam)}</span></span>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-dark-800/60 text-dark-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">Yön</th><th className="px-4 py-3 text-left">Belge No</th>
              <th className="px-4 py-3 text-left">Keşideci</th><th className="px-4 py-3 text-left">Cari</th>
              <th className="px-4 py-3 text-left">Bordro Tarihi</th><th className="px-4 py-3 text-left">Vade</th>
              <th className="px-4 py-3 text-left">Durum</th><th className="px-4 py-3 text-right">Tutar</th>
            </tr></thead>
            <tbody>
              {filtered.map((s, i) => {
                const d = durumBadge(s);
                return (
                  <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3">{s._yon === "cikis"
                      ? <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 text-xs font-semibold">Verdi</span>
                      : <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 text-xs font-semibold">Aldı</span>}</td>
                    <td className="px-4 py-3 text-white font-mono text-xs">{s.BELGENO || "—"}</td>
                    <td className="px-4 py-3 text-dark-200">{s.KESIDEEDEN || "—"}</td>
                    <td className="px-4 py-3 text-dark-300">{s.cariUnvan || "—"}</td>
                    <td className="px-4 py-3 text-dark-300 font-mono text-xs">{formatDate(s.TARIH)}</td>
                    <td className="px-4 py-3 text-dark-300 font-mono text-xs">{formatDate(s.VADE || s.KESIDETARIHI)}</td>
                    <td className="px-4 py-3">{d
                      ? <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${d.cls}`}>{d.text}</span>
                      : <span className="text-dark-500">—</span>}</td>
                    <td className="px-4 py-3 text-right text-amber-400 font-semibold">{s.TUTAR ? formatTL(s.TUTAR) : "—"}</td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-dark-500">Senet kaydı bulunamadı</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
