import { useState } from "react";
import { Eye, EyeOff, KeyRound, LogIn, UserRound } from "lucide-react";
import { api, ApiHatasi } from "../lib/api";
import type { Kullanici } from "../lib/types";
import { useUygulama } from "../state/uygulama";
import { cx } from "../components/ui";

export function Giris() {
  const { girisYapildi } = useUygulama();
  const [kullanici, setKullanici] = useState("");
  const [sifre, setSifre] = useState("");
  const [goster, setGoster] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekle, setBekle] = useState(false);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kullanici || !sifre) return setHata("Kullanıcı adı ve şifre gerekli.");
    setBekle(true);
    setHata(null);
    try {
      const r = await api<{ kullanici: Kullanici }>("/auth/giris", { method: "POST", govde: { kullanici, sifre }, sessiz: true });
      girisYapildi(r.kullanici);
    } catch (e) {
      const d = e instanceof ApiHatasi ? e.durum : 0;
      if (d === 401) setHata("Kullanıcı adı veya şifre hatalı");
      else if (d === 429) setHata("Çok fazla hatalı deneme. Lütfen 15 dakika sonra tekrar deneyin.");
      else setHata((e as Error).message);
    } finally {
      setBekle(false);
    }
  };

  const girdi = "min-h-12 w-full rounded-xl border border-cizgi bg-kart pl-11 pr-3 text-base focus:border-marka focus:outline-none";

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <form onSubmit={gonder} className="flex w-full max-w-sm flex-col gap-4 rounded-3xl border border-cizgi bg-kart p-6 shadow-xl sm:p-8" aria-label="Giriş">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src="/logo.svg" alt="" width={64} height={64} />
          <h1 className="text-2xl font-extrabold">Vega Bulut</h1>
          <p className="text-sm text-soluk">Şirketinizin anlık durumu</p>
        </div>
        <label className="relative">
          <span className="sr-only">Kullanıcı adı</span>
          <UserRound size={20} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-soluk" aria-hidden />
          <input name="kullanici" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Kullanıcı adı" className={girdi} value={kullanici} onChange={(e) => setKullanici(e.target.value)} autoFocus />
        </label>
        <label className="relative">
          <span className="sr-only">Şifre</span>
          <KeyRound size={20} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-soluk" aria-hidden />
          <input name="sifre" type={goster ? "text" : "password"} autoComplete="current-password" placeholder="Şifre" className={cx(girdi, "pr-12")} value={sifre} onChange={(e) => setSifre(e.target.value)} />
          <button type="button" onClick={() => setGoster((g) => !g)} className="absolute top-1/2 right-1.5 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-soluk hover:bg-kart2" aria-label={goster ? "Şifreyi gizle" : "Şifreyi göster"} title={goster ? "Şifreyi gizle" : "Şifreyi göster"}>
            {goster ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </label>
        {hata && (
          <p className="rounded-xl bg-kotu-zemin px-3 py-2 text-sm font-medium text-kotu" role="alert" data-testid="giris-hata">
            {hata}
          </p>
        )}
        <button type="submit" disabled={bekle} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-marka text-base font-bold text-white transition hover:brightness-110 disabled:opacity-60 dark:text-[#0b1020]">
          <LogIn size={20} aria-hidden /> Giriş
        </button>
      </form>
    </main>
  );
}
