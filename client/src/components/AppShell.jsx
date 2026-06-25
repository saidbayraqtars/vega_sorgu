import { useConnection } from "../context/ConnectionContext";
import Sidebar from "./Sidebar";
import Home from "../pages/Home";
import CariKartlar from "../pages/CariKartlar";
import BankaRaporlari from "../pages/BankaRaporlari";
import BankaHareket from "../pages/BankaHareket";
import TahsilatRaporlari from "../pages/VisaRaporlari";
import CekRaporlari from "../pages/CekRaporlari";
import SenetPortfoy from "../pages/SenetPortfoy";
import SatisKarlilik from "../pages/SatisKarlilik";
import SonIslemler from "../pages/SonIslemler";
import Dashboard from "./Dashboard";

const PAGES = {
  home: Home,
  sonIslemler: SonIslemler,
  cari: CariKartlar,
  banka: BankaRaporlari,
  bankaHareket: BankaHareket,
  tahsilat: TahsilatRaporlari,
  cek: CekRaporlari,
  senet: SenetPortfoy,
  satis: SatisKarlilik,
  gunluk: Dashboard,
};

export default function AppShell() {
  const { currentPage } = useConnection();
  const Page = PAGES[currentPage] || Home;

  return (
    <div className="min-h-screen bg-dark-900 flex">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Page />
      </main>
    </div>
  );
}
