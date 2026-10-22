import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { ApiError, type AuthUser } from "@unicoach/shared";
import { api, setApiToken } from "./api";

const TOKEN_KEY = "uc_session";

/** SecureStore web'de yok; web önizlemesinde localStorage kullanılır. */
const storage = {
  get: async () => (Platform.OS === "web" ? globalThis.localStorage?.getItem(TOKEN_KEY) ?? null : SecureStore.getItemAsync(TOKEN_KEY)),
  set: async (value: string) =>
    Platform.OS === "web" ? globalThis.localStorage?.setItem(TOKEN_KEY, value) : SecureStore.setItemAsync(TOKEN_KEY, value),
  remove: async () =>
    Platform.OS === "web" ? globalThis.localStorage?.removeItem(TOKEN_KEY) : SecureStore.deleteItemAsync(TOKEN_KEY),
};

/** offline: belirteç var ama API'ye ulaşılamadı (telefon ile bilgisayar aynı ağda mı?). */
type Status = "loading" | "signedOut" | "signedIn" | "offline";

interface Session {
  status: Status;
  user: AuthUser | null;
  /** Giriş: belirteç saklanır, kullanıcı bilgisi yerleşir. */
  signIn: (token: string, user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
  /** Profil değişince güncel kullanıcıyı yerleştirir (verilmezse API'den okunur). */
  refresh: (user?: AuthUser) => Promise<void>;
  /** Açılışta API'ye ulaşılamadıysa yeniden dener. */
  retry: () => void;
}

const SessionContext = createContext<Session | null>(null);

/**
 * Oturum: JWT (7 gün) cihazda güvenli depoda tutulur, açılışta `GET /api/auth/me` ile doğrulanır.
 * Belirteç geçersizse (401) oturum kapanır; API'ye ulaşılamıyorsa belirteç silinmez, kullanıcı tekrar dener.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const load = useCallback(async () => {
    const saved = await storage.get().catch(() => null);
    if (!saved) {
      setStatus("signedOut");
      return;
    }
    setApiToken(saved);
    setStatus("loading");
    try {
      setUser(await api.auth.me());
      setStatus("signedIn");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await storage.remove().catch(() => undefined);
        setApiToken(null);
        setStatus("signedOut");
      } else {
        setStatus("offline");
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<Session>(
    () => ({
      status,
      user,
      signIn: async (token, next) => {
        setApiToken(token);
        await storage.set(token);
        setUser(next);
        setStatus("signedIn");
      },
      signOut: async () => {
        setApiToken(null);
        await storage.remove().catch(() => undefined);
        setUser(null);
        setStatus("signedOut");
      },
      refresh: async (next) => {
        setUser(next ?? (await api.auth.me()));
      },
      retry: () => void load(),
    }),
    [status, user, load],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession, SessionProvider içinde kullanılmalı.");
  return ctx;
}
