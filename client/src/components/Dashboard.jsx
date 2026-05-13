import { useState, useEffect, useCallback } from "react";
import { useConnection } from "../context/ConnectionContext";
import DateRangePicker from "./DateRangePicker";
import SummaryCards from "./SummaryCards";
import TransactionTable from "./TransactionTable";
import StokTable from "./StokTable";

function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const SUBE_LISTESI = [
  { id: "0", name: "Merkez" },
  { id: "1", name: "Şube 1" },
  { id: "2", name: "Şube 2" },
];

export default function Dashboard() {
  const { connectionInfo, selectedFirma, selectedDonem, disconnect, goBackToPeriodSelection, fetchSummary, fetchDetails } = useConnection();
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [subeKodu, setSubeKodu] = useState("0");
  const [summary, setSummary] = useState(null);
  const [allTimeSummary, setAllTimeSummary] = useState(null);
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null); // 'allTime' | 'selectedDate' | null

  // Yalnızca summary verilerini (All-time ve Seçili Tarih) çek
  const loadSummaries = useCallback(async (start, end, selectedSube) => {
    setLoading(true);
    setError(null);
    try {
      const [sum, sumAllTime] = await Promise.all([
        fetchSummary(start, end, selectedSube, false),
        fetchSummary(start, end, selectedSube, true),
      ]);
      setSummary(sum);
      setAllTimeSummary(sumAllTime);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchSummary]);

  // Tablo görünürse veya değişirse detayları çek
  useEffect(() => {
    if (!expandedCard) {
      setDetails([]);
      return;
    }
    
    let isMounted = true;
    const loadDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const isAllTime = expandedCard === 'allTime';
        const detData = await fetchDetails(startDate, endDate, subeKodu, isAllTime);
        if (isMounted) setDetails(detData);
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadDetails();

    return () => { isMounted = false; };
  }, [expandedCard, startDate, endDate, subeKodu, fetchDetails]);

  useEffect(() => {
    loadSummaries(startDate, endDate, subeKodu);
  }, [startDate, endDate, subeKodu, loadSummaries]);

  const handlePrevDay = () => {
    const current = new Date(startDate);
    current.setDate(current.getDate() - 1);
    const prev = current.toISOString().slice(0, 10);
    setStartDate(prev);
    setEndDate(prev);
  };

  const handleNextDay = () => {
    const current = new Date(startDate);
    current.setDate(current.getDate() + 1);
    const next = current.toISOString().slice(0, 10);
    setStartDate(next);
    setEndDate(next);
  };

  const handleToday = () => {
    setStartDate(todayStr(0));
    setEndDate(todayStr(0));
  };

  return (
    <div className="min-h-screen bg-dark-900">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Arctos ERP</h1>
              <p className="text-xs text-dark-400">
                {connectionInfo?.server} / {connectionInfo?.database}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Active Period Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20">
              <svg className="w-3.5 h-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span className="text-xs text-violet-300 font-semibold font-mono">
                Firma: {selectedFirma} | Dönem: {selectedDonem}
              </span>
            </div>

            {/* Connection badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs text-cyan-400 font-medium">Bağlı</span>
            </div>

            {/* Change Period */}
            <button
              onClick={goBackToPeriodSelection}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-dark-400 hover:text-violet-400 hover:bg-violet-500/10 border border-white/5 hover:border-violet-500/20 transition-all duration-200"
              title="Değiştir"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              <span className="hidden sm:inline">Değiştir</span>
            </button>

            {/* Disconnect */}
            <button
              onClick={disconnect}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-dark-400 hover:text-red-400 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 transition-all duration-200"
              title="Bağlantıyı Kes"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Filters Row */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 w-full">
            
            {/* Quick Date Buttons */}
            <div className="flex items-center gap-2">
              <button onClick={handlePrevDay} className="px-4 py-2 rounded-xl bg-dark-800 border border-white/10 text-white text-sm font-medium hover:bg-violet-600/20 hover:border-violet-500/50 transition-all">
                Önceki Gün
              </button>
              <button onClick={handleNextDay} className="px-4 py-2 rounded-xl bg-dark-800 border border-white/10 text-white text-sm font-medium hover:bg-violet-600/20 hover:border-violet-500/50 transition-all">
                Sonraki Gün
              </button>
              <button onClick={handleToday} className="px-4 py-2 rounded-xl bg-dark-800 border border-white/10 text-white text-sm font-medium hover:bg-violet-600/20 hover:border-violet-500/50 transition-all">
                Bugün
              </button>
            </div>

            <DateRangePicker 
              startDate={startDate} 
              endDate={endDate} 
              onStartChange={setStartDate} 
              onEndChange={setEndDate} 
            />
            
            {/* Şube Seçimi */}
            <div className="flex items-center gap-2">
              <label htmlFor="subeSelect" className="text-sm font-medium text-dark-300">Şube:</label>
              <select
                id="subeSelect"
                value={subeKodu}
                onChange={(e) => setSubeKodu(e.target.value)}
                className="bg-dark-800 border border-white/10 text-white text-sm rounded-xl focus:ring-violet-500 focus:border-violet-500 block p-2.5 outline-none transition-colors duration-200 hover:border-white/20"
              >
                {SUBE_LISTESI.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => loadSummaries(startDate, endDate, subeKodu)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-dark-300 hover:text-white bg-dark-800/60 hover:bg-dark-800 border border-white/10 transition-all duration-200 disabled:opacity-50 ml-auto"
            >
              <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              Yenile
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 animate-slide-down">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-red-300 text-sm font-medium">Sorgu Hatası</p>
              <p className="text-red-400/70 text-xs mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <SummaryCards 
          summary={summary} 
          allTimeSummary={allTimeSummary} 
          isLoading={loading && !expandedCard} // Sadece ilk yüklemede kartlarda loading göster, detay çekerken değil
          expandedCard={expandedCard}
          setExpandedCard={setExpandedCard}
        />

        {/* Transaction Table */}
        {expandedCard && (
          <div className="animate-slide-down">
            <TransactionTable 
              data={details} 
              isLoading={loading} 
              title={expandedCard === 'allTime' ? "Tüm Zamanların İşlem Detayları" : "Seçili Tarih İşlem Detayları"} 
            />
          </div>
        )}

        {/* Stok Table */}
        <StokTable />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 mt-8">
        <p className="text-center text-dark-600 text-xs">
          Arctos ERP — Smart Discovery Dashboard &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
