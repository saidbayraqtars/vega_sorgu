import { createContext, useContext, useState, useCallback, useEffect } from "react";

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
  const [step, setStep] = useState("loading"); // "loading" | "setup" | "pin-login" | "select-period" | "dashboard"
  const [isLoading, setIsLoading] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [error, setError] = useState(null);

  // ─── Discovery State ────────────────────────────────────────
  const [firmalar, setFirmalar] = useState([]);
  const [donemler, setDonemler] = useState([]);
  const [selectedFirma, setSelectedFirma] = useState(null);
  const [selectedDonem, setSelectedDonem] = useState(null);

  // ─── Check Setup ───────────────────────────────────────────
  const checkSetup = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/check-setup`);
      const data = await res.json();
      if (data.isSetup) {
        setStep("pin-login");
      } else {
        setStep("setup");
      }
    } catch (err) {
      setError("Sunucuya ulaşılamıyor.");
      setStep("setup");
    }
  }, []);

  // ─── Initial Check ──────────────────────────────────────────
  useEffect(() => {
    checkSetup();
  }, [checkSetup]);

  // ─── Setup (İlk Kurulum) ────────────────────────────────────
  const setup = useCallback(async (config, pin) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, pin }),
      });
      const data = await res.json();

      if (data.success) {
        setConnectionInfo({ server: config.server, database: config.database });
        setFirmalar(data.firmalar || []);
        setDonemler(data.donemler || []);

        if (data.firmalar?.length > 0 && data.donemler?.length > 0) {
          setStep("select-period");
        } else {
          setError("Veritabanında firma/dönem bulunamadı.");
        }
        return { success: true };
      } else {
        setError(data.message);
        return { success: false, message: data.message };
      }
    } catch (err) {
      setError("Sunucuya bağlanılamadı.");
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─── Login (PIN ile) ────────────────────────────────────────
  const login = useCallback(async (pin) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();

      if (data.success) {
        // config içindeki sunucu adını falan login dönebilir ama şimdilik "Bağlı" diyelim
        setConnectionInfo({ server: "Kayıtlı Sunucu", database: "Kayıtlı Veritabanı" });
        setFirmalar(data.firmalar || []);
        setDonemler(data.donemler || []);

        if (data.firmalar?.length > 0 && data.donemler?.length > 0) {
          setStep("select-period");
        } else {
          setError("Veritabanında firma/dönem bulunamadı.");
        }
        return { success: true };
      } else {
        setError(data.message);
        return { success: false, message: data.message };
      }
    } catch (err) {
      setError("Sunucuya bağlanılamadı.");
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─── Reset Setup ────────────────────────────────────────────
  const resetSetup = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/reset`, { method: "POST" });
    } catch {}
    setStep("setup");
    setConnectionInfo(null);
    setFirmalar([]);
    setDonemler([]);
    setSelectedFirma(null);
    setSelectedDonem(null);
    setError(null);
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
  const disconnect = useCallback(() => {
    // Sadece select-period'a veya login'e döndürebiliriz.
    // Pin girişine döndürmek daha mantıklı
    setStep("pin-login");
    setSelectedFirma(null);
    setSelectedDonem(null);
    setError(null);
  }, []);

  // ─── Fetch Summary ──────────────────────────────────────────
  const fetchSummary = useCallback(
    async (startDate, endDate, subeKodu, allTime = false) => {
      if (!selectedFirma || !selectedDonem) throw new Error("Firma ve Dönem seçilmedi.");
      try {
        let url = `${API_BASE}/summary?firmaNo=${selectedFirma}&donemNo=${selectedDonem}&subeKodu=${subeKodu}`;
        if (allTime) url += `&allTime=true`;
        else url += `&startDate=${startDate}&endDate=${endDate}`;
        
        const res = await fetch(url);
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
    async (startDate, endDate, subeKodu, allTime = false) => {
      if (!selectedFirma || !selectedDonem) throw new Error("Firma ve Dönem seçilmedi.");
      try {
        let url = `${API_BASE}/details?firmaNo=${selectedFirma}&donemNo=${selectedDonem}&subeKodu=${subeKodu}`;
        if (allTime) url += `&allTime=true`;
        else url += `&startDate=${startDate}&endDate=${endDate}`;

        const res = await fetch(url);
        const data = await res.json();
        if (data.success) return data.data;
        throw new Error(data.message);
      } catch (err) {
        throw err;
      }
    },
    [selectedFirma, selectedDonem]
  );

  // ─── Fetch Stok ─────────────────────────────────────────────
  const fetchStok = useCallback(
    async (search = "") => {
      try {
        const res = await fetch(`${API_BASE}/stok?search=${encodeURIComponent(search)}`);
        const data = await res.json();
        if (data.success) return data.data;
        throw new Error(data.message);
      } catch (err) {
        throw err;
      }
    },
    []
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
        setup,
        login,
        resetSetup,
        checkSetup,
        selectFirmaVeDonem,
        goBackToPeriodSelection,
        disconnect,
        fetchSummary,
        fetchDetails,
        fetchStok,
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
