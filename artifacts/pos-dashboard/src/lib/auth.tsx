import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  locationId: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  login: (token: string, refreshToken: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getDevAuth(): { token: string | null; user: AuthUser | null } {
  if (typeof window === "undefined") return { token: null, user: null };
  const hash = window.location.hash;
  const tokenMatch = hash.match(/tkn=([^&]+)/);
  const userMatch = hash.match(/usr=([^&]+)/);
  let token = null;
  let user = null;
  if (tokenMatch) { token = decodeURIComponent(tokenMatch[1]); localStorage.setItem("pos_token", token); }
  if (userMatch) {
    try { user = JSON.parse(decodeURIComponent(userMatch[1])); localStorage.setItem("pos_user", JSON.stringify(user)); } catch {}
  }
  return { token, user };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const dev = typeof window !== "undefined" ? getDevAuth() : { token: null, user: null };
  const [token, setToken] = useState<string | null>(() => dev.token ?? localStorage.getItem("pos_token"));
  const [user, setUser] = useState<AuthUser | null>(() => dev.user ?? (() => {
    const raw = localStorage.getItem("pos_user");
    return raw ? JSON.parse(raw) : null;
  })());
  const [selectedLocationId, setSelectedLocationIdState] = useState<string | null>(() => {
    if (dev.user?.locationId) { localStorage.setItem("pos_location_id", dev.user.locationId); return dev.user.locationId; }
    return localStorage.getItem("pos_location_id");
  });

  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem("pos_token"));
  }, []);

  const login = (newToken: string, refreshToken: string, newUser: AuthUser) => {
    localStorage.setItem("pos_token", newToken);
    localStorage.setItem("pos_refresh_token", refreshToken);
    localStorage.setItem("pos_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    // If user has a fixed location, auto-select it
    if (newUser.locationId) {
      setSelectedLocationIdState(newUser.locationId);
      localStorage.setItem("pos_location_id", newUser.locationId);
    }
  };

  const logout = () => {
    localStorage.removeItem("pos_token");
    localStorage.removeItem("pos_refresh_token");
    localStorage.removeItem("pos_user");
    localStorage.removeItem("pos_location_id");
    setToken(null);
    setUser(null);
    setSelectedLocationIdState(null);
  };

  const setSelectedLocationId = (id: string) => {
    localStorage.setItem("pos_location_id", id);
    setSelectedLocationIdState(id);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, selectedLocationId, setSelectedLocationId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
