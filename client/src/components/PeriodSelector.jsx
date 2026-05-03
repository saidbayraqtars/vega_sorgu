import { useState } from "react";
import { useConnection } from "../context/ConnectionContext";

// Tablo adından kullanıcı dostu dönem etiketi çıkar
function parseTableLabel(tableName) {
  // Örn: S01TBLCARIHAREKETLERI → "S01"
  // Örn: S02TBLCARIHAREKETLERI → "S02"
  const prefix = tableName.replace("TBLCARIHAREKETLERI", "");
  if (!prefix) return { prefix: "—", label: tableName };

  // Sayısal kısım varsa dönem numarası çıkar
  const numMatch = prefix.match(/(\d+)/);
  const periodNum = numMatch ? parseInt(numMatch[1]) : null;

  return {
    prefix: prefix.toUpperCase(),
    label: periodNum !== null ? `Dönem ${periodNum}` : prefix,
    full: tableName,
  };
}

export default function PeriodSelector() {
  const { connectionInfo, discoveredTables, selectPeriod, disconnect } = useConnection();
  const [selected, setSelected] = useState(discoveredTables[0] || "");
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const parsedTables = discoveredTables.map(parseTableLabel);

  const handleContinue = () => {
    if (selected) {
      selectPeriod(selected);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-600 shadow-lg shadow-violet-500/25 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-dark-300 bg-clip-text text-transparent">
            Dönem Seçimi
          </h1>
          <p className="text-dark-400 mt-2 text-sm">
            Aktif döneminizi seçin
          </p>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 mt-5">
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs font-bold text-cyan-400 border border-cyan-500/30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <span className="text-xs font-medium text-cyan-400/60 hidden sm:inline">Bağlantı</span>
            </div>
            <div className="w-8 h-px bg-cyan-500/30" />
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-violet-500/30">2</div>
              <span className="text-xs font-medium text-violet-400 hidden sm:inline">Dönem</span>
            </div>
            <div className="w-8 h-px bg-dark-600" />
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center text-xs font-bold text-dark-500 border border-dark-600">3</div>
              <span className="text-xs font-medium text-dark-500 hidden sm:inline">Dashboard</span>
            </div>
          </div>
        </div>

        {/* Connection Info Badge */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs text-cyan-400 font-medium">
              {connectionInfo?.server} / {connectionInfo?.database}
            </span>
          </div>
        </div>

        {/* Period Selection Card */}
        <div className="glass-card p-8 space-y-6">
          {/* Found Tables Info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <svg className="w-5 h-5 text-violet-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            <p className="text-violet-300 text-sm">
              <span className="font-semibold">{discoveredTables.length}</span> dönem tablosu keşfedildi
            </p>
          </div>

          {/* Table Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-dark-400 uppercase tracking-wider">
              Aktif Dönem Tablosu
            </label>

            {/* Radio-style table cards */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
              {parsedTables.map((t, idx) => (
                <button
                  key={t.full}
                  type="button"
                  onClick={() => setSelected(t.full)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left ${
                    selected === t.full
                      ? "bg-violet-500/15 border-violet-500/40 shadow-lg shadow-violet-500/10"
                      : hoveredIdx === idx
                      ? "bg-dark-800/80 border-white/15"
                      : "bg-dark-900/40 border-white/5 hover:border-white/10"
                  }`}
                >
                  {/* Radio indicator */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                    selected === t.full
                      ? "border-violet-400 bg-violet-500"
                      : "border-dark-500"
                  }`}>
                    {selected === t.full && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>

                  {/* Prefix badge */}
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all duration-200 ${
                    selected === t.full
                      ? "bg-violet-500/25 text-violet-300"
                      : "bg-dark-700 text-dark-400"
                  }`}>
                    {t.prefix}
                  </div>

                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate transition-colors duration-200 ${
                      selected === t.full ? "text-white" : "text-dark-300"
                    }`}>
                      {t.label}
                    </p>
                    <p className="text-xs text-dark-500 truncate font-mono mt-0.5">{t.full}</p>
                  </div>

                  {/* Selected check */}
                  {selected === t.full && (
                    <svg className="w-5 h-5 text-violet-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!selected}
            className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-dark-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-600/20 hover:shadow-violet-500/30"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
              Dönemi Seç ve Devam Et
            </span>
          </button>

          {/* Disconnect */}
          <button
            onClick={disconnect}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-dark-400 hover:text-red-400 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 transition-all duration-200"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Bağlantıyı Kes
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
