import { useConnection } from "../context/ConnectionContext";

const NAV = [
  { id: "home", label: "Ana Sayfa", icon: "M2.25 12l8.954-8.955a1.5 1.5 0 012.122 0L21 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" },
  { id: "sonIslemler", label: "Son İşlemler", icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" },
  { id: "cari", label: "Cari Kartlar", icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" },
  { id: "senet", label: "Senet Portföy", icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" },
  { id: "banka", label: "Banka Raporları", icon: "M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" },
  { id: "bankaHareket", label: "Banka Hareket Raporu", icon: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" },
  { id: "visa", label: "Visa Raporları", icon: "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" },
  { id: "cek", label: "Çek Raporları", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
  { id: "satis", label: "Satış Karlılık Raporu", icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" },
  { id: "gunluk", label: "Günlük Özet", icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" },
];

export default function Sidebar() {
  const { firmalar, donemler, selectedFirma, selectedDonem, currentPage, setCurrentPage, switchFirma, switchDonem, disconnect } = useConnection();

  const firma = firmalar.find(f => f.FIRMANO === selectedFirma);
  const firmaDonemler = donemler.filter(d => String(d.FIND) === String(firma?.IND));

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 flex flex-col bg-dark-900 border-r border-white/5">
      {/* Logo */}
      <div className="p-5 border-b border-white/5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">Finansal Raporlama</h1>
          <p className="text-[10px] text-dark-400">ERP Dashboard</p>
        </div>
      </div>

      {/* Firma / Dönem seçimi */}
      <div className="p-4 space-y-3 border-b border-white/5">
        <div>
          <label className="block text-[10px] font-semibold text-dark-500 uppercase tracking-wider mb-1">Firma Seçimi</label>
          <select
            value={selectedFirma || ""}
            onChange={(e) => switchFirma(e.target.value)}
            className="w-full bg-dark-800 border border-white/10 text-white text-sm rounded-lg p-2 outline-none focus:border-violet-500 transition-colors"
          >
            {firmalar.map(f => <option key={f.FIRMANO} value={f.FIRMANO}>{f.FIRMAADI}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-dark-500 uppercase tracking-wider mb-1">Dönem Seçimi</label>
          <select
            value={selectedDonem || ""}
            onChange={(e) => switchDonem(e.target.value)}
            className="w-full bg-dark-800 border border-white/10 text-white text-sm rounded-lg p-2 outline-none focus:border-violet-500 transition-colors"
          >
            {firmaDonemler.map(d => <option key={d.DONEMNO} value={d.DONEMNO}>{d.DONEM} Dönemi</option>)}
          </select>
        </div>
      </div>

      {/* Menü */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
        {NAV.map(item => {
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left ${
                active ? "bg-violet-500/15 text-violet-300 border border-violet-500/30" : "text-dark-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Çıkış */}
      <div className="p-3 border-t border-white/5">
        <button
          onClick={disconnect}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Çıkış
        </button>
      </div>
    </aside>
  );
}
