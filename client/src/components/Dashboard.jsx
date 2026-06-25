import { useState, useEffect, useCallback } from "react";
import { useConnection } from "../context/ConnectionContext";
import DateRangePicker from "./DateRangePicker";
import SummaryCards from "./SummaryCards";
import TransactionTable from "./TransactionTable";

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// "2026-05-22" → "22 Mayıs 2026, Perşembe"
function readableDate(str) {
  if (!str) return "";
  const d = new Date(str + "T00:00:00");
  if (isNaN(d)) return str;
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" });
}

const fmtTL = (n) => (Number(n) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₺";

export default function Dashboard() {
  const { fetchSummary, fetchDetails } = useConnection();
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [summary, setSummary] = useState(null);
  const [allTimeSummary, setAllTimeSummary] = useState(null);
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null); // 'allTime' | 'nakit' | 'ciro' | 'tahsilat' | 'alis' | null

  const loadSummaries = useCallback(async (start, end) => {
    setLoading(true);
    setError(null);
    try {
      const [sum, sumAllTime] = await Promise.all([
        fetchSummary(start, end, false),
        fetchSummary(start, end, true),
      ]);
      setSummary(sum);
      setAllTimeSummary(sumAllTime);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchSummary]);

  useEffect(() => {
    if (!expandedCard) { setDetails([]); return; }
    let isMounted = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const isAllTime = expandedCard === "allTime";
        const detData = await fetchDetails(startDate, endDate, expandedCard, isAllTime);
        if (isMounted) setDetails(detData);
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [expandedCard, startDate, endDate, fetchDetails]);

  useEffect(() => {
    loadSummaries(startDate, endDate);
  }, [startDate, endDate, loadSummaries]);

  const shiftDay = (delta) => {
    const c = new Date(startDate);
    c.setDate(c.getDate() + delta);
    const s = c.toISOString().slice(0, 10);
    setStartDate(s); setEndDate(s);
  };
  const handleToday = () => { setStartDate(todayStr(0)); setEndDate(todayStr(0)); };

  // Başlıkta gösterilecek okunur tarih: tek gün ise "22 Mayıs 2026, Perşembe", aralık ise "… – …"
  const dateLabel = startDate === endDate
    ? readableDate(startDate)
    : `${readableDate(startDate)}  –  ${readableDate(endDate)}`;
  const isToday = startDate === endDate && startDate === todayStr(0);

  // Günün net kasa durumu (giriş − çıkış)
  const nakitNet = Number(summary?.nakitNet) || 0;

  // Seçili günde hiç hareket var mı? (özet yüklendiyse ve hiçbir kalemde değer yoksa)
  const hasActivity = !!summary && (
    (summary.izahatGroup?.length || 0) > 0 ||
    Number(summary.nakitGelir) || Number(summary.nakitGider) || Number(summary.ciro)
  );
  const showEmpty = !loading && !expandedCard && summary && !hasActivity;

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">Günlük Özet</h1>
          <p className="text-dark-400 mt-1 flex items-center gap-2">
            <span className="capitalize">{dateLabel}</span>
            {isToday && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30">Bugün</span>}
          </p>
        </div>
        {!loading && summary && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold ${nakitNet >= 0 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-red-500/10 border-red-500/30 text-red-300"}`}>
            <span className="text-xs font-normal text-dark-300">Günün Net Kasası</span>
            <span>{nakitNet >= 0 ? "▲" : "▼"} {fmtTL(nakitNet)}</span>
          </div>
        )}
      </div>

      {/* Tarih kontrolleri */}
      <div className="glass-card p-5 flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="flex items-center gap-2">
          <button onClick={() => shiftDay(-1)} className="px-4 py-2 rounded-xl bg-dark-800 border border-white/10 text-white text-sm font-medium hover:bg-violet-600/20 hover:border-violet-500/50 transition-all">‹ Önceki Gün</button>
          <button onClick={handleToday} className="px-4 py-2 rounded-xl bg-dark-800 border border-white/10 text-white text-sm font-medium hover:bg-violet-600/20 hover:border-violet-500/50 transition-all">Bugün</button>
          <button onClick={() => shiftDay(1)} className="px-4 py-2 rounded-xl bg-dark-800 border border-white/10 text-white text-sm font-medium hover:bg-violet-600/20 hover:border-violet-500/50 transition-all">Sonraki Gün ›</button>
        </div>
        <DateRangePicker startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} />
        <button onClick={() => loadSummaries(startDate, endDate)} disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-dark-300 hover:text-white bg-dark-800/60 hover:bg-dark-800 border border-white/10 transition-all disabled:opacity-50 lg:ml-auto">
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </svg>
          Yenile
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div><p className="text-red-300 text-sm font-medium">Sorgu Hatası</p><p className="text-red-400/70 text-xs mt-1">{error}</p></div>
        </div>
      )}

      <SummaryCards
        summary={summary}
        allTimeSummary={allTimeSummary}
        isLoading={loading && !expandedCard}
        expandedCard={expandedCard}
        setExpandedCard={setExpandedCard}
      />

      {showEmpty && (
        <div className="flex flex-col items-center justify-center gap-2 py-10 rounded-2xl border border-dashed border-white/10 bg-dark-800/30 text-center">
          <svg className="w-10 h-10 text-dark-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
          <p className="text-dark-300 font-medium">Bu günde işlem yok</p>
          <p className="text-dark-500 text-xs">Farklı bir gün seçin veya tarih aralığını genişletin</p>
        </div>
      )}

      {expandedCard && (
        <div className="animate-slide-down">
          <TransactionTable
            data={details}
            isLoading={loading}
            expandedCard={expandedCard}
            title={
              expandedCard === "allTime" ? "Tüm Zamanların Cari Hareketleri" :
              expandedCard === "nakit" ? "Kasa Nakit Hareketleri" :
              expandedCard === "tahsilat" ? "Tahsilat Detayları" :
              expandedCard === "alis" ? "Alış Faturası Detayları" :
              expandedCard === "ciro" ? "Satış (Ciro) Detayları" :
              "İşlem Detayları"
            }
          />
        </div>
      )}
    </div>
  );
}
