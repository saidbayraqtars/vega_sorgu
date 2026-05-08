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
  const [firmalar, setFirmalar] = useState([]);
  const [donemler, setDonemler] = useState([]);
  const [selectedFirma, setSelectedFirma] = useState(null);
  const [selectedDonem, setSelectedDonem] = useState(null);

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
        setFirmalar(data.firmalar || []);
        setDonemler(data.donemler || []);

        // Otomatik olarak firma/dönem seçim adımına geç
        if (data.firmalar && data.firmalar.length > 0 && data.donemler && data.donemler.length > 0) {
          setStep("select-period");
        } else {
          setError("Veritabanında firma veya dönem bilgisi bulunamadı.");
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

  // ─── Select Firma & Donem ───────────────────────────────────
  const selectFirmaVeDonem = useCallback((firmaNo, donemNo) => {
    setSelectedFirma(firmaNo);
    setSelectedDonem(donemNo);
    setStep("dashboard");
    setError(null);
  }, []);

  // ─── Go Back to Selection ───────────────────────────────────
  const goBackToPeriodSelection = useCallback(() => {
    setSelectedFirma(null);
    setSelectedDonem(null);
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
    setFirmalar([]);
    setDonemler([]);
    setSelectedFirma(null);
    setSelectedDonem(null);
    setError(null);
  }, []);

  // ─── Fetch Summary ──────────────────────────────────────────
  const fetchSummary = useCallback(
    async (date, subeKodu) => {
      if (!selectedFirma || !selectedDonem) throw new Error("Firma ve Dönem seçilmedi.");
      try {
        const res = await fetch(
          `${API_BASE}/summary?date=${date}&firmaNo=${selectedFirma}&donemNo=${selectedDonem}&subeKodu=${subeKodu}`
        );
        const data = await res.json();
        if (data.success) return data.data;
        throw new Error(data.message);
      } catch (err) {
        throw err;
      }
    },
    [selectedFirma, selectedDonem]
  );

  // ─── Fetch Details ──────────────────────────────────────────
  const fetchDetails = useCallback(
    async (date, subeKodu) => {
      if (!selectedFirma || !selectedDonem) throw new Error("Firma ve Dönem seçilmedi.");
      try {
        const res = await fetch(
          `${API_BASE}/details?date=${date}&firmaNo=${selectedFirma}&donemNo=${selectedDonem}&subeKodu=${subeKodu}`
        );
        const data = await res.json();
        if (data.success) return data.data;
        throw new Error(data.message);
      } catch (err) {
        throw err;
      }
    },
    [selectedFirma, selectedDonem]
  );

  return (
    <ConnectionContext.Provider
      value={{
        // State
        step,
        isLoading,
        connectionInfo,
        error,
        firmalar,
        donemler,
        selectedFirma,
        selectedDonem,

        // Actions
        connect,
        selectFirmaVeDonem,
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
