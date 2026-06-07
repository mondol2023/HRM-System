// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "../api/axios";

interface User {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "hr" | "manager" | "employee";
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("hrm_token"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get<{ data: User }>("/auth/me");
        setUser(res.data.data);
      } catch {
        setUser(null);
        setToken(null);
        localStorage.removeItem("hrm_token");
      } finally {
        setIsLoading(false);
      }
    };
    if (token) fetchMe();
    else setIsLoading(false);
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ data: { user: User; token: string } }>("/auth/login", { email, password });
    const { user: u, token: t } = res.data.data;
    setUser(u);
    setToken(t);
    localStorage.setItem("hrm_token", t);
  };

  const logout = async () => {
    await api.post("/auth/logout");
    setUser(null);
    setToken(null);
    localStorage.removeItem("hrm_token");
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};