import { useState, useEffect } from "react";
import { useConnection } from "../context/ConnectionContext";
import { apiGet, formatTL, formatMoney, formatNumber } from "../utils/api";

export default function BankaRaporlari() {
  const { selectedFirma, selectedDonem } = useConnection();
  const [res, setRes] = useState({ data: [], toplam: {}, nakit: {}, kredi: {}, doviz: {}, hesapSayisi: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let on = true;
    setLoading(true); setError(null);
    apiGet("/banka/list", { firmaNo: selectedFirma, donemNo: selectedDonem })
      .then(r => { if (on) setRes(r); })
      .catch(e => { if (on) setError(e.message); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [selectedFirma, selectedDonem]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Banka Raporları</h1>
        <p className="text-dark-400 mt-1">Banka hesap bakiyeleri ve hareket özetleri</p>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-600/20 to-green-800/20 p-6">
          <p className="text-dark-300 text-xs font-semibold uppercase">Pozitif Bakiye (TL)</p>
          <p className="text-2xl font-bold mt-2 text-emerald-400">{formatNumber(res.nakit?.TL || 0)} ₺</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-rose-600/20 to-red-800/20 p-6">
          <p className="text-dark-300 text-xs font-semibold uppercase">Banka Kredileri (TL)</p>
          <p className="text-2xl font-bold mt-2 text-rose-400">{formatNumber(res.kredi?.TL || 0)} ₺</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-600/20 to-purple-800/20 p-6">
          <p className="text-dark-300 text-xs font-semibold uppercase">Net Pozisyon (TL)</p>
          <p className={`text-2xl font-bold mt-2 ${(res.toplam?.TL || 0) < 0 ? "text-red-400" : "text-cyan-400"}`}>{formatNumber(res.toplam?.TL || 0)} ₺</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-amber-600/20 to-orange-800/20 p-6">
          <p className="text-dark-300 text-xs font-semibold uppercase">Döviz Kasaları</p>
          {(() => {
            const dv = Object.entries(res.doviz || {}).filter(([, v]) => Number(v) !== 0);
            return dv.length === 0
              ? <p className="text-2xl font-bold mt-2 text-dark-500">—</p>
              : dv.map(([pb, v]) => <p key={pb} className="text-lg font-bold mt-1 text-amber-400">{formatMoney(v, pb)}</p>);
          })()}
        </div>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-600/20 to-blue-800/20 p-6">
          <p className="text-dark-300 text-xs font-semibold uppercase">Aktif Hesap</p>
          <p className="text-2xl font-bold mt-2 text-cyan-400">{res.hesapSayisi}</p>
        </div>
      </div>

      <p className="text-dark-500 text-xs -mt-2">
        Not: Banka bakiyeleri dönem hareketlerinin net toplamıdır (açılış devri bu veride tutulmaz). Döviz kasaları TL toplamdan hariç tutulur.
      </p>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-dark-800/60 text-dark-400 text-xs uppercase border-b border-white/5">
              <th className="px-4 py-3 text-left">Banka</th><th className="px-4 py-3 text-left">Şube</th>
              <th className="px-4 py-3 text-left">IBAN / Hesap No</th><th className="px-4 py-3 text-left">Para B.</th>
              <th className="px-4 py-3 text-right">Hareket</th><th className="px-4 py-3 text-right">Bakiye</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="px-4 py-12 text-center text-dark-500">Yükleniyor...</td></tr>
              : res.data.map(b => (
                <tr key={b.IND} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 text-white font-medium">{b.ADI}</td>
                  <td className="px-4 py-3 text-dark-300">{b.SUBE || b.SUBEADI || "—"}</td>
                  <td className="px-4 py-3 text-dark-400 font-mono text-xs">{b.IBAN || b.HESAPNO || "—"}</td>
                  <td className="px-4 py-3">{b.DOVIZ
                    ? <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-xs font-semibold">{b.DOVIZ}</span>
                    : <span className="text-dark-300">TL</span>}</td>
                  <td className="px-4 py-3 text-right text-dark-400">{b.HAREKET}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${b.BAKIYE < 0 ? "text-red-400" : b.DOVIZ ? "text-amber-300" : "text-emerald-400"}`}>{b.DOVIZ ? formatMoney(b.BAKIYE, b.DOVIZ) : formatTL(b.BAKIYE)}</td>
                </tr>
              ))}
              {!loading && res.data.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-dark-500">Banka hesabı bulunamadı</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
