import { useState, useRef, useEffect } from "react";
import { useConnection } from "../context/ConnectionContext";

export default function PinLogin() {
  const { login, resetSetup, isLoading, error } = useConnection();
  const [pin, setPin] = useState("");
  const [isShaking, setIsShaking] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handlePinChange = async (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(val);

    if (val.length === 6) {
      // 6 hane olunca otomatik giriş yap
      const res = await login(val);
      if (!res.success) {
        setIsShaking(true);
        setPin("");
        setTimeout(() => setIsShaking(false), 500);
        inputRef.current?.focus();
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-dark-900">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className={`w-full max-w-sm relative glass-card p-8 text-center transition-transform ${isShaking ? 'animate-shake' : 'animate-fade-in'}`}>
        
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/25 mb-6 flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Hoş Geldiniz</h1>
        <p className="text-sm text-dark-400 mb-8">Devam etmek için 6 haneli PIN kodunuzu girin.</p>

        <div className="space-y-6">
          <input
            ref={inputRef}
            type="password"
            value={pin}
            onChange={handlePinChange}
            disabled={isLoading}
            placeholder="••••••"
            className="w-full text-center tracking-[1em] font-mono text-3xl px-4 py-4 rounded-2xl bg-dark-900/50 border border-white/10 text-white placeholder-dark-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all disabled:opacity-50"
          />

          {error && (
            <p className="text-red-400 text-sm font-medium">{error}</p>
          )}

          {isLoading && (
            <div className="flex items-center justify-center gap-2 text-violet-400 text-sm font-medium">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Giriş yapılıyor...
            </div>
          )}

          <div className="pt-6 border-t border-white/5">
            <button
              onClick={() => {
                if(window.confirm('Veritabanı bilgileri silinecek ve sistemi baştan kurmanız gerekecek. Emin misiniz?')) {
                  resetSetup();
                }
              }}
              disabled={isLoading}
              className="text-xs font-medium text-dark-500 hover:text-red-400 transition-colors underline-offset-4 hover:underline"
            >
              PIN'imi Unuttum (Ayarları Sıfırla)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
