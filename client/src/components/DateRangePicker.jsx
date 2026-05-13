export default function DateRangePicker({ startDate, endDate, onStartChange, onEndChange }) {
  
  const handleShortcut = (type) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (type === "week") {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
      start.setDate(diff);
    } else if (type === "month") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (type === "year") {
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
    }

    // YYYY-MM-DD formatında al, lokasyona göre kayma yaşamamak için
    const formatDate = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    onStartChange(formatDate(start));
    onEndChange(formatDate(end));
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      {/* Shortcuts */}
      <div className="flex items-center gap-2 bg-dark-800/40 p-1 rounded-xl border border-white/5">
        <button onClick={() => handleShortcut("week")} className="px-3 py-1.5 text-xs font-medium text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg transition-all">Bu Hafta</button>
        <button onClick={() => handleShortcut("month")} className="px-3 py-1.5 text-xs font-medium text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg transition-all">Bu Ay</button>
        <button onClick={() => handleShortcut("year")} className="px-3 py-1.5 text-xs font-medium text-dark-300 hover:text-white hover:bg-dark-700 rounded-lg transition-all">Bu Yıl</button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 text-dark-400 mr-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>
        </div>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartChange(e.target.value)}
          className="px-3 py-2 rounded-xl bg-dark-800/60 border border-white/10 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200 cursor-pointer hover:bg-dark-800/80"
        />
        <span className="text-dark-400">-</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndChange(e.target.value)}
          className="px-3 py-2 rounded-xl bg-dark-800/60 border border-white/10 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-all duration-200 cursor-pointer hover:bg-dark-800/80"
        />
      </div>
    </div>
  );
}
