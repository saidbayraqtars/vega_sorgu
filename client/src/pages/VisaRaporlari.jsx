import { useState, useEffect } from "react";
import { useConnection } from "../context/ConnectionContext";
import { apiGet, formatTL, formatDate } from "../utils/api";

export default function VisaRaporlari() {
  const { selectedFirma, selectedDonem } = useConnection();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filtre, setFiltre] = useState({ startDate: "", endDate: "" });
  const [res, setRes] = useState({ data: [], toplam: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { setFiltre({ startDate: "", endDate: "" }); setStartDate(""); setEndDate(""); }, [selectedFirma, selectedDonem]);

  useEffect(() => {
    let on = true;
    setLoading(true); setError(null);
    apiGet("/visa", { firmaNo: selectedFirma, donemNo: selectedDonem, ...filtre })
      .then(r => { if (on) setRes(r); })
      .catch(e => { if (on) setError(e.message); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [selectedFirma, selectedDonem, filtre]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Visa Raporları</h1>
        <p className="text-dark-400 mt-1">Kredi kartı (POS) tahsilat ve iadeleri — cari hareket izahat 13/14</p>
      </div>

      <div className="glass-card p-5 flex flex-wrap items-end gap-3">
        <div><label className="block text-xs text-dark-400 mb-1">Başlangıç</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-dark-800 border border-white/10 text-white text-sm rounded-lg p-2 outline-none" /></div>
        <div><label className="block text-xs text-dark-400 mb-1">Bitiş</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-dark-800 border border-white/10 text-white text-sm rounded-lg p-2 outline-none" /></div>
        <button onClick={() => setFiltre({ startDate, endDate })} className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium">Uygula</button>
        <button onClick={() => { setStartDate(""); setEndDate(""); setFiltre({ startDate: "", endDate: "" }); }} className="px-4 py-2 rounded-lg bg-dark-800 border border-white/10 text-dark-300 text-sm">Temizle</button>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-dark-800/60 border border-white/5 p-4"><p className="text-xs text-dark-400">Toplam Tahsilat (Alacak)</p><p className="text-lg font-bold text-emerald-400 mt-1">{formatTL(res.toplam.alacak || 0)}</p></div>
        <div className="rounded-xl bg-dark-800/60 border border-white/5 p-4"><p className="text-xs text-dark-400">Toplam İade (Borç)</p><p className="text-lg font-bold text-red-400 mt-1">{formatTL(res.toplam.borc || 0)}</p></div>
        <div className="rounded-xl bg-dark-800/60 border border-white/5 p-4"><p className="text-xs text-dark-400">Net</p><p className="text-lg font-bold text-cyan-400 mt-1">{formatTL(res.toplam.net || 0)}</p></div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 text-sm text-dark-400">{loading ? "Yükleniyor..." : `${res.data.length} kayıt`}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-dark-800/60 text-dark-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">Tarih</th><th className="px-4 py-3 text-left">Cari</th>
              <th className="px-4 py-3 text-left">Evrak No</th><th className="px-4 py-3 text-left">İzahat</th>
              <th className="px-4 py-3 text-right">Tahsilat</th><th className="px-4 py-3 text-right">İade</th>
            </tr></thead>
            <tbody>
              {res.data.map((h, i) => (
                <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-dark-300 font-mono text-xs">{formatDate(h.TARIH)}</td>
                  <td className="px-4 py-3 text-dark-200">{h.cariUnvan || "—"}</td>
                  <td className="px-4 py-3 text-dark-400 font-mono text-xs">{h.EVRAKNO}</td>
                  <td className="px-4 py-3 text-dark-300">{h.IZAHAT === "13" ? "Visa Tahsilat" : h.IZAHAT === "14" ? "Visa İade" : h.IZAHAT}</td>
                  <td className="px-4 py-3 text-right text-emerald-400">{h.ALACAK ? formatTL(h.ALACAK) : "—"}</td>
                  <td className="px-4 py-3 text-right text-red-400">{h.BORC ? formatTL(h.BORC) : "—"}</td>
                </tr>
              ))}
              {!loading && res.data.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-dark-500">Visa hareketi bulunamadı</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
