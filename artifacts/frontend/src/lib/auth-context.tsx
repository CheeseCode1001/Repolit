import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { customFetch } from "@workspace/api-client-react";
import { getAnonId, clearAnonId } from "./anon-session";

export interface User {
  userId: string;
  username: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  points: number;
  githubUsername: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoaded: boolean;
  isSignedIn: boolean;
  login: (data: any) => Promise<any>;
  signup: (data: any) => Promise<any>;
  verifyEmail: (data: any) => Promise<any>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      const res = await customFetch<{ user: User | null }>("/api/auth/me", {
        headers: { "x-anon-id": getAnonId() }
      });
      setUser(res.user);
    } catch (err) {
      setUser(null);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (data: any) => {
    const res = await customFetch<any>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", "x-anon-id": getAnonId() }
    });
    clearAnonId();
    await fetchUser();
    return res;
  };

  const signup = async (data: any) => {
    const res = await customFetch<any>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", "x-anon-id": getAnonId() }
    });
    clearAnonId();
    await fetchUser();
    return res;
  };

  const verifyEmail = async (data: any) => {
    const res = await customFetch<any>("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json", "x-anon-id": getAnonId() }
    });
    await fetchUser();
    return res;
  };

  const logout = async () => {
    try {
      await customFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {}
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoaded,
        isSignedIn: !!user,
        login,
        signup,
        verifyEmail,
        logout,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
