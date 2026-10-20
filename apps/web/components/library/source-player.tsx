"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CircleCheck, Pencil, Play, Trash2, TriangleAlert, X } from "lucide-react";
import {
  ApiError,
  PLAYLIST_MAX_ITEMS,
  findSubject,
  type ExamTrack,
  type ProgressInput,
  type SourceDetail,
  type SourceItem,
} from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { loadPlayerPrefs } from "@/lib/player-prefs";
import { PlayerState, createPlayer, formatDuration, loadYouTubeApi, type YTPlayer } from "@/lib/youtube";
import { SubjectSelect } from "./subject-select";
import { VideoControls } from "./video-controls";

/** Oynarken ilerleme bu aralıkla kaydedilir. */
const SAVE_INTERVAL_MS = 10_000;
/** Tam ekranda fare hareketsiz kalınca kontrol paneli bu sürede gizlenir. */
const CONTROLS_HIDE_MS = 2_500;

/** Kaldığı yerden başlatma: izlenmiş videolar baştan, yarım kalanlar kaldığı saniyeden. */
function startSeconds(item: SourceItem): number {
  if (item.watchedAt || item.positionSec < 5) return 0;
  if (item.durationSec && item.positionSec > item.durationSec - 5) return 0;
  return item.positionSec;
}

function firstUnwatched(items: SourceItem[]): number {
  const i = items.findIndex((it) => !it.watchedAt);
  return i === -1 ? 0 : i;
}

export function SourcePlayer({
  source,
  examTrack,
  color,
}: {
  source: SourceDetail;
  examTrack: ExamTrack | null;
  color: string;
}) {
  const router = useRouter();
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

  // Çalan video listede görünür kalsın. scrollIntoView sayfayı da kaydırdığı için yalnızca liste kutusu kaydırılır.
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const row = document.getElementById(`item-${items[current]?.id}`);
    if (!list || !row) return;
    const visible = row.offsetTop >= list.scrollTop && row.offsetTop + row.offsetHeight <= list.scrollTop + list.clientHeight;
    if (!visible) list.scrollTop = row.offsetTop - list.clientHeight / 3;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const watchedCount = items.filter((it) => it.watchedAt).length;
  const currentItem = items[current];
  const nextItem = items[current + 1];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/konular" className="inline-flex items-center gap-1.5 self-start text-sm text-text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Konu Anlatımı
      </Link>

      <SourceHeader
        source={source}
        examTrack={examTrack}
        color={color}
        watched={watchedCount}
        total={items.length}
        onChanged={() => router.refresh()}
        onDeleted={() => {
          router.push("/konular");
          router.refresh();
        }}
      />

      {source.truncated && (
        <div className="flex items-start gap-2 rounded-md bg-warning-soft px-3.5 py-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          YouTube oynatma listelerinin yalnızca ilk {PLAYLIST_MAX_ITEMS} videosunu veriyor; listenin devamı burada
          görünmeyebilir.
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-3 text-sm text-danger">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(undefined)} aria-label="Kapat">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-3">
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
                  : "relative rounded-lg border border-border shadow-card",
            )}
          >
            <div className={cn("bg-black", anyFullscreen ? "absolute inset-0" : "aspect-video")}>
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
          {currentItem && (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-sm text-text-muted tabular-nums">
                  {current + 1}. video / {items.length}
                </span>
                <h2 className="text-lg font-semibold leading-snug">{currentItem.title}</h2>
                {nextItem && <p className="text-sm text-text-muted">Sıradaki: {nextItem.title}</p>}
              </div>
              <Button
                variant={currentItem.watchedAt ? "secondary" : "ghost"}
                size="sm"
                onClick={() =>
                  void save(currentItem, {
                    positionSec: Math.floor(playerRef.current?.getCurrentTime() ?? currentItem.positionSec),
                    watched: !currentItem.watchedAt,
                  })
                }
              >
                <CircleCheck className="size-4" aria-hidden />
                {currentItem.watchedAt ? "İzlendi" : "İzlendi olarak işaretle"}
              </Button>
            </div>
          )}
        </div>

        <Card className="flex max-h-[70vh] flex-col overflow-hidden p-0 lg:max-h-[calc(100vh-10rem)]">
          <div className="border-b border-border px-4 py-3 text-sm font-medium">
            Videolar <span className="text-text-muted tabular-nums">· {watchedCount}/{items.length} izlendi</span>
          </div>
          <ol ref={listRef} className="relative flex-1 overflow-y-auto p-1.5">
            {items.map((item, index) => {
              const active = index === current;
              return (
                <li
                  key={item.id}
                  id={`item-${item.id}`}
                  className={cn(
                    "group flex items-center gap-2 rounded-md pr-1.5 transition-colors duration-fast",
                    active ? "bg-primary-soft" : "hover:bg-surface-muted",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => playIndex(index)}
                    aria-current={active ? "true" : undefined}
                    className="flex min-w-0 flex-1 items-start gap-3 px-2.5 py-2 text-left"
                  >
                    <span
                      className={cn(
                        "mt-0.5 w-7 shrink-0 text-right text-xs tabular-nums",
                        active ? "text-primary-soft-text" : "text-text-subtle",
                      )}
                    >
                      {active ? <Play className="ml-auto size-3.5" aria-label="Çalıyor" /> : index + 1}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span
                        className={cn(
                          "line-clamp-2 text-sm leading-snug",
                          active ? "font-medium text-primary-soft-text" : item.watchedAt ? "text-text-muted" : "text-text",
                        )}
                      >
                        {item.title}
                      </span>
                      {(item.durationSec || item.positionSec > 0) && (
                        <span className="text-xs text-text-subtle tabular-nums">
                          {!item.watchedAt && item.positionSec > 0 && item.durationSec
                            ? `${formatDuration(item.positionSec)} / ${formatDuration(item.durationSec)}`
                            : item.durationSec
                              ? formatDuration(item.durationSec)
                              : null}
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void save(item, { positionSec: item.positionSec, watched: !item.watchedAt })}
                    aria-label={item.watchedAt ? `${index + 1}. videonun izlendi işaretini kaldır` : `${index + 1}. videoyu izlendi işaretle`}
                    aria-pressed={!!item.watchedAt}
                    title={item.watchedAt ? "İzlendi işaretini kaldır" : "İzlendi işaretle"}
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-fast",
                      item.watchedAt
                        ? "border-success bg-success text-on-primary"
                        : "border-border-strong text-transparent hover:text-text-subtle",
                    )}
                  >
                    <Check className="size-4" strokeWidth={2.5} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function SourceHeader({
  source,
  examTrack,
  color,
  watched,
  total,
  onChanged,
  onDeleted,
}: {
  source: SourceDetail;
  examTrack: ExamTrack | null;
  color: string;
  watched: number;
  total: number;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(source.title);
  const [subject, setSubject] = useState(source.subject);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<unknown>, after: () => void) {
    setError(undefined);
    startTransition(async () => {
      try {
        await action();
        after();
      } catch (err) {
        setError(err instanceof ApiError ? (err.errors?.title ?? err.message) : "Kaydedilemedi.");
      }
    });
  }

  return (
    <header className="flex flex-col gap-4">
      {editing ? (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => browserApi.sources.update(source.id, { title }), () => {
              setEditing(false);
              onChanged();
            });
          }}
        >
          <div className="flex-1">
            <Input
              placeholder="Grup adı"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={error}
              autoFocus
              maxLength={120}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={pending}>
              Kaydet
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setTitle(source.title);
                setEditing(false);
                setError(undefined);
              }}
            >
              Vazgeç
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-2">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">{source.title}</h1>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Grup adını değiştir"
            title="Grup adını değiştir"
            className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text"
          >
            <Pencil className="size-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          {findSubject(source.subject)?.label ?? source.subject}
        </span>
        {source.author && <span>{source.author}</span>}
        <span className="tabular-nums">
          {watched}/{total} video izlendi
        </span>
      </div>
      <ProgressBar value={total ? (watched / total) * 100 : 0} color={color} label="Kaynak ilerlemesi" />

      <details className="group text-sm">
        <summary className="cursor-pointer select-none text-text-muted hover:text-text">Ayarlar</summary>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex-1">
            <SubjectSelect
              value={subject}
              examTrack={examTrack}
              disabled={pending}
              onChange={(next) => {
                setSubject(next);
                run(() => browserApi.sources.update(source.id, { subject: next }), onChanged);
              }}
            />
          </div>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Bu kaynak ve izleme ilerlemesi kütüphanenden silinsin mi?")) return;
              run(() => browserApi.sources.remove(source.id), onDeleted);
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Kaynağı sil
          </Button>
        </div>
        {error && !editing && <p className="mt-2 text-danger">{error}</p>}
      </details>
    </header>
  );
}
