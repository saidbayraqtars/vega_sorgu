import { useState, useEffect } from "react";
import { useConnection } from "../context/ConnectionContext";
import { apiGet, formatDate, formatTL } from "../utils/api";

// Tahsil/ödeme durumu etiketi. Verilen çek: VCEKISLEM (Ödenecek / Çek Ödenmiş /
// Çek İade). Alınan çek: TAHSILDURUMU ('Tahsilat Yok' = portföyde).
function durumBadge(row) {
  const raw = (row.DURUM || "").trim();
  if (!raw) return null;
  const text = /yok/i.test(raw) ? "Portföyde" : raw;
  const cls = /iade/i.test(raw) ? "bg-rose-500/15 text-rose-300"
            : /(ödenecek|yok)/i.test(raw) ? "bg-amber-500/15 text-amber-300"
            : "bg-emerald-500/15 text-emerald-300";
  return { text, cls };
}

function CekDetayModal({ cek, onClose }) {
  const verilen = cek._yon === "cikis";
  const s = durumBadge(cek);
  const rows = [
    ["Belge No", cek.BELGENO],
    ["Tutar", cek.TUTAR != null ? formatTL(cek.TUTAR) : null],
    ["Durum", s ? s.text : null],
    ["Vade", formatDate(cek.VADE)],
    ["Keşideci", cek.KESIDEEDEN],
    ["Cari", cek.cariUnvan],
    ["Banka", cek.bankaAdi],
    ["Şube", cek.SUBE],
    ["Keşide Yeri", cek.KESIDEYERI],
    ["Banka Hesap No", cek.BANKAHESAPNO],
    ["Keşide Tarihi", formatDate(cek.KESIDETARIHI)],
    ["Evrak No", cek.EVRAKNO],
    ["Takip No", cek.TAKIPNO],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg glass-card p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-white">{verilen ? "Verilen Çek" : "Alınan Çek"}</h2>
            <p className="text-dark-400 text-sm">Belge No: {cek.BELGENO || "—"}</p>
          </div>
          <button onClick={onClose} className="text-dark-400 hover:text-white p-1"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {rows.map(([lbl, v]) => (
            <div key={lbl}>
              <p className="text-dark-500 text-xs">{lbl}</p>
              <p className="text-dark-100 text-sm mt-0.5 break-words">{v || v === 0 ? v : "—"}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CekRaporlari() {
  const { selectedFirma, selectedDonem } = useConnection();
  const [yonFilter, setYonFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [detay, setDetay] = useState(null);

  // Alınan + verilen tek listede — iki yön birden çekilir, satırlara yön işaretlenir.
  useEffect(() => {
    let on = true;
    setLoading(true); setError(null);
    Promise.all([
      apiGet("/cek", { firmaNo: selectedFirma, donemNo: selectedDonem, yon: "giris" }),
      apiGet("/cek", { firmaNo: selectedFirma, donemNo: selectedDonem, yon: "cikis" }),
    ])
      .then(([g, c]) => {
        if (!on) return;
        const merged = [
          ...(g.data || []).map(r => ({ ...r, _yon: "giris" })),
          ...(c.data || []).map(r => ({ ...r, _yon: "cikis" })),
        ].sort((a, b) => new Date(b.VADE || b.KESIDETARIHI || 0) - new Date(a.VADE || a.KESIDETARIHI || 0));
        setRows(merged);
      })
      .catch(e => { if (on) setError(e.message); })
      .finally(() => { if (on) setLoading(false); });
    return () => { on = false; };
  }, [selectedFirma, selectedDonem]);

  const filtered = rows.filter(c => {
    if (yonFilter !== "all" && c._yon !== yonFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (c.BELGENO || "").toLowerCase().includes(q) || (c.KESIDEEDEN || "").toLowerCase().includes(q) || (c.cariUnvan || "").toLowerCase().includes(q);
  });
  const toplam = filtered.reduce((s, c) => s + (Number(c.TUTAR) || 0), 0);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Çek Raporları</h1>
        <p className="text-dark-400 mt-1">Alınan ve verilen çekler tek listede — verilen çeklerde yalnızca ödenecek olanlar. Detay için satıra tıklayın.</p>
      </div>

      <div className="glass-card p-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg overflow-hidden border border-white/10">
          {[["all", "Tümü"], ["giris", "Alınan (Aldı)"], ["cikis", "Verilen (Verdi)"]].map(([v, l]) => (
            <button key={v} onClick={() => setYonFilter(v)} className={`px-4 py-2 text-sm font-medium transition-colors ${yonFilter === v ? "bg-violet-600 text-white" : "bg-dark-800 text-dark-300 hover:bg-dark-700"}`}>{l}</button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Belge no, keşideci veya cari ara..."
          className="flex-1 min-w-[200px] px-4 py-2 rounded-lg bg-dark-900/60 border border-white/10 text-white text-sm placeholder-dark-500 focus:outline-none focus:border-violet-500/50" />
        <span className="text-sm text-dark-400">{loading ? "Yükleniyor..." : `${filtered.length} kayıt`}</span>
        <span className="text-sm text-dark-300">Toplam: <span className="font-bold text-amber-400">{formatTL(toplam)}</span></span>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-dark-800/60 text-dark-400 text-xs uppercase">
              <th className="px-4 py-3 text-left">Yön</th><th className="px-4 py-3 text-left">Belge No</th>
              <th className="px-4 py-3 text-left">Keşideci</th><th className="px-4 py-3 text-left">Cari</th>
              <th className="px-4 py-3 text-left">Banka / Şube</th><th className="px-4 py-3 text-left">Vade</th>
              <th className="px-4 py-3 text-left">Durum</th><th className="px-4 py-3 text-right">Tutar</th>
              <th className="px-4 py-3"></th>
            </tr></thead>
            <tbody>
              {filtered.map((c, i) => {
                const s = durumBadge(c);
                return (
                  <tr key={i} className="border-t border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setDetay(c)}>
                    <td className="px-4 py-3">{c._yon === "cikis"
                      ? <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 text-xs font-semibold">Verdi</span>
                      : <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 text-xs font-semibold">Aldı</span>}</td>
                    <td className="px-4 py-3 text-white font-mono text-xs">{c.BELGENO}</td>
                    <td className="px-4 py-3 text-dark-200">{c.KESIDEEDEN || "—"}</td>
                    <td className="px-4 py-3 text-dark-300">{c.cariUnvan || "—"}</td>
                    <td className="px-4 py-3 text-dark-400">{c.bankaAdi || "—"}{c.SUBE ? <span className="text-dark-500"> / {c.SUBE}</span> : ""}</td>
                    <td className="px-4 py-3 text-dark-300 font-mono text-xs">{formatDate(c.VADE || c.KESIDETARIHI)}</td>
                    <td className="px-4 py-3">{s
                      ? <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${s.cls}`}>{s.text}</span>
                      : <span className="text-dark-500">—</span>}</td>
                    <td className="px-4 py-3 text-right text-amber-400 font-semibold">{c.TUTAR != null ? formatTL(c.TUTAR) : "—"}</td>
                    <td className="px-4 py-3 text-right"><span className="text-violet-400 text-xs">Detay →</span></td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-dark-500">Çek kaydı bulunamadı</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {detay && <CekDetayModal cek={detay} onClose={() => setDetay(null)} />}
    </div>
  );
}
