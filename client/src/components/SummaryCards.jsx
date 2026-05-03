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

export default function SummaryCards({ summary, isLoading }) {
  const cards = [
    {
      id: "nakit", title: "Günlük Nakit Toplam", emoji: "💵", value: summary?.toplamNakit ?? 0,
      icon: <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>,
      grad: "from-emerald-600/20 to-emerald-800/20", border: "border-emerald-500/20",
      iconBg: "bg-emerald-500/15", iconClr: "text-emerald-400", valClr: "text-emerald-400",
      subtitle: "IZAHAT = 83",
    },
    {
      id: "visa", title: "Günlük Visa Toplam", emoji: "💳", value: summary?.toplamVisa ?? 0,
      icon: <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>,
      grad: "from-violet-600/20 to-violet-800/20", border: "border-violet-500/20",
      iconBg: "bg-violet-500/15", iconClr: "text-violet-400", valClr: "text-violet-400",
      subtitle: "IZAHAT = 13",
    },
    {
      id: "total", title: "Günlük Genel Toplam", emoji: "📊", value: (summary?.toplamNakit ?? 0) + (summary?.toplamVisa ?? 0),
      icon: <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
      grad: "from-cyan-600/20 to-cyan-800/20", border: "border-cyan-500/20",
      iconBg: "bg-cyan-500/15", iconClr: "text-cyan-400", valClr: "text-cyan-400",
      subtitle: "Nakit + Visa",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {cards.map((c, i) => (
        <div key={c.id} className={`relative overflow-hidden rounded-2xl border ${c.border} bg-gradient-to-br ${c.grad} backdrop-blur-xl p-6 shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl animate-slide-up`} style={{ animationDelay: `${i * 100}ms`, animationFillMode: "backwards" }}>
          <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full ${c.iconBg} blur-2xl opacity-40`} />
          <div className="relative z-10 flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{c.emoji}</span>
                <p className="text-dark-400 text-sm font-medium tracking-wide">{c.title}</p>
              </div>
              {isLoading ? (
                <div className="skeleton h-10 w-48 rounded-lg" />
              ) : (
                <p className={`text-3xl lg:text-4xl font-bold ${c.valClr} number-animate`}>
                  <AnimatedNumber value={c.value} suffix=" ₺" />
                </p>
              )}
              <p className="text-dark-600 text-xs font-mono">{c.subtitle}</p>
            </div>
            <div className={`${c.iconBg} ${c.iconClr} p-3 rounded-xl`}>{c.icon}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
