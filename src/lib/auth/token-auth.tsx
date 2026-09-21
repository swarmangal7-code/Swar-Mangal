"use client";

// Client-side token auth. The device token is stored in sessionStorage and
// sent with every RPC call to the VPS backend — matching Flutter's model exactly.
// On Cloudflare Pages there is no server-side API route; the token goes directly
// to the backend RPC gateway.

import * as React from "react";
import { rpc, RpcError, setRpcToken } from "@/lib/api/rpc-client";
import type { BootstrapResponse, StaffBootResponse } from "@/lib/api/rpc-types";

export type TokenRole = "FOUNDER_ADMIN" | "OPS_USER";

export interface TokenSession {
  role: TokenRole;
  email: string;
  name: string;
  branches: string[];
}

const STORAGE_KEY = "sw_token";

interface TokenAuthContextValue {
  session: TokenSession | null;
  token: string;
  isLoading: boolean;
  error: string | null;
  login: (token: string, endpoint?: "founder" | "staff") => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

const TokenAuthContext = React.createContext<TokenAuthContextValue | undefined>(undefined);

export function TokenAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<TokenSession | null>(null);
  const [token, setToken] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Restore session from sessionStorage on mount.
  React.useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) { setIsLoading(false); return; }
    setRpcToken(stored);
    setToken(stored);
    // Validate by calling bootstrap.
    (async () => {
      try {
        const boot = await rpc<BootstrapResponse>("api_bootstrap");
        setSession({ role: boot.role, email: boot.email, name: boot.name, branches: boot.branches ?? [] });
      } catch {
        try {
          const boot = await rpc<StaffBootResponse>("api_staff_boot", {});
          setSession({ role: "OPS_USER", email: boot.email, name: boot.name, branches: boot.branches ?? [] });
        } catch {
          sessionStorage.removeItem(STORAGE_KEY);
          setRpcToken("");
          setToken("");
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = React.useCallback(async (tok: string, endpoint?: "founder" | "staff"): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    setRpcToken(tok);
    setToken(tok);
    try {
      if (endpoint === "founder" || !endpoint) {
        const boot = await rpc<BootstrapResponse>("api_bootstrap");
        sessionStorage.setItem(STORAGE_KEY, tok);
        setSession({ role: boot.role, email: boot.email, name: boot.name, branches: boot.branches ?? [] });
        setIsLoading(false);
        return true;
      }
      const boot = await rpc<StaffBootResponse>("api_staff_boot", {});
      sessionStorage.setItem(STORAGE_KEY, tok);
      setSession({ role: "OPS_USER", email: boot.email, name: boot.name, branches: boot.branches ?? [] });
      setIsLoading(false);
      return true;
    } catch (e) {
      const code = e instanceof RpcError ? e.code : "";
      setRpcToken("");
      setToken("");
      if (code === "AUTH_FAILED") {
        setError("Invalid or revoked token.");
      } else if (code === "ROLE_FORBIDDEN") {
        setError(endpoint === "founder" ? "This is not a founder token." : "This is not a staff token.");
      } else {
        setError("Could not reach server. Check your connection.");
      }
      setIsLoading(false);
      return false;
    }
  }, []);

  const logout = React.useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setRpcToken("");
    setToken("");
    setSession(null);
    setIsLoading(false);
    setError(null);
  }, []);

  const clearError = React.useCallback(() => setError(null), []);

  return (
    <TokenAuthContext.Provider value={{ session, token, isLoading, error, login, logout, clearError }}>
      {children}
    </TokenAuthContext.Provider>
  );
}

export function useTokenAuth() {
  const ctx = React.useContext(TokenAuthContext);
  if (!ctx) throw new Error("useTokenAuth must be used within TokenAuthProvider");
  return ctx;
}
