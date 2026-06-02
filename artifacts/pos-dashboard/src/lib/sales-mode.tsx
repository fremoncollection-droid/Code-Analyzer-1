import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type SalesMode = "retail" | "wholesale";

interface SalesModeContextValue {
  salesMode: SalesMode;
  setSalesMode: (mode: SalesMode) => void;
  isRetail: boolean;
  isWholesale: boolean;
}

const SalesModeContext = createContext<SalesModeContextValue | null>(null);

export function SalesModeProvider({ children }: { children: ReactNode }) {
  const [salesMode, setSalesModeState] = useState<SalesMode>(() => {
    if (typeof window === "undefined") return "retail";
    return (localStorage.getItem("pos_sales_mode") as SalesMode) || "retail";
  });

  const setSalesMode = (mode: SalesMode) => {
    setSalesModeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("pos_sales_mode", mode);
    }
  };

  return (
    <SalesModeContext.Provider
      value={{
        salesMode,
        setSalesMode,
        isRetail: salesMode === "retail",
        isWholesale: salesMode === "wholesale",
      }}
    >
      {children}
    </SalesModeContext.Provider>
  );
}

export function useSalesMode() {
  const ctx = useContext(SalesModeContext);
  if (!ctx) throw new Error("useSalesMode must be used within SalesModeProvider");
  return ctx;
}
