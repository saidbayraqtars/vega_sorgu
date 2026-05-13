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
  const cards = [
    {
      id: "allTime", title: "Genel Kasa Toplamı", emoji: "🏛️", value: allTimeSummary?.toplamNakit ?? 0,
      icon: <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>,
      grad: "from-blue-600/20 to-indigo-800/20", border: "border-blue-500/20",
      iconBg: "bg-blue-500/15", iconClr: "text-blue-400", valClr: "text-blue-400",
      subtitle: "Tüm zamanların bakiyesi",
    },
    {
      id: "selectedDate", title: "Seçili Tarih Toplamı", emoji: "💵", value: summary?.toplamNakit ?? 0,
      icon: <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>,
      grad: "from-emerald-600/20 to-emerald-800/20", border: "border-emerald-500/20",
      iconBg: "bg-emerald-500/15", iconClr: "text-emerald-400", valClr: "text-emerald-400",
      subtitle: "Nakit İşlemler",
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
      {cards.map((c, i) => {
        const isSelected = expandedCard === c.id;
        return (
          <div 
            key={c.id} 
            onClick={() => setExpandedCard(isSelected ? null : c.id)}
            className={`relative overflow-hidden rounded-2xl border ${isSelected ? "border-violet-500 shadow-violet-500/30 scale-[1.02]" : c.border} bg-gradient-to-br ${c.grad} backdrop-blur-xl p-6 shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl animate-slide-up cursor-pointer group`} 
            style={{ animationDelay: `${i * 100}ms`, animationFillMode: "backwards" }}
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
      })}
    </div>
  );
}
