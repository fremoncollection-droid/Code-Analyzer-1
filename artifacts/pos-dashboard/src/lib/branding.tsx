import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface Branding {
  appName: string;
  logoUrl: string;
  isLoading: boolean;
}

interface BrandingContextValue {
  branding: Branding;
  refresh: () => void;
}

const DEFAULT_NAME = "MirrorTech POS";

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>({
    appName: DEFAULT_NAME,
    logoUrl: "",
    isLoading: true,
  });

  const fetchBranding = async () => {
    try {
      const res = await fetch("/api/public/settings");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const name = data.app_name || DEFAULT_NAME;
      const logo = data.logo_url || "";
      setBranding({ appName: name, logoUrl: logo, isLoading: false });
      document.title = name;
    } catch {
      setBranding({ appName: DEFAULT_NAME, logoUrl: "", isLoading: false });
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, refresh: fetchBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}
