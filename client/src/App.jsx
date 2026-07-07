import { ConnectionProvider, useConnection } from "./context/ConnectionContext";
import ConnectionForm from "./components/ConnectionForm";
import PeriodSelector from "./components/PeriodSelector";
import AppShell from "./components/AppShell";

function AppContent() {
  const { step, error } = useConnection();

  switch (step) {
    case "loading":
      return (
        <div className="min-h-screen flex items-center justify-center bg-dark-900">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-violet-500/30 border-t-violet-500 animate-spin" />
            <p className="text-dark-400 text-sm font-medium animate-pulse">{error || "Sistem kontrol ediliyor..."}</p>
          </div>
        </div>
      );
    case "setup":
      return <ConnectionForm />;
    case "select-period":
      return <PeriodSelector />;
    case "dashboard":
      return <AppShell />;
    default:
      return null;
  }
}

export default function App() {
  return (
    <ConnectionProvider>
      <AppContent />
    </ConnectionProvider>
  );
}
