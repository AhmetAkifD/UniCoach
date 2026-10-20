"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { savePlayerPrefs } from "@/lib/player-prefs";
import { PLAYBACK_RATES, formatDuration, type YTPlayer } from "@/lib/youtube";

const POLL_MS = 250;
const SKIP_SEC = 10;

interface Snapshot {
  time: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  rate: number;
}

const EMPTY: Snapshot = { time: 0, duration: 0, buffered: 0, volume: 100, muted: false, rate: 1 };

/**
 * Sade oynatıcı kontrolleri. YouTube oynatıcısı kendi kontrolleri kapalı (controls=0) çalışır;
 * bu şerit videonun ALTINDA durur — YouTube politikası oynatıcının üstüne öğe koymayı yasaklar.
 */
export function VideoControls({
  playerRef,
  ready,
  playing,
  fullscreen,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onToggleFullscreen,
  onReleaseFocus,
  overlay = false,
}: {
  playerRef: RefObject<YTPlayer | null>;
  ready: boolean;
  playing: boolean;
  fullscreen: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleFullscreen: () => void;
  /** Odağı oynatıcı kabına geri verir (kısayollar çalışsın diye). */
  onReleaseFocus: () => void;
  /** Tam ekranda videonun üstünde, koyu geçişli görünüm. */
  overlay?: boolean;
}) {
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  /** Sürüklenirken gösterilen konum (saniye); bırakınca sarılır. */
  const [scrub, setScrub] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Oynatıcının durumunu düzenli aralıklarla oku (IFrame API olay vermediği değerler için).
  useEffect(() => {
    if (!ready) return;
    const read = () => {
      const p = playerRef.current;
      if (!p) return;
      setSnap({
        time: p.getCurrentTime() || 0,
        duration: p.getDuration() || 0,
        buffered: p.getVideoLoadedFraction() || 0,
        volume: p.getVolume() ?? 100,
        muted: p.isMuted(),
        rate: p.getPlaybackRate() || 1,
      });
    };
    read();
    const id = setInterval(read, POLL_MS);
    return () => clearInterval(id);
  }, [ready, playerRef]);

  const player = () => (ready ? playerRef.current : null);
  const seek = (sec: number) => {
    const p = player();
    if (!p) return;
    const target = Math.max(0, Math.min(sec, snap.duration || sec));
    p.seekTo(target, true);
    setSnap((s) => ({ ...s, time: target }));
  };

  const fractionAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };
  // Sürükleme durumu ref'te: hızlı bir tıklamada basma ve bırakma aynı render'a düşebilir,
  // state'e bakan bırakma işleyicisi eski değeri görüp sarmayı atlardı.
  const draggingRef = useRef(false);
  const onTrackDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!snap.duration) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrub(fractionAt(e.clientX) * snap.duration);
  };
  const onTrackMove = (e: PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) setScrub(fractionAt(e.clientX) * snap.duration);
  };
  const onTrackUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    seek(fractionAt(e.clientX) * snap.duration);
    setScrub(null);
  };
  const onTrackKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 5 : e.key === "ArrowLeft" ? -5 : 0;
    if (!step) return;
    e.preventDefault();
    seek(snap.time + step);
  };

  const setVolume = (volume: number) => {
    const p = player();
    if (!p) return;
    p.setVolume(volume);
    if (volume > 0 && p.isMuted()) p.unMute();
    setSnap((s) => ({ ...s, volume, muted: volume === 0 ? s.muted : false }));
    savePlayerPrefs({ volume, muted: volume === 0 ? snap.muted : false });
  };
  const toggleMute = () => {
    const p = player();
    if (!p) return;
    const muted = !p.isMuted();
    if (muted) p.mute();
    else p.unMute();
    setSnap((s) => ({ ...s, muted }));
    savePlayerPrefs({ muted });
  };
  const setRate = (rate: number) => {
    const p = player();
    if (!p) return;
    p.setPlaybackRate(rate);
    setSnap((s) => ({ ...s, rate }));
    savePlayerPrefs({ rate });
  };

  const shownTime = scrub ?? snap.time;
  const progress = snap.duration ? (shownTime / snap.duration) * 100 : 0;
  const VolumeIcon = snap.muted || snap.volume === 0 ? VolumeX : snap.volume < 50 ? Volume1 : Volume2;

  // Tam ekranda şerit videonun üstünde durur; video her zaman koyu olduğundan açık renkli metin kullanılır.
  // (Normal görünümde anlamsal token'lar; buradaki beyaz/siyah DESIGN.md'de belirtilen bilinçli istisnadır.)
  const tone = overlay
    ? {
        root: "bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-3 pt-12",
        button: "text-white/85 hover:bg-white/15 hover:text-white",
        main: "text-white hover:bg-white/15",
        track: "bg-white/25",
        buffered: "bg-white/45",
        time: "text-white/90",
        total: "text-white/60",
        select: "text-white/85 hover:bg-white/15 hover:text-white [&>option]:text-black",
      }
    : {
        root: "border-t border-border bg-surface px-3 pb-2 pt-1",
        button: "text-text-muted hover:bg-surface-muted hover:text-text",
        main: "text-text hover:bg-surface-muted",
        track: "bg-surface-muted",
        buffered: "bg-border-strong",
        time: "text-text-muted",
        total: "text-text-subtle",
        select: "text-text-muted hover:bg-surface-muted hover:text-text",
      };
  const btn = (extra?: string) => cn(tone.button, extra);

  return (
    <div className={cn("flex flex-col gap-1", tone.root, !ready && "pointer-events-none opacity-60")}>
      {/* İlerleme çubuğu: tıkla ya da sürükle; odaktayken ←/→ 5 sn */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={ready ? 0 : -1}
        aria-label="Videoda konum"
        aria-valuemin={0}
        aria-valuemax={Math.floor(snap.duration)}
        aria-valuenow={Math.floor(shownTime)}
        aria-valuetext={`${formatDuration(shownTime)} / ${formatDuration(snap.duration)}`}
        onPointerDown={onTrackDown}
        onPointerMove={onTrackMove}
        onPointerUp={onTrackUp}
        onPointerCancel={() => {
          draggingRef.current = false;
          setScrub(null);
        }}
        onKeyDown={onTrackKey}
        className="group relative flex h-4 cursor-pointer touch-none items-center rounded-full"
      >
        <div
          className={cn(
            "relative h-1 w-full overflow-hidden rounded-full transition-[height] duration-fast group-hover:h-1.5",
            tone.track,
          )}
        >
          <div className={cn("absolute inset-y-0 left-0", tone.buffered)} style={{ width: `${snap.buffered * 100}%` }} />
          <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <div
          className={cn(
            "pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-card transition-opacity duration-fast",
            scrub !== null ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
          )}
          style={{ left: `${progress}%` }}
          aria-hidden
        />
      </div>

      <div className="flex items-center gap-0.5">
        <IconButton className={btn()} label="Önceki video" onClick={onPrev} disabled={!hasPrev}>
          <SkipBack className="size-4.5" />
        </IconButton>
        <IconButton
          label={playing ? "Duraklat (Boşluk)" : "Oynat (Boşluk)"}
          onClick={() => (playing ? player()?.pauseVideo() : player()?.playVideo())}
          className={tone.main}
        >
          {playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="size-5" fill="currentColor" />}
        </IconButton>
        <IconButton className={btn()} label="Sonraki video" onClick={onNext} disabled={!hasNext}>
          <SkipForward className="size-4.5" />
        </IconButton>
        <IconButton className={btn()} label={`${SKIP_SEC} saniye geri`} onClick={() => seek(snap.time - SKIP_SEC)}>
          <RotateCcw className="size-4.5" />
        </IconButton>
        <IconButton className={btn()} label={`${SKIP_SEC} saniye ileri`} onClick={() => seek(snap.time + SKIP_SEC)}>
          <RotateCw className="size-4.5" />
        </IconButton>
        <span className={cn("ml-2 text-sm tabular-nums", tone.time)}>
          {formatDuration(shownTime)}
          <span className={tone.total}> / {formatDuration(snap.duration)}</span>
        </span>

        <div className="ml-auto flex items-center gap-0.5">
          <IconButton className={btn()} label={snap.muted ? "Sesi aç" : "Sessize al"} onClick={toggleMute}>
            <VolumeIcon className="size-4.5" />
          </IconButton>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={snap.muted ? 0 : snap.volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Ses düzeyi"
            className="mr-1 hidden h-1 w-20 cursor-pointer accent-primary sm:block"
          />
          <select
            value={String(PLAYBACK_RATES.find((r) => Math.abs(r - snap.rate) < 0.01) ?? 1)}
            onChange={(e) => {
              setRate(Number(e.target.value));
              // Odak seçim kutusunda kalırsa Boşluk kısayolu çalışmaz (kutu Boşluk'u kendisi kullanır).
              e.currentTarget.blur();
              onReleaseFocus();
            }}
            aria-label="Oynatma hızı"
            className={cn("h-8 cursor-pointer rounded-md bg-transparent px-1.5 text-sm font-medium tabular-nums", tone.select)}
          >
            {PLAYBACK_RATES.map((r) => (
              <option key={r} value={r}>
                {r.toLocaleString("tr-TR")}×
              </option>
            ))}
          </select>
          <IconButton className={btn()} label={fullscreen ? "Tam ekrandan çık (F)" : "Tam ekran (F)"} onClick={onToggleFullscreen}>
            {fullscreen ? <Minimize className="size-4.5" /> : <Maximize className="size-4.5" />}
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md transition-colors duration-fast",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}
