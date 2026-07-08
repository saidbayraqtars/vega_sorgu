import { useState, useEffect } from "react";
import { useConnection } from "../context/ConnectionContext";
import { apiGet, formatTL, formatNumber } from "../utils/api";

export default function SatisKarlilik() {
  const { selectedFirma, selectedDonem } = useConnection();
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filtre, setFiltre] = useState({ search: "", startDate: "", endDate: "" });
  const [res, setRes] = useState({ data: [], ozet: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { setFiltre({ search: "", startDate: "", endDate: "" }); setSearch(""); setStartDate(""); setEndDate(""); }, [selectedFirma, selectedDonem]);

  useEffect(() => {
    let on = true;
    setLoading(true); setError(null);
    apiGet("/satis-karlilik", { firmaNo: selectedFirma, donemNo: selectedDonem, ...filtre })
      .then(r => { if (on) setRes(r); })
      .catch(e => { if (on) setError(e.message); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [selectedFirma, selectedDonem, filtre]);

  const o = res.ozet || {};

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Satış Karlılık Raporu</h1>
        <p className="text-dark-400 mt-1">Stok bazlı satış, maliyet ve kâr analizi</p>
      </div>

      <div className="glass-card p-5 flex flex-wrap items-end gap-3">
        <div><label className="block text-xs text-dark-400 mb-1">Başlangıç</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-dark-800 border border-white/10 text-white text-sm rounded-lg p-2 outline-none" /></div>
        <div><label className="block text-xs text-dark-400 mb-1">Bitiş</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-dark-800 border border-white/10 text-white text-sm rounded-lg p-2 outline-none" /></div>
        <div className="flex-1 min-w-[180px]"><label className="block text-xs text-dark-400 mb-1">Malın Cinsi</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Stok adı veya kodu..." className="w-full bg-dark-800 border border-white/10 text-white text-sm rounded-lg p-2 outline-none" /></div>
        <button onClick={() => setFiltre({ search, startDate, endDate })} className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium">Uygula</button>
        <button onClick={() => { setSearch(""); setStartDate(""); setEndDate(""); setFiltre({ search: "", startDate: "", endDate: "" }); }} className="px-4 py-2 rounded-lg bg-dark-800 border border-white/10 text-dark-300 text-sm">Temizle</button>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-600/20 to-blue-800/20 p-5"><p className="text-xs text-dark-300 uppercase">Toplam Satış</p><p className="text-2xl font-bold text-cyan-400 mt-2">{formatTL(o.satis || 0)}</p></div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-rose-600/20 to-red-800/20 p-5"><p className="text-xs text-dark-300 uppercase">Toplam Maliyet</p><p className="text-2xl font-bold text-rose-400 mt-2">{formatTL(o.maliyet || 0)}</p></div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-600/20 to-green-800/20 p-5"><p className="text-xs text-dark-300 uppercase">Toplam Karlılık</p><p className="text-2xl font-bold text-emerald-400 mt-2">{formatTL(o.kar || 0)}</p></div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-600/20 to-purple-800/20 p-5"><p className="text-xs text-dark-300 uppercase">Ort. Kâr Marjı</p><p className="text-2xl font-bold text-violet-400 mt-2">%{formatNumber(o.marj || 0)}</p><p className="text-[11px] text-dark-400 mt-1">Maliyet üzeri %{formatNumber(o.karOrani || 0)}{o.masraf ? ` · Masraf ${formatTL(o.masraf)}` : ""}</p></div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 text-sm text-dark-400">{loading ? "Yükleniyor..." : (o.kalemSayisi > res.data.length ? `${o.kalemSayisi} stok kalemi (en yüksek ${res.data.length} satış gösteriliyor)` : `${res.data.length} stok kalemi`)}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-dark-800/60 text-dark-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">Malın Cinsi</th><th className="px-4 py-3 text-right">Çıkan</th>
              <th className="px-4 py-3 text-right">Satış Tutarı</th><th className="px-4 py-3 text-right">Birim Maliyet</th>
              <th className="px-4 py-3 text-right">Maliyet Tutarı</th>
              <th className="px-4 py-3 text-right">Kâr</th><th className="px-4 py-3 text-right">Marj</th>
            </tr></thead>
            <tbody>
              {res.data.map((r, i) => {
                const marj = r.satis ? (r.kar / r.satis) * 100 : 0;
                return (
                  <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-white">{r.malincinsi || r.stokkodu || "—"}</td>
                    <td className="px-4 py-3 text-right text-dark-300">{formatNumber(r.miktar, 2)}</td>
                    <td className="px-4 py-3 text-right text-cyan-400">{formatTL(r.satis)}</td>
                    <td className="px-4 py-3 text-right text-dark-300">{formatTL(r.birimMaliyet)}</td>
                    <td className="px-4 py-3 text-right text-rose-400">{formatTL(r.maliyet)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${r.kar < 0 ? "text-red-400" : "text-emerald-400"}`}>{formatTL(r.kar)}</td>
                    <td className={`px-4 py-3 text-right ${marj < 0 ? "text-red-400" : "text-dark-200"}`}>%{formatNumber(marj)}</td>
                  </tr>
                );
              })}
              {!loading && res.data.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-dark-500">Satış kaydı bulunamadı</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
