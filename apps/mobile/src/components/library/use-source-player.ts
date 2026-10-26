import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { ApiError, firstUnwatched, startSeconds, type ProgressInput, type SourceDetail, type SourceItem } from "@unicoach/shared";
import { api } from "@/lib/api";
import { PlayerState, type YouTubeEvent, type YouTubeFrameHandle } from "@/lib/youtube";

/** Oynarken ilerleme bu aralıkla kaydedilir (web'deki useSourcePlayer ile aynı). */
const SAVE_INTERVAL_MS = 10_000;

/**
 * Bir kaynağın oynatıcı mantığı (web'deki useSourcePlayer): hangi video çalıyor, ilerleme kaydı, sıradakine geçiş.
 * Konu Anlatımı ekranı ve Çalışma Alanı aynısını kullanır. İlerleme web'deki kurallarla kaydedilir: oynarken 10 sn'de
 * bir, duraklatınca, video değişince, uygulama arka plana geçince, ekran odağını kaybedince (video da durur) ve
 * ekrandan çıkınca; video bitince izlendi işaretlenip sıradakine geçilir (%90 kuralı API'de).
 */
export function useSourcePlayer(source: SourceDetail, onFullscreenChange?: (on: boolean) => void) {
  const [items, setItems] = useState(source.items);
  const [current, setCurrent] = useState(() => firstUnwatched(source.items));
  const [error, setError] = useState<string>();

  const frameRef = useRef<YouTubeFrameHandle>(null);
  const itemsRef = useRef(items);
  const currentRef = useRef(current);
  itemsRef.current = items;
  currentRef.current = current;
  /** Oynatıcının son bildirdiği konum (sayfa saniyede bir gönderir). */
  const timeRef = useRef({ time: startSeconds(items[current]!), duration: 0 });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fullscreenRef = useRef(onFullscreenChange);
  fullscreenRef.current = onFullscreenChange;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => ({ videoId: items[current]!.videoId, start: startSeconds(items[current]!) }), []);

  const save = useCallback(
    async (item: SourceItem, input: ProgressInput) => {
      try {
        const updated = await api.sources.saveProgress(source.id, item.id, input);
        setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "İlerleme kaydedilemedi.");
      }
    },
    [source.id],
  );

  /** Oynatıcının o anki konumunu kaydeder. */
  const saveCurrent = useCallback(
    (extra?: Partial<ProgressInput>) => {
      const item = itemsRef.current[currentRef.current];
      if (!item) return;
      const positionSec = Math.floor(timeRef.current.time);
      const duration = Math.floor(timeRef.current.duration);
      if (positionSec === 0 && !extra?.watched) return;
      void save(item, { positionSec, ...(duration > 0 && { durationSec: duration }), ...extra });
    },
    [save],
  );

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const playIndex = useCallback(
    (index: number) => {
      const item = itemsRef.current[index];
      if (!item) return;
      if (index !== currentRef.current) saveCurrent();
      stopTimer();
      setCurrent(index);
      currentRef.current = index;
      const start = startSeconds(item);
      timeRef.current = { time: start, duration: 0 };
      frameRef.current?.load(item.videoId, start);
    },
    [saveCurrent],
  );

  const onEvent = useCallback(
    (event: YouTubeEvent) => {
      if (event.type === "error") return setError(event.message);
      if (event.type === "fullscreen") return fullscreenRef.current?.(event.on);
      if (event.type === "time") {
        timeRef.current = { time: event.time, duration: event.duration };
        return;
      }
      if (event.type !== "state") return;
      timeRef.current = { time: event.time, duration: event.duration };
      if (event.state === PlayerState.PLAYING) {
        stopTimer();
        timerRef.current = setInterval(() => saveCurrent(), SAVE_INTERVAL_MS);
      } else if (event.state === PlayerState.PAUSED) {
        stopTimer();
        saveCurrent();
      } else if (event.state === PlayerState.ENDED) {
        stopTimer();
        saveCurrent({ watched: true });
        const next = currentRef.current + 1;
        if (next < itemsRef.current.length) playIndex(next);
      }
    },
    [saveCurrent, playIndex],
  );

  /** O anki videonun izlendi işaretini değiştirir. */
  const toggleWatched = useCallback(
    (item: SourceItem) => {
      const positionSec = item.id === itemsRef.current[currentRef.current]?.id ? Math.floor(timeRef.current.time) || item.positionSec : item.positionSec;
      void save(item, { positionSec, watched: !item.watchedAt });
    },
    [save],
  );

  // Uygulama arka plana geçince video durur (YouTube arka planda oynatmaya izin vermez) ve konum kaydedilir;
  // ekrandan çıkınca da son konum kaydedilir.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") return;
      frameRef.current?.pause();
      saveCurrent();
    });
    return () => {
      sub.remove();
      stopTimer();
      saveCurrent();
    };
  }, [saveCurrent]);

  // Üstüne başka ekran açılınca (ör. "Çalışma alanında aç") video durur; iki oynatıcı birden çalmasın.
  useFocusEffect(
    useCallback(
      () => () => {
        frameRef.current?.pause();
        saveCurrent();
      },
      [saveCurrent],
    ),
  );

  return { frameRef, initial, onEvent, items, current, playIndex, save, toggleWatched, error, setError };
}
