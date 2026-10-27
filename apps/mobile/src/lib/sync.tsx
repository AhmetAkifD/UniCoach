import { useEffect, useRef, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { syncEngine } from "./api";
import { ensurePdfjs } from "./offline-files";
import type { SyncState } from "./local";

/** Uygulama açıkken bu aralıkla eşitlenir (çevrimdışıyken de bağlantı yeniden denenir). */
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
 * Giriş yapılmış uygulamada eşitleme zamanlaması: açılışta, uygulamaya dönülünce, arka plana geçerken (bekleyen
 * değişiklik varsa) ve açıkken belli aralıklarla. Değişikliklerden sonraki eşitleme lib/local'da planlanır.
 */
export function SyncTriggers() {
  useEffect(() => {
    if (!syncEngine.enabled) return;
    void ensurePdfjs();
    void syncEngine.sync();
    let timer: ReturnType<typeof setInterval> | null = setInterval(() => void syncEngine.sync(), PULL_INTERVAL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void syncEngine.sync();
        timer ??= setInterval(() => void syncEngine.sync(), PULL_INTERVAL_MS);
      } else {
        // Arka plana geçerken bekleyen değişiklikler hemen gönderilmeye çalışılır.
        if (syncEngine.getState().pending) void syncEngine.sync();
        if (timer) clearInterval(timer);
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
