import { createContext, useContext, useState, useCallback } from "react";

const ConnectionContext = createContext(null);

const API_BASE = "/api";

// ─── IZAHAT Mapping ──────────────────────────────────────────
// Backend'den gelen IZAHAT kodlarını kullanıcı dostu etiketlere çevir
export const IZAHAT_MAP = {
  83: { label: "Nakit", type: "cash" },
  13: { label: "Visa", type: "visa" },
};

export function ConnectionProvider({ children }) {
  // ─── Application State ──────────────────────────────────────
  const [step, setStep] = useState("login"); // "login" | "select-period" | "dashboard"
  const [isLoading, setIsLoading] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [error, setError] = useState(null);

  // ─── Discovery State ────────────────────────────────────────
  const [discoveredTables, setDiscoveredTables] = useState([]);
  const [activeTable, setActiveTable] = useState(null);

  // ─── Connect & Discover ─────────────────────────────────────
  const connect = useCallback(async (config) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await res.json();

      if (data.success) {
        setConnectionInfo({
          server: config.server,
          database: config.database,
        });
        setDiscoveredTables(data.tables || []);

        // Otomatik olarak dönem seçim adımına geç
        if (data.tables && data.tables.length > 0) {
          setStep("select-period");
        } else {
          setError("Veritabanında TBLCARIHAREKETLERI ile biten tablo bulunamadı.");
        }

        return { success: true, message: data.message };
      } else {
        setError(data.message);
        return { success: false, message: data.message };
      }
    } catch (err) {
      const message = "Sunucuya bağlanılamadı. Backend çalışıyor mu?";
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─── Select Period (sadece frontend state, backend'e gönderilmez) ─
  const selectPeriod = useCallback((tableName) => {
    setActiveTable(tableName);
    setStep("dashboard");
    setError(null);
  }, []);

  // ─── Go Back to Period Selection ────────────────────────────
  const goBackToPeriodSelection = useCallback(() => {
    setActiveTable(null);
    setStep("select-period");
    setError(null);
  }, []);

  // ─── Disconnect ─────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/disconnect`, { method: "POST" });
    } catch {
      // ignore
    }
    setStep("login");
    setConnectionInfo(null);
    setDiscoveredTables([]);
    setActiveTable(null);
    setError(null);
  }, []);

  // ─── Fetch Summary (table gönderilir her istekte) ───────────
  const fetchSummary = useCallback(
    async (date) => {
      if (!activeTable) throw new Error("Dönem seçilmedi.");
      try {
        const res = await fetch(
          `${API_BASE}/summary?date=${date}&table=${encodeURIComponent(activeTable)}`
        );
        const data = await res.json();
        if (data.success) return data.data;
        throw new Error(data.message);
      } catch (err) {
        throw err;
      }
    },
    [activeTable]
  );

  // ─── Fetch Details (table gönderilir her istekte) ───────────
  const fetchDetails = useCallback(
    async (date) => {
      if (!activeTable) throw new Error("Dönem seçilmedi.");
      try {
        const res = await fetch(
          `${API_BASE}/details?date=${date}&table=${encodeURIComponent(activeTable)}`
        );
        const data = await res.json();
        if (data.success) return data.data;
        throw new Error(data.message);
      } catch (err) {
        throw err;
      }
    },
    [activeTable]
  );

  return (
    <ConnectionContext.Provider
      value={{
        // State
        step,
        isLoading,
        connectionInfo,
        error,
        discoveredTables,
        activeTable,

        // Actions
        connect,
        selectPeriod,
        goBackToPeriodSelection,
        disconnect,
        fetchSummary,
        fetchDetails,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) {
    throw new Error("useConnection must be used within ConnectionProvider");
  }
  return ctx;
}
