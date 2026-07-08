import { useState, useEffect } from "react";
import { useConnection } from "../context/ConnectionContext";
import { apiGet, formatTL, formatMoney, formatNumber, formatDate } from "../utils/api";
import { getBankaIzahat } from "../constants/izahat";

// Bir banka hesabının hareketleri — satıra tıklayınca açılan modal.
function BankaHareketModal({ firmaNo, donemNo, banka, onClose }) {
  const [page, setPage] = useState(1);
  const [res, setRes] = useState({ data: [], total: 0, pageCount: 0, toplam: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let on = true;
    setLoading(true); setError(null);
    apiGet("/banka/hareket", { firmaNo, donemNo, bankaNo: banka.IND, page })
      .then(r => { if (on) setRes(r); })
      .catch(e => { if (on) setError(e.message); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [firmaNo, donemNo, banka.IND, page]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar glass-card p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-white">{banka.ADI}</h2>
            <p className="text-dark-400 text-sm">{banka.SUBE || banka.SUBEADI || "—"}{banka.IBAN || banka.HESAPNO ? ` — ${banka.IBAN || banka.HESAPNO}` : ""}</p>
          </div>
          <button onClick={onClose} className="text-dark-400 hover:text-white p-1"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm mb-4">{error}</div>}

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl bg-dark-800/60 border border-white/5 p-4"><p className="text-xs text-dark-400">Toplam Giriş (Borç)</p><p className="text-lg font-bold text-emerald-400 mt-1">{formatTL(res.toplam?.borc || 0)}</p></div>
          <div className="rounded-xl bg-dark-800/60 border border-white/5 p-4"><p className="text-xs text-dark-400">Toplam Çıkış (Alacak)</p><p className="text-lg font-bold text-red-400 mt-1">{formatTL(res.toplam?.alacak || 0)}</p></div>
          <div className="rounded-xl bg-dark-800/60 border border-white/5 p-4"><p className="text-xs text-dark-400">Net</p><p className={`text-lg font-bold mt-1 ${(res.toplam?.net || 0) < 0 ? "text-red-400" : "text-cyan-400"}`}>{formatTL(res.toplam?.net || 0)}</p></div>
        </div>

        <div className="flex items-center justify-between text-sm text-dark-400 mb-2">
          <span>{loading ? "Yükleniyor..." : `${res.total} hareket`}</span>
          {res.pageCount > 0 && <span>Sayfa {res.page} / {res.pageCount}</span>}
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-sm">
            <thead><tr className="bg-dark-800/60 text-dark-400 text-xs uppercase">
              <th className="px-3 py-2 text-left">Tarih</th><th className="px-3 py-2 text-left">İzahat</th>
              <th className="px-3 py-2 text-left">Evrak No</th><th className="px-3 py-2 text-right">Borç</th>
              <th className="px-3 py-2 text-right">Alacak</th>
            </tr></thead>
            <tbody>
              {res.data.map((h, i) => (
                <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-2 text-dark-300 font-mono text-xs">{formatDate(h.TARIH)}</td>
                  <td className="px-3 py-2 text-dark-300">{getBankaIzahat(h.IZAHAT)}</td>
                  <td className="px-3 py-2 text-dark-400 font-mono text-xs">{h.EVRAKNO}</td>
                  <td className="px-3 py-2 text-right text-emerald-400">{h.BORC ? formatTL(h.BORC) : "—"}</td>
                  <td className="px-3 py-2 text-right text-red-400">{h.ALACAK ? formatTL(h.ALACAK) : "—"}</td>
                </tr>
              ))}
              {!loading && res.data.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-dark-500">Bu hesapta hareket yok</td></tr>}
            </tbody>
          </table>
        </div>

        {res.pageCount > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 rounded-lg bg-dark-800 border border-white/10 text-white text-sm disabled:opacity-40">Önceki</button>
            <button disabled={page >= res.pageCount} onClick={() => setPage(p => p + 1)} className="px-4 py-2 rounded-lg bg-dark-800 border border-white/10 text-white text-sm disabled:opacity-40">Sonraki</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BankaRaporlari() {
  const { selectedFirma, selectedDonem } = useConnection();
  const [res, setRes] = useState({ data: [], toplam: {}, nakit: {}, kredi: {}, doviz: {}, hesapSayisi: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detayBanka, setDetayBanka] = useState(null);

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
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-dark-500">Yükleniyor...</td></tr>
              : res.data.map(b => (
                <tr key={b.IND} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setDetayBanka(b)}>
                  <td className="px-4 py-3 text-white font-medium">{b.ADI}</td>
                  <td className="px-4 py-3 text-dark-300">{b.SUBE || b.SUBEADI || "—"}</td>
                  <td className="px-4 py-3 text-dark-400 font-mono text-xs">{b.IBAN || b.HESAPNO || "—"}</td>
                  <td className="px-4 py-3">{b.DOVIZ
                    ? <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-xs font-semibold">{b.DOVIZ}</span>
                    : <span className="text-dark-300">TL</span>}</td>
                  <td className="px-4 py-3 text-right text-dark-400">{b.HAREKET}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${b.BAKIYE < 0 ? "text-red-400" : b.DOVIZ ? "text-amber-300" : "text-emerald-400"}`}>{b.DOVIZ ? formatMoney(b.BAKIYE, b.DOVIZ) : formatTL(b.BAKIYE)}</td>
                  <td className="px-4 py-3 text-right"><span className="text-violet-400 text-xs">Hareketler →</span></td>
                </tr>
              ))}
              {!loading && res.data.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-dark-500">Banka hesabı bulunamadı</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {detayBanka && <BankaHareketModal firmaNo={selectedFirma} donemNo={selectedDonem} banka={detayBanka} onClose={() => setDetayBanka(null)} />}
    </div>
  );
}
