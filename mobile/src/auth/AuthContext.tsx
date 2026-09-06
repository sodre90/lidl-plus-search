// Auth + session state shared across the app: whether the user is signed in,
// the authenticated Lidl client to use, and the current country/language.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { LidlClient } from "../lidl/client";
import type { TokenResponse } from "../lidl/auth";
import { TokenManager, clearRefreshToken } from "./tokens";
import { wipeAll } from "../db/queries";
import {
  DEFAULT_COUNTRY,
  DEFAULT_LANGUAGE,
  getCountry,
  getLanguage,
  setCountry as persistCountry,
  setLanguage as persistLanguage,
} from "../settings";

type Status = "loading" | "signedIn" | "signedOut";

interface AuthState {
  status: Status;
  client: LidlClient | null;
  country: string;
  language: string;
  signIn: (tr: TokenResponse) => Promise<void>;
  signOut: (opts?: { wipe?: boolean }) => Promise<void>;
  updateCountry: (c: string) => Promise<void>;
  updateLanguage: (l: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [tokenManager, setTokenManager] = useState<TokenManager | null>(null);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);

  useEffect(() => {
    (async () => {
      const [tm, c, l] = await Promise.all([
        TokenManager.fromStore(),
        getCountry(),
        getLanguage(),
      ]);
      setCountry(c);
      setLanguage(l);
      setTokenManager(tm);
      setStatus(tm ? "signedIn" : "signedOut");
    })();
  }, []);

  const client = useMemo(
    () => (tokenManager ? new LidlClient(tokenManager, country) : null),
    [tokenManager, country],
  );

  const signIn = useCallback(async (tr: TokenResponse) => {
    const tm = await TokenManager.fromTokenResponse(tr);
    setTokenManager(tm);
    setStatus("signedIn");
  }, []);

  const signOut = useCallback(async (opts?: { wipe?: boolean }) => {
    await clearRefreshToken();
    if (opts?.wipe) await wipeAll();
    setTokenManager(null);
    setStatus("signedOut");
  }, []);

  const updateCountry = useCallback(async (c: string) => {
    await persistCountry(c);
    setCountry(c.trim());
  }, []);

  const updateLanguage = useCallback(async (l: string) => {
    await persistLanguage(l);
    setLanguage(l.trim());
  }, []);

  const value: AuthState = {
    status,
    client,
    country,
    language,
    signIn,
    signOut,
    updateCountry,
    updateLanguage,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
