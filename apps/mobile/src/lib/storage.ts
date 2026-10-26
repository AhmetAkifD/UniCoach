import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Cihazda küçük ayarlar (web'deki localStorage kullanımlarının karşılığı: son çalışma alanı seçimi, defter araçları).
 * Telefonda SecureStore, web önizlemesinde localStorage. Okunamazsa ya da yazılamazsa varsayılanla devam edilir.
 */
export const deviceStore = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = Platform.OS === "web" ? (globalThis.localStorage?.getItem(key) ?? null) : await SecureStore.getItemAsync(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    const raw = JSON.stringify(value);
    try {
      if (Platform.OS === "web") globalThis.localStorage?.setItem(key, raw);
      else void SecureStore.setItemAsync(key, raw).catch(() => undefined);
    } catch {
      // yok sayılır
    }
  },
};
