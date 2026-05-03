import { ConnectionProvider, useConnection } from "./context/ConnectionContext";
import ConnectionForm from "./components/ConnectionForm";
import PeriodSelector from "./components/PeriodSelector";
import Dashboard from "./components/Dashboard";

function AppContent() {
  const { step } = useConnection();

  switch (step) {
    case "select-period":
      return <PeriodSelector />;
    case "dashboard":
      return <Dashboard />;
    case "login":
    default:
      return <ConnectionForm />;
  }
}

export default function App() {
  return (
    <ConnectionProvider>
      <AppContent />
    </ConnectionProvider>
  );
}
