import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { ApiError, type AuthUser, type PairCode } from "@unicoach/shared";
import { remoteApi as api, apiBaseUrl, getApiToken, setApiBaseUrl, setApiToken, syncEngine } from "./api";
import { deviceStore } from "./storage";
import { withTimeout } from "./timeout";

const TOKEN_KEY = "uc_session";
/** Son bilinen kullanıcı: sunucuya ulaşılamazken uygulama bununla açılır. */
const USER_KEY = "uc_user";
/** QR ile eşlenen sunucu adresi (yoksa kurulumun varsayılanı) */
const API_URL_KEY = "uc_api_url";
/** Açılışta sunucu bu sürede yanıt vermezse çevrimdışı açılır. */
const ME_TIMEOUT_MS = 6000;

/** SecureStore web'de yok; web önizlemesinde localStorage kullanılır. */
const storage = {
  get: async () => (Platform.OS === "web" ? globalThis.localStorage?.getItem(TOKEN_KEY) ?? null : SecureStore.getItemAsync(TOKEN_KEY)),
  set: async (value: string) =>
    Platform.OS === "web" ? globalThis.localStorage?.setItem(TOKEN_KEY, value) : SecureStore.setItemAsync(TOKEN_KEY, value),
  remove: async () =>
    Platform.OS === "web" ? globalThis.localStorage?.removeItem(TOKEN_KEY) : SecureStore.deleteItemAsync(TOKEN_KEY),
};

/**
 * offline: belirteç var ama API'ye ulaşılamadı ve bu cihazda son bilinen kullanıcı da yok. Kullanıcı biliniyorsa
 * uygulama çevrimdışı açılır (yerel kopyayla; bağlantı durumu lib/sync.tsx).
 */
type Status = "loading" | "signedOut" | "signedIn" | "offline";

interface Session {
  status: Status;
  user: AuthUser | null;
  /** Oturumun süresi doldu (giriş ekranında gösterilir); bu cihazdaki veri ve gönderilmemiş değişiklikler korunur. */
  expired: boolean;
  /** Giriş: belirteç saklanır, kullanıcı bilgisi yerleşir. Başka hesapsa bu cihazdaki kopya silinir. */
  signIn: (token: string, user: AuthUser) => Promise<void>;
  /** Web'deki QR kodla eşleme: sunucu adresi saklanır, koddaki oturumla giriş yapılır. */
  pair: (code: PairCode) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  /** Profil değişince güncel kullanıcıyı yerleştirir (verilmezse API'den okunur). */
  refresh: (user?: AuthUser) => Promise<void>;
  /** Açılışta API'ye ulaşılamadıysa yeniden dener. */
  retry: () => void;
}

const SessionContext = createContext<Session | null>(null);

/**
 * Oturum: JWT (7 gün) cihazda güvenli depoda tutulur, açılışta `GET /api/auth/me` ile doğrulanır. Sunucu adresi
 * QR ile eşlendiyse o kullanılır. Belirteç geçersizse (401: uzun süre çevrimdışı kalınca süresi dolmuş olabilir)
 * yeniden giriş istenir ama yerel kopya ve gönderilmemiş değişiklikler silinmez: aynı hesapla girince gönderilir.
 * Kopya yalnızca çıkışta ya da başka hesapla girişte silinir. API'ye ulaşılamıyorsa son bilinen kullanıcıyla
 * çevrimdışı açılır (yoksa "Sunucuya ulaşılamadı" ekranı).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [expired, setExpired] = useState(false);

  /** Oturum geçersiz: belirteç silinir, veri kalır. */
  const expire = useCallback(async () => {
    await storage.remove().catch(() => undefined);
    setApiToken(null);
    setExpired(true);
    setUser(null);
    setStatus("signedOut");
  }, []);

  const load = useCallback(async () => {
    setApiBaseUrl(await deviceStore.get<string>(API_URL_KEY));
    const saved = await storage.get().catch(() => null);
    if (!saved) {
      setStatus("signedOut");
      return;
    }
    setApiToken(saved);
    setStatus("loading");
    try {
      const me = await withTimeout(api.auth.me(), ME_TIMEOUT_MS);
      await syncEngine.ensureOwner(me.id);
      deviceStore.set(USER_KEY, me);
      syncEngine.setConnection("online");
      setUser(me);
      setStatus("signedIn");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await expire();
        return;
      }
      const cached = await deviceStore.get<AuthUser>(USER_KEY);
      syncEngine.setConnection("offline");
      if (cached && syncEngine.enabled) {
        setUser(cached);
        setStatus("signedIn");
      } else {
        setStatus("offline");
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Kullanım sırasında eşitleme 401 alırsa (oturumun süresi doldu) yeniden giriş istenir.
  useEffect(
    () =>
      syncEngine.subscribe((state) => {
        if (state.unauthorized && getApiToken()) void expire();
      }),
    [expire],
  );

  const signIn = useCallback(async (token: string, next: AuthUser) => {
    setApiToken(token);
    await storage.set(token);
    await syncEngine.ensureOwner(next.id).catch(() => undefined);
    deviceStore.set(USER_KEY, next);
    syncEngine.setConnection("online");
    setExpired(false);
    setUser(next);
    setStatus("signedIn");
    void syncEngine.sync();
  }, []);

  const value = useMemo<Session>(
    () => ({
      status,
      user,
      expired,
      signIn,
      pair: async (code) => {
        const previous = { url: apiBaseUrl(), token: getApiToken() };
        setApiBaseUrl(code.url);
        setApiToken(code.token);
        try {
          const me = await withTimeout(api.auth.me(), ME_TIMEOUT_MS);
          deviceStore.set(API_URL_KEY, code.url);
          await signIn(code.token, me);
          return me;
        } catch (err) {
          setApiBaseUrl(previous.url);
          setApiToken(previous.token);
          throw err;
        }
      },
      signOut: async () => {
        setApiToken(null);
        await storage.remove().catch(() => undefined);
        deviceStore.set(USER_KEY, null);
        // Bu cihazdaki kopya da silinir (başka biri giriş yaparsa önceki hesabın verisi görünmesin).
        await syncEngine.wipe().catch(() => undefined);
        setExpired(false);
        setUser(null);
        setStatus("signedOut");
      },
      refresh: async (next) => {
        const me = next ?? (await api.auth.me());
        deviceStore.set(USER_KEY, me);
        setUser(me);
      },
      retry: () => void load(),
    }),
    [status, user, expired, load, signIn],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession, SessionProvider içinde kullanılmalı.");
  return ctx;
}
