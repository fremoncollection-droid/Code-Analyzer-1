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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("pos_token"));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("pos_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [selectedLocationId, setSelectedLocationIdState] = useState<string | null>(() =>
    localStorage.getItem("pos_location_id")
  );

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
