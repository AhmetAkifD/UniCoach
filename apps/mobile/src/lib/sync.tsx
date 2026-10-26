import { useEffect, useRef, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { syncEngine } from "./api";
import type { SyncState } from "./local";

/** Uygulama açıkken bu aralıkla yenilikler çekilir (çevrimdışıyken de bağlantı yeniden denenir). */
const PULL_INTERVAL_MS = 30_000;

/** Eşitleme durumu (bağlantı, sürüyor mu, son eşitleme). */
export function useSyncState(): SyncState {
  return useSyncExternalStore(syncEngine.subscribe, syncEngine.getState);
}

/** Arka planda eşitleme yerel veriyi değiştirince ekranı yeniden yükler. */
export function useSyncRefresh(reload: () => void) {
  const ref = useRef(reload);
  ref.current = reload;
  useEffect(() => syncEngine.subscribe((_, changed) => changed && ref.current()), []);
}

/**
 * Giriş yapılmış uygulamada eşitleme zamanlaması: açılışta, uygulamaya dönülünce ve açıkken belli aralıklarla.
 * Yazmalardan sonraki çekme lib/local'da yapılır.
 */
export function SyncTriggers() {
  useEffect(() => {
    if (!syncEngine.enabled) return;
    void syncEngine.pull();
    let timer: ReturnType<typeof setInterval> | null = setInterval(() => void syncEngine.pull(), PULL_INTERVAL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncEngine.pull();
        timer ??= setInterval(() => void syncEngine.pull(), PULL_INTERVAL_MS);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    return () => {
      sub.remove();
      if (timer) clearInterval(timer);
    };
  }, []);
  return null;
}
