import { useState, useEffect } from "react";
import { useConnection } from "../context/ConnectionContext";
import { apiGet, formatTL, formatMoney, formatNumber, formatDate } from "../utils/api";
import { getIzahatDetails } from "../constants/izahat";

const MODULES = [
  { id: "cari", title: "Cari Kartlar", desc: "Müşteri ve tedarikçi kartları", grad: "from-cyan-600/20 to-blue-800/20", clr: "text-cyan-400" },
  { id: "senet", title: "Senet Portföy", desc: "Alınan ve verilen senetler", grad: "from-amber-600/20 to-orange-800/20", clr: "text-amber-400" },
  { id: "banka", title: "Banka Raporları", desc: "Hesap bakiyeleri ve özetler", grad: "from-emerald-600/20 to-green-800/20", clr: "text-emerald-400" },
  { id: "bankaHareket", title: "Banka Hareketleri", desc: "Gelir ve gider hareketleri", grad: "from-violet-600/20 to-purple-800/20", clr: "text-violet-400" },
  { id: "cek", title: "Çek Raporları", desc: "Alınan ve verilen çekler", grad: "from-rose-600/20 to-red-800/20", clr: "text-rose-400" },
  { id: "satis", title: "Satış Karlılık", desc: "Stok bazlı kâr analizi", grad: "from-pink-600/20 to-fuchsia-800/20", clr: "text-pink-400" },
  { id: "tahsilat", title: "Tahsilat Raporları", desc: "Cari tahsilat ve ödemeler", grad: "from-indigo-600/20 to-blue-800/20", clr: "text-indigo-400" },
];

function StatCard({ title, value, sub, clr, grad, onClick }) {
  const clickable = typeof onClick === "function";
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${grad} p-6 shadow-xl ${clickable ? "cursor-pointer hover:scale-[1.02] hover:border-white/20 transition-all duration-200 group" : ""}`}
    >
      <p className="text-dark-300 text-xs font-semibold uppercase tracking-wider">{title}</p>
      <p className={`text-3xl font-bold mt-3 ${clr}`}>{value}</p>
      <div className="flex items-center justify-between mt-2">
        {sub && <p className="text-dark-400 text-xs">{sub}</p>}
        {clickable && <span className={`text-xs font-medium ml-auto ${clr} opacity-0 group-hover:opacity-100 transition-opacity`}>Detay →</span>}
      </div>
    </div>
  );
}

export default function Home() {
  const { selectedFirma, selectedDonem, firmalar, setCurrentPage } = useConnection();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sonIslemler, setSonIslemler] = useState([]);

  const firmaAdi = firmalar.find(f => f.FIRMANO === selectedFirma)?.FIRMAADI || "";

  useEffect(() => {
    let on = true;
    setLoading(true); setError(null);
    apiGet("/home", { firmaNo: selectedFirma, donemNo: selectedDonem })
      .then(r => { if (on) setData(r.data); })
      .catch(e => { if (on) setError(e.message); })
      .finally(() => { if (on) setLoading(false); });
    apiGet("/son-islemler", { firmaNo: selectedFirma, donemNo: selectedDonem, limit: 10 })
      .then(r => { if (on) setSonIslemler(r.data); })
      .catch(() => {});
    return () => { on = false; };
  }, [selectedFirma, selectedDonem]);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Ana Sayfa</h1>
        <p className="text-dark-400 mt-1">{firmaAdi} — Finansal durumunuza tek ekrandan bakış</p>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Toplam Nakit (Kasa)" grad="from-cyan-600/20 to-blue-800/20" clr="text-cyan-400"
          value={loading ? "…" : formatTL(data?.kasaNet || 0)}
          sub={loading ? "" : `${data?.kasaKirilim?.length || 0} kasa · devir dahil`} />
        <StatCard title="Çek Portföyü (Alınan)" grad="from-rose-600/20 to-red-800/20" clr="text-rose-400"
          onClick={() => setCurrentPage("cek")}
          value={loading ? "…" : formatTL(data?.cekAlinanTutar || 0)}
          sub={loading ? "" : `Verilen ${formatTL(data?.cekVerilenTutar || 0)} · ${formatNumber(data?.cekSayisi || 0, 0)}/${formatNumber(data?.cekCikisSayisi || 0, 0)} adet`} />
        <StatCard title="Senet Portföyü (Alınan)" grad="from-amber-600/20 to-orange-800/20" clr="text-amber-400"
          onClick={() => setCurrentPage("senet")}
          value={loading ? "…" : formatTL(data?.senetAlinanTutar || 0)}
          sub={loading ? "" : `Verilen ${formatTL(data?.senetVerilenTutar || 0)} · ${formatNumber(data?.senetSayisi || 0, 0)}/${formatNumber(data?.senetCikisSayisi || 0, 0)} adet`} />
        <StatCard title="Tahsilatlar" grad="from-violet-600/20 to-purple-800/20" clr="text-violet-400"
          onClick={() => setCurrentPage("tahsilat")}
          value={loading ? "…" : formatNumber(data?.tahsilatSayisi || 0, 0)}
          sub={loading ? "" : `Toplam ${formatTL(data?.tahsilatToplam || 0)}`} />
      </div>

      {/* Kasa kırılımı + Döviz kasaları */}
      {!loading && (() => {
      const dovizEntries = Object.entries(data?.bankaDoviz || {}).filter(([, v]) => Number(v) !== 0);
      return (data?.kasaKirilim?.length > 0 || dovizEntries.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Kasa Bakiyeleri</h3>
              <span className="text-xs text-dark-400">Net (devir dahil)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {data.kasaKirilim.map((k, i) => (
                <div key={i} className="rounded-xl border border-white/5 bg-dark-900/40 px-3 py-2.5">
                  <p className="text-dark-400 text-[11px] font-medium truncate">{k.kasa}</p>
                  <p className={`text-sm font-bold mt-0.5 ${k.net < 0 ? "text-red-400" : "text-cyan-300"}`}>{formatTL(k.net)}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold text-white mb-3">Döviz Kasaları</h3>
            {dovizEntries.length === 0 ? (
              <p className="text-dark-500 text-xs">Döviz kasası yok.</p>
            ) : (
              <div className="space-y-2">
                {dovizEntries.map(([pb, v]) => (
                  <div key={pb} className="flex items-center justify-between rounded-xl border border-amber-500/15 bg-amber-500/5 px-3 py-2">
                    <span className="text-amber-300 text-xs font-semibold">{pb}</span>
                    <span className="text-white text-sm font-bold">{formatMoney(v, pb)}</span>
                  </div>
                ))}
                <p className="text-dark-500 text-[10px] pt-1">DB'de TL alanında saklı; kur uygulanmadan gösterilir.</p>
              </div>
            )}
          </div>
        </div>
      );
      })()}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Son İşlemler</h2>
          <button onClick={() => setCurrentPage("sonIslemler")} className="text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors">Tümünü Gör →</button>
        </div>
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-dark-800/60 text-dark-400 text-xs uppercase">
                <th className="px-4 py-3 text-left">Tarih</th><th className="px-4 py-3 text-left">Cari</th>
                <th className="px-4 py-3 text-left">İşlem</th><th className="px-4 py-3 text-right">Borç</th>
                <th className="px-4 py-3 text-right">Alacak</th>
              </tr></thead>
              <tbody>
                {sonIslemler.map((h, i) => (
                  <tr key={i} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-dark-300 font-mono text-xs">{formatDate(h.TARIH)}</td>
                    <td className="px-4 py-3 text-dark-200">{h.cariUnvan || "—"}</td>
                    <td className="px-4 py-3 text-dark-300">{getIzahatDetails(parseInt(h.IZAHAT)).label}</td>
                    <td className="px-4 py-3 text-right text-red-400">{h.BORC ? formatTL(h.BORC) : "—"}</td>
                    <td className="px-4 py-3 text-right text-emerald-400">{h.ALACAK ? formatTL(h.ALACAK) : "—"}</td>
                  </tr>
                ))}
                {!loading && sonIslemler.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-dark-500">İşlem bulunamadı</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-white mb-4">Rapor Modülleri</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {MODULES.map(m => (
            <button key={m.id} onClick={() => setCurrentPage(m.id)}
              className={`text-left rounded-2xl border border-white/10 bg-gradient-to-br ${m.grad} p-5 shadow-lg hover:scale-[1.02] hover:border-white/20 transition-all duration-200`}>
              <p className="text-white font-semibold">{m.title}</p>
              <p className="text-dark-400 text-xs mt-1">{m.desc}</p>
              <p className={`text-xs font-medium mt-4 ${m.clr}`}>Detayları Gör →</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
