import Constants from "expo-constants";
import { Platform } from "react-native";
import { createApiClient } from "@unicoach/shared";
import { createLocalLayer } from "./local";

/**
 * API adresi. Öncelik `EXPO_PUBLIC_API_URL` (ör. http://192.168.1.10:4000). Yoksa geliştirmede Expo'nun
 * çalıştığı bilgisayarın adresi kullanılır: telefon (Expo Go) uygulamayı bu bilgisayardan indirdiği için
 * API'ye de aynı adresten, 4000 portundan ulaşır. Web önizlemesinde tarayıcının adresi kullanılır.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (Platform.OS === "web" && typeof window !== "undefined") return `http://${window.location.hostname}:4000`;
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${host ?? "localhost"}:4000`;
}

const API_URL = resolveBaseUrl();
/** Sunucu adresi (yukarıdaki kurallar). */
export const apiBaseUrl = () => API_URL;

/** Oturum belirteci bellekte tutulur; kalıcı kopyası SecureStore'dadır (lib/session.tsx). */
let token: string | null = null;
export const setApiToken = (value: string | null) => {
  token = value;
};
export const getApiToken = () => token;

/** Mobil, çerez yerine `Authorization: Bearer` ile kimlik doğrular. Doğrudan sunucu (oturum işleri için). */
export const remoteApi = createApiClient({ baseUrl: apiBaseUrl, getToken: () => token });

const layer = createLocalLayer(remoteApi);
/**
 * Ekranların kullandığı istemci: telefonda okumalar yerel kopyadan (lib/local), yazmalar sunucuya. Web önizlemesinde
 * doğrudan sunucu.
 */
export const api = layer.api;
/** Yerel kopyayı sunucuyla eşitleyen motor (lib/sync.tsx bunu ekranlara bağlar). */
export const syncEngine = layer.engine;
