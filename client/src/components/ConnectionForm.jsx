import { useState } from "react";
import { useConnection } from "../context/ConnectionContext";

export default function ConnectionForm() {
  const { connect, isLoading, error } = useConnection();
  const [form, setForm] = useState({
    server: "",
    database: "",
    username: "",
    password: "",
    port: "1433",
  });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await connect(form);
    // Başarılıysa context otomatik olarak "select-period" adımına geçer
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 shadow-lg shadow-cyan-500/25 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-dark-300 bg-clip-text text-transparent">
            Arctos ERP
          </h1>
          <p className="text-dark-400 mt-2 text-sm">
            Smart Discovery — SQL Server'a bağlanın
          </p>

          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 mt-5">
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-cyan-500/30">1</div>
              <span className="text-xs font-medium text-cyan-400 hidden sm:inline">Bağlantı</span>
            </div>
            <div className="w-8 h-px bg-dark-600" />
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center text-xs font-bold text-dark-500 border border-dark-600">2</div>
              <span className="text-xs font-medium text-dark-500 hidden sm:inline">Dönem</span>
            </div>
            <div className="w-8 h-px bg-dark-600" />
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center text-xs font-bold text-dark-500 border border-dark-600">3</div>
              <span className="text-xs font-medium text-dark-500 hidden sm:inline">Dashboard</span>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="glass-card p-8 space-y-5"
        >
          {/* Server IP */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-dark-400 uppercase tracking-wider">
              Server IP / Host
            </label>
            <input
              type="text"
              name="server"
              value={form.server}
              onChange={handleChange}
              placeholder="192.168.1.7"
              required
              className="w-full px-4 py-3 rounded-xl bg-dark-900/60 border border-white/10 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-200"
            />
          </div>

          {/* Port + Database Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-dark-400 uppercase tracking-wider">
                Port
              </label>
              <input
                type="text"
                name="port"
                value={form.port}
                onChange={handleChange}
                placeholder="1433"
                className="w-full px-4 py-3 rounded-xl bg-dark-900/60 border border-white/10 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-200"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-dark-400 uppercase tracking-wider">
                Veritabanı Adı
              </label>
              <input
                type="text"
                name="database"
                value={form.database}
                onChange={handleChange}
                placeholder="VegaDB"
                required
                className="w-full px-4 py-3 rounded-xl bg-dark-900/60 border border-white/10 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-200"
              />
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-dark-400 uppercase tracking-wider">
              Kullanıcı Adı
            </label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="sa"
              required
              className="w-full px-4 py-3 rounded-xl bg-dark-900/60 border border-white/10 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-200"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-dark-400 uppercase tracking-wider">
              Şifre
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 rounded-xl bg-dark-900/60 border border-white/10 text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500/40 transition-all duration-200"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 animate-slide-down">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-dark-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-600/20 hover:shadow-cyan-500/30"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Bağlanıyor & Keşfediliyor...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                Bağlan & Keşfet
              </span>
            )}
          </button>

          {/* Footer Hint */}
          <p className="text-center text-dark-500 text-xs pt-2">
            Bağlantı sonrası TBLCARIHAREKETLERI tabloları otomatik keşfedilir
          </p>
        </form>
      </div>
    </div>
  );
}
