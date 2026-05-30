import { useState, useEffect } from "react";
import { useConnection } from "../context/ConnectionContext";
import { apiGet, formatTL, formatDate } from "../utils/api";

export default function SenetPortfoy() {
  const { selectedFirma, selectedDonem } = useConnection();
  const [yon, setYon] = useState("giris");
  const [res, setRes] = useState({ data: [], count: 0, toplam: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let on = true;
    setLoading(true); setError(null);
    apiGet("/senet", { firmaNo: selectedFirma, donemNo: selectedDonem, yon })
      .then(r => { if (on) setRes(r); })
      .catch(e => { if (on) setError(e.message); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [selectedFirma, selectedDonem, yon]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Senet Portföy</h1>
        <p className="text-dark-400 mt-1">Alınan ve verilen senetler</p>
      </div>

      <div className="glass-card p-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {[["giris", "Alınan Senetler"], ["cikis", "Verilen Senetler"]].map(([v, l]) => (
            <button key={v} onClick={() => setYon(v)} className={`px-4 py-2 text-sm font-medium transition-colors ${yon === v ? "bg-violet-600 text-white" : "bg-dark-800 text-dark-300 hover:bg-dark-700"}`}>{l}</button>
          ))}
        </div>
        <span className="text-sm text-dark-400">{loading ? "Yükleniyor..." : `${res.count} kayıt`}</span>
        <span className="ml-auto text-sm text-dark-300">Toplam: <span className="font-bold text-amber-400">{formatTL(res.toplam || 0)}</span></span>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-dark-800/60 text-dark-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">Belge No</th><th className="px-4 py-3 text-left">Keşideci</th>
              <th className="px-4 py-3 text-left">Cari</th><th className="px-4 py-3 text-left">Vergi Dairesi</th>
              <th className="px-4 py-3 text-left">Keşide Tarihi</th><th className="px-4 py-3 text-right">Tutar</th>
            </tr></thead>
            <tbody>
              {res.data.map((s, i) => (
                <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-white font-mono text-xs">{s.BELGENO}</td>
                  <td className="px-4 py-3 text-dark-200">{s.KESIDEEDEN || "—"}</td>
                  <td className="px-4 py-3 text-dark-300">{s.cariUnvan || "—"}</td>
                  <td className="px-4 py-3 text-dark-400">{s.VERGIDAIRESI || "—"}</td>
                  <td className="px-4 py-3 text-dark-300 font-mono text-xs">{formatDate(s.KESIDETARIHI)}</td>
                  <td className="px-4 py-3 text-right text-amber-400 font-semibold">{s.TUTAR ? formatTL(s.TUTAR) : "—"}</td>
                </tr>
              ))}
              {!loading && res.data.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-dark-500">Senet kaydı bulunamadı</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
