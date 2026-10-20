"use client";

import { PLAYLIST_MAX_ITEMS } from "@unicoach/shared";

/**
 * YouTube IFrame Player API — yalnızca kullandığımız kısmın tipleri.
 * https://developers.google.com/youtube/iframe_api_reference
 */
export interface YTPlayer {
  loadVideoById(options: { videoId: string; startSeconds?: number }): void;
  cueVideoById(options: { videoId: string; startSeconds?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getPlaylist(): string[] | null;
  destroy(): void;
}

interface YTPlayerOptions {
  width?: number | string;
  height?: number | string;
  videoId?: string;
  playerVars?: Record<string, string | number>;
  events?: {
    onReady?: (e: { target: YTPlayer }) => void;
    onStateChange?: (e: { target: YTPlayer; data: number }) => void;
    onError?: (e: { target: YTPlayer; data: number }) => void;
  };
}

interface YTNamespace {
  Player: new (element: HTMLElement | string, options: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const PlayerState = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

let apiPromise: Promise<YTNamespace> | null = null;

/** IFrame API betiğini bir kez yükler. */
export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    tag.onerror = () => {
      apiPromise = null;
      reject(new Error("YouTube oynatıcısı yüklenemedi."));
    };
    document.head.appendChild(tag);
  });
  return apiPromise;
}

export function createPlayer(element: HTMLElement, options: YTPlayerOptions): Promise<YTPlayer> {
  return loadYouTubeApi().then(
    (YT) =>
      new Promise<YTPlayer>((resolve) => {
        const userReady = options.events?.onReady;
        new YT.Player(element, {
          ...options,
          playerVars: { origin: window.location.origin, rel: 0, ...options.playerVars },
          events: {
            ...options.events,
            onReady: (e) => {
              userReady?.(e);
              resolve(e.target);
            },
          },
        });
      }),
  );
}

/**
 * Oynatma listesindeki video ID'lerini YouTube'daki sırasıyla döndürür (API anahtarı gerekmez).
 * Görünmeyen bir oynatıcı açılır, getPlaylist() sonucu birkaç ölçümde değişmeyince kabul edilir.
 * YouTube en fazla 200 video döndürür.
 */
export async function fetchPlaylistVideoIds(listId: string, timeoutMs = 15000): Promise<string[]> {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:200px;height:120px;pointer-events:none;";
  const mount = document.createElement("div");
  host.appendChild(mount);
  document.body.appendChild(host);

  let player: YTPlayer | null = null;
  try {
    return await new Promise<string[]>((resolve, reject) => {
      const started = Date.now();
      createPlayer(mount, {
        width: 200,
        height: 120,
        playerVars: { listType: "playlist", list: listId, mute: 1 },
        events: {
          onReady: (e) => {
            player = e.target;
            let last = -1;
            let stable = 0;
            const timer = setInterval(() => {
              const ids = e.target.getPlaylist() ?? [];
              stable = ids.length > 0 && ids.length === last ? stable + 1 : 0;
              last = ids.length;
              const timedOut = Date.now() - started > timeoutMs;
              if (stable >= 3 || ids.length >= PLAYLIST_MAX_ITEMS || timedOut) {
                clearInterval(timer);
                if (ids.length) resolve(ids);
                else reject(new Error("Oynatma listesi okunamadı. Liste gizli ya da boş olabilir."));
              }
            }, 400);
          },
          onError: () => reject(new Error("Oynatma listesi açılamadı. Liste gizli ya da kaldırılmış olabilir.")),
        },
      }).catch(reject);
    });
  } finally {
    (player as YTPlayer | null)?.destroy();
    host.remove();
  }
}

/** 754 → "12:34", 3725 → "1:02:05" */
export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
