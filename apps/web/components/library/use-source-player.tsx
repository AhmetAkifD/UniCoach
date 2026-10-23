"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  firstUnwatched,
  startSeconds,
  type ProgressInput,
  type SourceDetail,
  type SourceItem,
} from "@unicoach/shared";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { loadPlayerPrefs } from "@/lib/player-prefs";
import { PlayerState, createPlayer, loadYouTubeApi, type YTPlayer } from "@/lib/youtube";
import { VideoControls } from "./video-controls";

/** Oynarken ilerleme bu aralıkla kaydedilir. */
const SAVE_INTERVAL_MS = 10_000;
/** Tam ekranda fare hareketsiz kalınca kontrol paneli bu sürede gizlenir. */
const CONTROLS_HIDE_MS = 2_500;

/**
 * Bir kaynağın (video ya da oynatma listesi) oynatıcısı: YouTube iframe'i, kendi kontrol şeridimiz, tam ekran,
 * kısayollar (Boşluk, F) ve izleme ilerlemesinin kaydı. Konu Anlatımı sayfası ve çalışma alanı aynı oynatıcıyı kullanır;
 * `stage` çizilecek öğedir, liste ve başlık gibi çevre kullanan sayfaya kalır.
 */
export function useSourcePlayer(
  source: SourceDetail,
  {
    compact = false,
    videoHeight,
  }: {
    /** Kenarlıksız (çalışma alanı bölmesi) */
    compact?: boolean;
    /** Verilirse video alanı bu yükseklikte olur (16:9 yerine); YouTube videoyu içinde siyah kenarlarla ortalar. */
    videoHeight?: number | null;
  } = {},
) {
  const [items, setItems] = useState(source.items);
  const [current, setCurrent] = useState(() => firstUnwatched(source.items));
  const [error, setError] = useState<string>();
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  /** Tam ekrana alınan kap: video + kontrol şeridi birlikte büyür. */
  const frameRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const itemsRef = useRef(items);
  const currentRef = useRef(current);
  itemsRef.current = items;
  currentRef.current = current;

  const applyItem = useCallback((updated: SourceItem) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
  }, []);

  const save = useCallback(
    async (item: SourceItem, input: ProgressInput) => {
      try {
        applyItem(await browserApi.sources.saveProgress(source.id, item.id, input));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "İlerleme kaydedilemedi.");
      }
    },
    [applyItem, source.id],
  );

  /** Oynatıcının o anki konumunu kaydeder. */
  const saveCurrent = useCallback(
    (extra?: Partial<ProgressInput>) => {
      const player = playerRef.current;
      const item = itemsRef.current[currentRef.current];
      if (!player || !item) return;
      const positionSec = Math.floor(player.getCurrentTime() || 0);
      const duration = Math.floor(player.getDuration() || 0);
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
      if (!item || !playerRef.current) return;
      if (index !== currentRef.current) saveCurrent();
      setCurrent(index);
      currentRef.current = index;
      playerRef.current.loadVideoById({ videoId: item.videoId, startSeconds: startSeconds(item) });
    },
    [saveCurrent],
  );

  // Oynatıcıyı bir kez kur. YouTube verilen öğeyi iframe ile değiştirdiği için React'in div'i değil,
  // her kurulumda yeni bir alt kap kullanılır. Geliştirmede efekt iki kez çalışır (StrictMode); iptal
  // edilmiş kurulum oynatıcı yaratmaz, yoksa ikisi aynı öğeye kurulup birbirini siler.
  useEffect(() => {
    let cancelled = false;
    const container = mountRef.current;
    if (!container) return;
    const mount = document.createElement("div");
    container.appendChild(mount);
    const first = itemsRef.current[currentRef.current]!;

    loadYouTubeApi()
      .then(() => {
        if (cancelled) return null;
        return createPlayer(mount, {
          width: "100%",
          height: "100%",
          videoId: first.videoId,
          // YouTube kontrolleri kapalı; kontroller videonun altındaki kendi şeridimizde (VideoControls).
          playerVars: {
            start: startSeconds(first),
            playsinline: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
          },
          events: {
            onStateChange: ({ target, data }) => {
              setPlaying(data === PlayerState.PLAYING || data === PlayerState.BUFFERING);
              if (data === PlayerState.PLAYING) {
                // YouTube yeni videoda hızı sıfırlayabilir; kayıtlı tercihi koru.
                const { rate } = loadPlayerPrefs();
                if (Math.abs(target.getPlaybackRate() - rate) > 0.01) target.setPlaybackRate(rate);
                stopTimer();
                timerRef.current = setInterval(() => saveCurrent(), SAVE_INTERVAL_MS);
              } else if (data === PlayerState.PAUSED) {
                stopTimer();
                saveCurrent();
              } else if (data === PlayerState.ENDED) {
                stopTimer();
                saveCurrent({ watched: true });
                const next = currentRef.current + 1;
                if (next < itemsRef.current.length) playIndex(next);
              }
            },
            onError: () => setError("Bu video oynatılamıyor (kaldırılmış ya da yerleştirmeye kapalı olabilir)."),
          },
        });
      })
      .then((player) => {
        if (!player) return;
        if (cancelled) return player.destroy();
        playerRef.current = player;
        const prefs = loadPlayerPrefs();
        player.setVolume(prefs.volume);
        if (prefs.muted) player.mute();
        player.setPlaybackRate(prefs.rate);
        setReady(true);
      })
      .catch(() => setError("YouTube oynatıcısı yüklenemedi. İnternet bağlantını kontrol et."));

    // Sayfadan çıkarken son konumu kaybetme: keepalive ile sayfa kapansa da istek gider.
    const onPageHide = () => {
      const player = playerRef.current;
      const item = itemsRef.current[currentRef.current];
      if (!player || !item) return;
      const positionSec = Math.floor(player.getCurrentTime() || 0);
      if (!positionSec) return;
      void fetch(`/api/sources/${source.id}/items/${item.id}/progress`, {
        method: "PUT",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionSec }),
      });
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", onPageHide);
      stopTimer();
      onPageHide();
      playerRef.current?.destroy();
      playerRef.current = null;
      container.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tam ekran: video + kontrol şeridi birlikte. Önce tarayıcının gerçek tam ekranı denenir; tarayıcı
  // reddederse (ör. iPhone Safari, uygulama içi tarayıcılar) "pencere içi tam ekran"a geçilir:
  // oynatıcı pencerenin tamamını kaplar, Esc ya da F ile çıkılır.
  const [windowFullscreen, setWindowFullscreen] = useState(false);
  const fullscreenRef = useRef(false);
  fullscreenRef.current = fullscreen || windowFullscreen;

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) return void document.exitFullscreen();
    if (fullscreenRef.current) return setWindowFullscreen(false);
    const frame = frameRef.current;
    if (!frame?.requestFullscreen) return setWindowFullscreen(true);
    // Bazı gömülü tarayıcılar isteği ne kabul eder ne reddeder (söz hiç sonuçlanmaz); kısa sürede
    // tam ekrana geçilmezse pencere içi moda düş.
    const fallback = setTimeout(() => {
      if (document.fullscreenElement !== frame) setWindowFullscreen(true);
    }, 400);
    frame.requestFullscreen().then(
      () => clearTimeout(fallback),
      () => {
        clearTimeout(fallback);
        setWindowFullscreen(true);
      },
    );
  }, []);
  useEffect(() => {
    const onChange = () => {
      const native = document.fullscreenElement === frameRef.current;
      setFullscreen(native);
      // Gerçek tam ekran sonradan geldiyse pencere içi mod gereksiz.
      if (native) setWindowFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    if (!windowFullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setWindowFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [windowFullscreen]);
  const anyFullscreen = fullscreen || windowFullscreen;

  // Tam ekranda kontrol paneli videonun üstünde durur (kullanıcının bilinçli tercihi; YouTube politikası
  // oynatıcının üstüne öğe koymayı yasaklar — bkz. DESIGN.md). Fare hareket edince görünür, oynarken
  // 2,5 sn hareketsizlikte kaybolur; duraklatılmışken ya da fare panelin üstündeyken açık kalır.
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overControlsRef = useRef(false);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (playingRef.current && !overControlsRef.current) setControlsVisible(false);
    }, CONTROLS_HIDE_MS);
  }, []);
  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);
  // Tam ekrana geçerken fare tam ekran düğmesinin üstündeydi; düzen değişince "pointerleave" fare
  // kıpırdayana kadar gelmez. Paneli üstünde sayma, yoksa hiç gizlenmez.
  useEffect(() => {
    overControlsRef.current = false;
  }, [anyFullscreen]);
  useEffect(() => {
    if (anyFullscreen && playing) return scheduleHide();
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setControlsVisible(true);
  }, [anyFullscreen, playing, scheduleHide]);
  useEffect(() => () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  // Kısayollar: yalnızca Boşluk (oynat/duraklat) ve F (tam ekran). Yazı alanlarında devre dışı.
  useEffect(() => {
    const isTyping = (el: EventTarget | null) =>
      el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || document.querySelector("dialog[open]")) return;
      const player = playerRef.current;
      if (!player) return;
      if (e.code === "Space") {
        // Odaktaki düğmenin Boşluk ile tıklanmasını engelle; tek davranış oynat/duraklat.
        e.preventDefault();
        if (e.repeat) return;
        if (player.getPlayerState() === PlayerState.PLAYING) player.pauseVideo();
        else player.playVideo();
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    const onKeyUp = (e: globalThis.KeyboardEvent) => {
      if (e.code === "Space" && !isTyping(e.target)) e.preventDefault();
    };
    // Videoya tıklanınca odak YouTube iframe'ine geçer ve kısayollar oraya gider; odağı geri al.
    const onBlur = () =>
      setTimeout(() => {
        if (document.activeElement === playerRef.current?.getIframe()) frameRef.current?.focus({ preventScroll: true });
      }, 0);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [toggleFullscreen]);

  const stage = (
    <div
      ref={frameRef}
      tabIndex={-1}
      className={cn(
        "flex flex-col overflow-hidden bg-black outline-none",
        // Not: "relative" ile "fixed" aynı özelliği ayarlar; ikisi birlikte verilirse fixed ezilir.
        fullscreen
          ? "relative h-full w-full"
          : windowFullscreen
            ? "fixed inset-0 z-50 h-dvh w-screen"
            : compact
              ? "relative"
              : "relative rounded-lg border border-border shadow-card",
      )}
    >
      <div
        className={cn("bg-black", anyFullscreen ? "absolute inset-0" : !videoHeight && "aspect-video")}
        style={!anyFullscreen && videoHeight ? { height: videoHeight } : undefined}
      >
        <div ref={mountRef} className="size-full [&>div]:size-full [&_iframe]:size-full" />
      </div>
      {anyFullscreen && (
        // YouTube iframe'i fare hareketini sayfaya iletmez; hareketi ve tıklamayı bu şeffaf katman yakalar.
        <div
          aria-hidden
          onPointerMove={revealControls}
          onClick={() => {
            const player = playerRef.current;
            if (!player) return;
            if (player.getPlayerState() === PlayerState.PLAYING) player.pauseVideo();
            else player.playVideo();
            revealControls();
          }}
          onDoubleClick={toggleFullscreen}
          className={cn("absolute inset-0 z-10", !controlsVisible && "cursor-none")}
        />
      )}
      <div
        onPointerEnter={() => {
          overControlsRef.current = true;
          setControlsVisible(true);
        }}
        onPointerLeave={() => {
          overControlsRef.current = false;
          if (anyFullscreen) scheduleHide();
        }}
        className={cn(
          anyFullscreen && "absolute inset-x-0 bottom-0 z-20 transition-opacity duration-base ease-calm",
          anyFullscreen && !controlsVisible && "pointer-events-none opacity-0",
        )}
      >
        <VideoControls
          playerRef={playerRef}
          ready={ready}
          playing={playing}
          fullscreen={anyFullscreen}
          overlay={anyFullscreen}
          hasPrev={current > 0}
          hasNext={current < items.length - 1}
          onPrev={() => playIndex(current - 1)}
          onNext={() => playIndex(current + 1)}
          onToggleFullscreen={toggleFullscreen}
          onReleaseFocus={() => frameRef.current?.focus({ preventScroll: true })}
        />
      </div>
    </div>
  );

  return { items, current, playIndex, save, playerRef, error, setError, stage };
}
