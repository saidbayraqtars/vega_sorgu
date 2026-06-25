import { useEffect, useRef } from "react";

function AnimatedNumber({ value, suffix = "" }) {
  const ref = useRef(null);
  const prev = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = prev.current, end = value, dur = 800, t0 = performance.now();
    function tick(now) {
      const p = Math.min((now - t0) / dur, 1);
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = (start + (end - start) * e).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    prev.current = end;
  }, [value, suffix]);

  return <span ref={ref}>0,00{suffix}</span>;
}

export default function SummaryCards({ summary, allTimeSummary, isLoading, expandedCard, setExpandedCard }) {
  // Tüm zamanlar kapsamındaki kart — günlük kartlardan ayrı bir şeritte gösterilir
  const allTimeCard = {
    id: "allTime", title: "Cari Net Pozisyon", emoji: "🏛️", value: allTimeSummary?.cariNet ?? 0,
    grad: "from-blue-600/20 to-indigo-800/20", border: "border-blue-500/20",
    iconBg: "bg-blue-500/15", valClr: "text-blue-400",
    subtitle: `Alacak ${(allTimeSummary?.cariAlacak ?? 0).toLocaleString("tr-TR")} ₺  ·  Borç ${(allTimeSummary?.cariBorc ?? 0).toLocaleString("tr-TR")} ₺`,
  };

  // Seçili güne ait kartlar
  const cards = [
    {
      id: "nakit", title: "Günlük Nakit (Kasa)", emoji: "💵", value: summary?.nakitNet ?? 0,
      icon: <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>,
      grad: "from-emerald-600/20 to-emerald-800/20", border: "border-emerald-500/20",
      iconBg: "bg-emerald-500/15", iconClr: "text-emerald-400", valClr: "text-emerald-400",
      subtitle: `Giriş ${(summary?.nakitGelir ?? 0).toLocaleString("tr-TR")} / Çıkış ${(summary?.nakitGider ?? 0).toLocaleString("tr-TR")}`,
    },
    {
      id: "ciro", title: "Günlük Ciro (Satış)", emoji: "📈", value: summary?.ciro ?? 0,
      icon: <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>,
      grad: "from-purple-500/20 to-pink-700/20", border: "border-purple-500/20",
      iconBg: "bg-purple-500/15", iconClr: "text-purple-400", valClr: "text-purple-400",
      subtitle: "Satış faturaları (izahat 21)",
    },
    {
      id: "tahsilat", title: "Günlük Tahsilat", emoji: "💳", value: summary?.tahsilat ?? 0,
      icon: <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>,
      grad: "from-amber-500/20 to-orange-700/20", border: "border-amber-500/20",
      iconBg: "bg-amber-500/15", iconClr: "text-amber-400", valClr: "text-amber-400",
      subtitle: "Cari giriş / tahsilat (izahat 13)",
    },
    {
      id: "alis", title: "Günlük Alış", emoji: "🛒", value: summary?.alis ?? 0,
      icon: <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>,
      grad: "from-rose-500/20 to-red-700/20", border: "border-rose-500/20",
      iconBg: "bg-rose-500/15", iconClr: "text-rose-400", valClr: "text-rose-400",
      subtitle: "Alış faturaları (izahat 20)",
    }
  ];

  const renderCard = (c, i) => {
    const isSelected = expandedCard === c.id;
    return (
      <div
        key={c.id}
        onClick={() => setExpandedCard(isSelected ? null : c.id)}
        className={`relative overflow-hidden rounded-2xl border ${isSelected ? "border-violet-500 shadow-violet-500/30 scale-[1.02]" : c.border} bg-gradient-to-br ${c.grad} backdrop-blur-xl p-6 shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl animate-slide-up cursor-pointer group`}
        style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}
      >
        <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full ${c.iconBg} blur-2xl opacity-40 transition-opacity group-hover:opacity-70`} />
        <div className="relative z-10 flex items-start justify-between">
          <div className="space-y-3 w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{c.emoji}</span>
                <p className="text-dark-400 text-sm font-medium tracking-wide">{c.title}</p>
              </div>
              {isSelected && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                </span>
              )}
            </div>
            {isLoading ? (
              <div className="skeleton h-10 w-48 rounded-lg" />
            ) : (
              <p className={`text-3xl lg:text-4xl font-bold ${c.valClr} number-animate`}>
                <AnimatedNumber value={c.value} suffix=" ₺" />
              </p>
            )}
            <div className="flex items-center justify-between">
              <p className="text-dark-600 text-xs font-mono">{c.subtitle}</p>
              <p className={`text-xs font-medium transition-colors ${isSelected ? "text-violet-400" : "text-dark-500 group-hover:text-white/70"}`}>
                {isSelected ? "Kapat" : "Detayları Gör"}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Genel durum şeridi — tüm zamanlar kapsamı */}
      <div>
        <p className="text-[10px] font-semibold text-dark-500 uppercase tracking-wider mb-2">Genel Durum (Tüm Zamanlar)</p>
        {renderCard(allTimeCard, 0)}
      </div>

      {/* Günlük özet kartları */}
      <div>
        <p className="text-[10px] font-semibold text-dark-500 uppercase tracking-wider mb-2">Seçili Gün</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {cards.map((c, i) => renderCard(c, i + 1))}
        </div>
      </div>
    </div>
  );
}
