import { useState, useEffect } from "react";
import { useConnection } from "../context/ConnectionContext";
import { apiGet, formatTL, formatDate } from "../utils/api";
import { getBankaIzahat } from "../constants/izahat";

export default function BankaHareket() {
  const { selectedFirma, selectedDonem } = useConnection();
  const [bankalar, setBankalar] = useState([]);
  const [bankaNo, setBankaNo] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState({ data: [], total: 0, pageCount: 0, toplam: {} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Banka listesi (filtre için)
  useEffect(() => {
    apiGet("/banka/list", { firmaNo: selectedFirma, donemNo: selectedDonem })
      .then(r => setBankalar(r.data)).catch(() => {});
  }, [selectedFirma, selectedDonem]);

  // Aktif filtreler (yalnızca Uygula'ya basınca değişir)
  const [filtre, setFiltre] = useState({ bankaNo: "", startDate: "", endDate: "" });

  // Firma/dönem değişince başa dön
  useEffect(() => { setPage(1); setFiltre({ bankaNo: "", startDate: "", endDate: "" }); setBankaNo(""); setStartDate(""); setEndDate(""); }, [selectedFirma, selectedDonem]);

  // Veri yükle (sayfa veya aktif filtre değişince)
  useEffect(() => {
    let on = true;
    setLoading(true); setError(null);
    apiGet("/banka/hareket", { firmaNo: selectedFirma, donemNo: selectedDonem, ...filtre, page })
      .then(r => { if (on) setRes(r); })
      .catch(e => { if (on) setError(e.message); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [selectedFirma, selectedDonem, filtre, page]);

  const uygula = () => { setPage(1); setFiltre({ bankaNo, startDate, endDate }); };
  const temizle = () => { setBankaNo(""); setStartDate(""); setEndDate(""); setPage(1); setFiltre({ bankaNo: "", startDate: "", endDate: "" }); };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Banka Hareket Raporu</h1>
        <p className="text-dark-400 mt-1">Banka gelir ve gider hareketleri</p>
      </div>

      <div className="glass-card p-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-dark-400 mb-1">Banka</label>
          <select value={bankaNo} onChange={e => setBankaNo(e.target.value)} className="bg-dark-800 border border-white/10 text-white text-sm rounded-lg p-2 outline-none">
            <option value="">Tüm Bankalar</option>
            {bankalar.map(b => <option key={b.IND} value={b.IND}>{b.ADI} {b.SUBE ? `(${b.SUBE})` : ""}</option>)}
          </select>
        </div>
        <div><label className="block text-xs text-dark-400 mb-1">Başlangıç</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-dark-800 border border-white/10 text-white text-sm rounded-lg p-2 outline-none" /></div>
        <div><label className="block text-xs text-dark-400 mb-1">Bitiş</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-dark-800 border border-white/10 text-white text-sm rounded-lg p-2 outline-none" /></div>
        <button onClick={uygula} className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors">Uygula</button>
        <button onClick={temizle}
          className="px-4 py-2 rounded-lg bg-dark-800 border border-white/10 text-dark-300 text-sm hover:bg-dark-700 transition-colors">Temizle</button>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl bg-dark-800/60 border border-white/5 p-4"><p className="text-xs text-dark-400">Toplam Borç (Giriş)</p><p className="text-lg font-bold text-emerald-400 mt-1">{formatTL(res.toplam.borc || 0)}</p></div>
        <div className="rounded-xl bg-dark-800/60 border border-white/5 p-4"><p className="text-xs text-dark-400">Toplam Alacak (Çıkış)</p><p className="text-lg font-bold text-red-400 mt-1">{formatTL(res.toplam.alacak || 0)}</p></div>
        <div className="rounded-xl bg-dark-800/60 border border-white/5 p-4"><p className="text-xs text-dark-400">Net</p><p className={`text-lg font-bold mt-1 ${(res.toplam.net || 0) < 0 ? "text-red-400" : "text-cyan-400"}`}>{formatTL(res.toplam.net || 0)}</p></div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between text-sm text-dark-400">
          <span>{loading ? "Yükleniyor..." : `${res.total} kayıt`}</span>
          {res.pageCount > 0 && <span>Sayfa {res.page} / {res.pageCount}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-dark-800/60 text-dark-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">Tarih</th><th className="px-4 py-3 text-left">Banka</th>
              <th className="px-4 py-3 text-left">İzahat</th><th className="px-4 py-3 text-left">Evrak No</th>
              <th className="px-4 py-3 text-right">Borç</th><th className="px-4 py-3 text-right">Alacak</th>
            </tr></thead>
            <tbody>
              {res.data.map((h, i) => (
                <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-dark-300 font-mono text-xs">{formatDate(h.TARIH)}</td>
                  <td className="px-4 py-3 text-dark-200">{h.bankaAdi || "—"}{h.bankaSube ? <span className="text-dark-500"> / {h.bankaSube}</span> : ""}</td>
                  <td className="px-4 py-3 text-dark-300">{getBankaIzahat(h.IZAHAT)}</td>
                  <td className="px-4 py-3 text-dark-400 font-mono text-xs">{h.EVRAKNO}</td>
                  <td className="px-4 py-3 text-right text-emerald-400">{h.BORC ? formatTL(h.BORC) : "—"}</td>
                  <td className="px-4 py-3 text-right text-red-400">{h.ALACAK ? formatTL(h.ALACAK) : "—"}</td>
                </tr>
              ))}
              {!loading && res.data.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-dark-500">Hareket bulunamadı</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="p-4 flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-lg bg-dark-800 border border-white/10 text-white text-sm disabled:opacity-40">Önceki</button>
          <button disabled={page >= res.pageCount} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-lg bg-dark-800 border border-white/10 text-white text-sm disabled:opacity-40">Sonraki</button>
        </div>
      </div>
    </div>
  );
}
