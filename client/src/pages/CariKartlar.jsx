import { useState, useEffect } from "react";
import { useConnection } from "../context/ConnectionContext";
import { apiGet, formatTL, formatDate } from "../utils/api";
import { getIzahatDetails } from "../constants/izahat";

function DetayModal({ firmaNo, donemNo, ind, onClose }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let on = true;
    apiGet("/cari/detail", { firmaNo, donemNo, ind })
      .then(r => { if (on) setD(r.data); })
      .catch(e => { if (on) setError(e.message); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [firmaNo, donemNo, ind]);

  const k = d?.kart;
  const o = d?.ozet;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar glass-card p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-white">{k ? (k.UNVAN || k.FIRMAADI) : "Yükleniyor..."}</h2>
            <p className="text-dark-400 text-sm">Cari No: {ind}{k?.FIRMAKODU ? ` — ${k.FIRMAKODU}` : ""}</p>
          </div>
          <button onClick={onClose} className="text-dark-400 hover:text-white p-1"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {loading ? <p className="text-dark-400">Yükleniyor...</p> : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="rounded-xl bg-dark-800/60 border border-white/5 p-4">
                <p className="text-xs text-dark-400">Toplam Giriş (Borç)</p>
                <p className="text-xl font-bold text-red-400 mt-1">{formatTL(o.giris)}</p>
              </div>
              <div className="rounded-xl bg-dark-800/60 border border-white/5 p-4">
                <p className="text-xs text-dark-400">Toplam Çıkış (Alacak)</p>
                <p className="text-xl font-bold text-emerald-400 mt-1">{formatTL(o.cikis)}</p>
              </div>
              <div className="rounded-xl bg-dark-800/60 border border-white/5 p-4">
                <p className="text-xs text-dark-400">Net Bakiye ({o.islem} işlem)</p>
                <p className={`text-xl font-bold mt-1 ${o.net < 0 ? "text-red-400" : "text-cyan-400"}`}>{formatTL(o.net)}</p>
              </div>
            </div>

            {k && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 mb-6 text-sm">
                {[["Yetkili", k.YETKILI], ["Vergi Dairesi", k.VERGIDAIRESI], ["Vergi No", k.VERGINO],
                  ["Telefon", k.TELEFON1], ["İl/Şehir", k.SEHIR || k.IL], ["Para Birimi", k.PARABIRIMI]]
                  .filter(([, v]) => v).map(([lbl, v]) => (
                  <div key={lbl}><p className="text-dark-500 text-xs">{lbl}</p><p className="text-dark-200">{v}</p></div>
                ))}
              </div>
            )}

            <h3 className="text-sm font-semibold text-white mb-2">Hareketler ({d.hareketler.length})</h3>
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-sm">
                <thead><tr className="bg-dark-800/60 text-dark-400 text-xs uppercase">
                  <th className="px-3 py-2 text-left">Tarih</th><th className="px-3 py-2 text-left">İzahat</th>
                  <th className="px-3 py-2 text-left">Evrak No</th><th className="px-3 py-2 text-right">Borç</th>
                  <th className="px-3 py-2 text-right">Alacak</th>
                </tr></thead>
                <tbody>
                  {d.hareketler.map((h, i) => (
                    <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                      <td className="px-3 py-2 text-dark-300 font-mono text-xs">{formatDate(h.TARIH)}</td>
                      <td className="px-3 py-2 text-dark-300">{getIzahatDetails(parseInt(h.IZAHAT)).label}</td>
                      <td className="px-3 py-2 text-dark-400 font-mono text-xs">{h.EVRAKNO}</td>
                      <td className="px-3 py-2 text-right text-red-400">{h.BORC ? formatTL(h.BORC) : "—"}</td>
                      <td className="px-3 py-2 text-right text-emerald-400">{h.ALACAK ? formatTL(h.ALACAK) : "—"}</td>
                    </tr>
                  ))}
                  {d.hareketler.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-dark-500">Bu dönemde hareket yok</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const BAKIYE_FILTRELER = [
  ["", "Tümü"],
  ["borclu", "Borçlu (bize borçlu)"],
  ["alacakli", "Alacaklı (biz borçluyuz)"],
  ["bakiyesiz", "Bakiyesiz"],
];
const SIRALAMALAR = [
  ["ad", "Ada göre (A→Z)"],
  ["bakiyeDesc", "Bakiye (yüksek → düşük)"],
  ["bakiyeAsc", "Bakiye (düşük → yüksek)"],
];

export default function CariKartlar() {
  const { selectedFirma, selectedDonem } = useConnection();
  const [search, setSearch] = useState("");
  const [bakiye, setBakiye] = useState("");
  const [bakiyeli, setBakiyeli] = useState(false);
  const [sort, setSort] = useState("ad");
  const [page, setPage] = useState(1);
  const [res, setRes] = useState({ data: [], total: 0, pageCount: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detayInd, setDetayInd] = useState(null);

  useEffect(() => { setPage(1); }, [search, selectedFirma, bakiye, bakiyeli, sort]);

  useEffect(() => {
    let on = true;
    setLoading(true); setError(null);
    apiGet("/cari/list", { firmaNo: selectedFirma, search, page, bakiye, sort, bakiyeli: bakiyeli ? "1" : "" })
      .then(r => { if (on) setRes(r); })
      .catch(e => { if (on) setError(e.message); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [selectedFirma, search, page, bakiye, bakiyeli, sort]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Cari Kartlar</h1>
        <p className="text-dark-400 mt-1">Cari kart listesi ve detayları</p>
      </div>

      <div className="glass-card p-5">
        <label className="block text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Cari Ara (Firma Adı, Kodu veya No)</label>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Örn: Firma adı, kodu veya no..."
          className="w-full px-4 py-3 rounded-xl bg-dark-900/60 border border-white/10 text-white placeholder-dark-500 focus:outline-none focus:border-violet-500/50 transition-all" />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {BAKIYE_FILTRELER.map(([v, l]) => (
              <button key={v} onClick={() => setBakiye(v)}
                className={`px-3 py-2 text-xs font-medium transition-colors ${bakiye === v ? "bg-violet-600 text-white" : "bg-dark-800 text-dark-300 hover:bg-dark-700"}`}>{l}</button>
            ))}
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="px-3 py-2 rounded-lg bg-dark-800 border border-white/10 text-dark-200 text-xs focus:outline-none focus:border-violet-500/50">
            {SIRALAMALAR.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800 border border-white/10 text-dark-200 text-xs cursor-pointer select-none hover:bg-dark-700">
            <input type="checkbox" checked={bakiyeli} onChange={e => setBakiyeli(e.target.checked)}
              className="w-4 h-4 rounded accent-violet-600" />
            Sadece bakiyesi olanlar
          </label>
        </div>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

        <div className="mt-4 flex items-center justify-between text-sm text-dark-400">
          <span>{loading ? "Yükleniyor..." : `${res.total} sonuç bulundu`}</span>
          {res.pageCount > 0 && <span>Sayfa {res.page} / {res.pageCount}</span>}
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-sm">
            <thead><tr className="bg-dark-800/60 text-dark-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">Cari No</th><th className="px-4 py-3 text-left">Firma Adı</th>
              <th className="px-4 py-3 text-right">Bakiye</th><th className="px-4 py-3 text-left">Para B.</th><th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {res.data.map(c => (
                <tr key={c.IND} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setDetayInd(c.IND)}>
                  <td className="px-4 py-3 text-dark-400 font-mono">{c.FIRMAKODU || c.IND}</td>
                  <td className="px-4 py-3 text-white font-medium">{c.UNVAN}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${c.BAKIYE < 0 ? "text-red-400" : "text-emerald-400"}`}>{formatTL(c.BAKIYE)}</td>
                  <td className="px-4 py-3 text-dark-400">{c.PARABIRIMI || "TL"}</td>
                  <td className="px-4 py-3 text-right"><span className="text-violet-400 text-xs">Detay →</span></td>
                </tr>
              ))}
              {!loading && res.data.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-dark-500">Sonuç bulunamadı</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-lg bg-dark-800 border border-white/10 text-white text-sm disabled:opacity-40 hover:bg-dark-700 transition-colors">Önceki</button>
          <button disabled={page >= res.pageCount} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-lg bg-dark-800 border border-white/10 text-white text-sm disabled:opacity-40 hover:bg-dark-700 transition-colors">Sonraki</button>
        </div>
      </div>

      {detayInd && <DetayModal firmaNo={selectedFirma} donemNo={selectedDonem} ind={detayInd} onClose={() => setDetayInd(null)} />}
    </div>
  );
}
