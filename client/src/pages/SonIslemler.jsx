import { useState, useEffect } from "react";
import { useConnection } from "../context/ConnectionContext";
import { apiGet, formatTL, formatDate } from "../utils/api";
import { getIzahatDetails } from "../constants/izahat";

export default function SonIslemler() {
  const { selectedFirma, selectedDonem } = useConnection();
  const [page, setPage] = useState(1);
  const [res, setRes] = useState({ data: [], total: 0, pageCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { setPage(1); }, [selectedFirma, selectedDonem]);

  useEffect(() => {
    let on = true;
    setLoading(true); setError(null);
    apiGet("/son-islemler", { firmaNo: selectedFirma, donemNo: selectedDonem, limit: 50, page })
      .then(r => { if (on) setRes(r); })
      .catch(e => { if (on) setError(e.message); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [selectedFirma, selectedDonem, page]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Son İşlemler</h1>
        <p className="text-dark-400 mt-1">Tüm cari hareketler — en yeniden eskiye</p>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between text-sm text-dark-400">
          <span>{loading ? "Yükleniyor..." : `${res.total} işlem`}</span>
          {res.pageCount > 0 && <span>Sayfa {res.page} / {res.pageCount}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-dark-800/60 text-dark-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">Tarih</th><th className="px-4 py-3 text-left">Cari</th>
              <th className="px-4 py-3 text-left">İşlem</th><th className="px-4 py-3 text-left">Evrak No</th>
              <th className="px-4 py-3 text-right">Borç</th><th className="px-4 py-3 text-right">Alacak</th>
            </tr></thead>
            <tbody>
              {res.data.map((h, i) => (
                <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-dark-300 font-mono text-xs">{formatDate(h.TARIH)}</td>
                  <td className="px-4 py-3 text-dark-200">{h.cariUnvan || "—"}</td>
                  <td className="px-4 py-3 text-dark-300">{getIzahatDetails(parseInt(h.IZAHAT)).label}</td>
                  <td className="px-4 py-3 text-dark-400 font-mono text-xs">{h.EVRAKNO}</td>
                  <td className="px-4 py-3 text-right text-red-400">{h.BORC ? formatTL(h.BORC) : "—"}</td>
                  <td className="px-4 py-3 text-right text-emerald-400">{h.ALACAK ? formatTL(h.ALACAK) : "—"}</td>
                </tr>
              ))}
              {!loading && res.data.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-dark-500">İşlem bulunamadı</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="p-4 flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-lg bg-dark-800 border border-white/10 text-white text-sm disabled:opacity-40 hover:bg-dark-700 transition-colors">Önceki</button>
          <button disabled={page >= res.pageCount} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-lg bg-dark-800 border border-white/10 text-white text-sm disabled:opacity-40 hover:bg-dark-700 transition-colors">Sonraki</button>
        </div>
      </div>
    </div>
  );
}
