"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  NOTE_PAGE_HEIGHT,
  NOTE_PAGE_WIDTH,
  type NotePageContent,
  type NoteStroke,
  type NoteText,
} from "@unicoach/shared";
import { cn } from "@/lib/cn";

export type NoteToolName = "pen" | "marker" | "eraser" | "text";

export interface NoteToolState {
  tool: NoteToolName;
  penColor: string;
  penWidth: number;
  markerColor: string;
  markerWidth: number;
  textColor: string;
  textSize: number;
}

/** Çizgili kâğıt: satır aralığı ve sol kenar boşluğu (sayfa birimi) */
const LINE_GAP = 44;
const FIRST_LINE = 120;
const MARGIN_X = 90;
/** Silginin yarıçapı (sayfa birimi) */
const ERASER_RADIUS = 14;
/** Marker saydamlığı: altındaki yazı okunur kalır. */
const MARKER_ALPHA = 0.38;

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const round = (n: number) => Math.round(n * 10) / 10;

/** Noktalar arasından orta noktalarla geçen yumuşak çizgi */
function tracePath(ctx: CanvasRenderingContext2D, points: number[]) {
  ctx.beginPath();
  ctx.moveTo(points[0]!, points[1]!);
  if (points.length === 2) {
    ctx.lineTo(points[0]! + 0.01, points[1]!);
    return;
  }
  for (let i = 2; i < points.length - 2; i += 2) {
    const mx = (points[i]! + points[i + 2]!) / 2;
    const my = (points[i + 1]! + points[i + 3]!) / 2;
    ctx.quadraticCurveTo(points[i]!, points[i + 1]!, mx, my);
  }
  ctx.lineTo(points[points.length - 2]!, points[points.length - 1]!);
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: NoteStroke) {
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (stroke.tool === "marker") ctx.globalAlpha = MARKER_ALPHA;
  tracePath(ctx, stroke.points);
  ctx.stroke();
  ctx.restore();
}

function drawPaper(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, NOTE_PAGE_WIDTH, NOTE_PAGE_HEIGHT);
  ctx.strokeStyle = "#dbe4f0";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let y = FIRST_LINE; y < NOTE_PAGE_HEIGHT - 20; y += LINE_GAP) {
    ctx.moveTo(0, y);
    ctx.lineTo(NOTE_PAGE_WIDTH, y);
  }
  ctx.stroke();
  ctx.strokeStyle = "#f5c2c2";
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, 0);
  ctx.lineTo(MARGIN_X, NOTE_PAGE_HEIGHT);
  ctx.stroke();
}

/** Noktanın bir çizgiye uzaklığı silgi yarıçapından küçük mü? */
function hitsStroke(stroke: NoteStroke, x: number, y: number, radius: number) {
  const r = radius + stroke.width / 2;
  const r2 = r * r;
  const p = stroke.points;
  if (p.length === 2) return (p[0]! - x) ** 2 + (p[1]! - y) ** 2 <= r2;
  for (let i = 0; i < p.length - 2; i += 2) {
    const ax = p[i]!, ay = p[i + 1]!, bx = p[i + 2]!, by = p[i + 3]!;
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
    if ((ax + t * dx - x) ** 2 + (ay + t * dy - y) ** 2 <= r2) return true;
  }
  return false;
}

/**
 * Defter sayfası: alttaki tuvalde kâğıt ve kaydedilmiş çizgiler, üstteki tuvalde o an çizilen çizgi,
 * en üstte metin kutuları (HTML). Her tamamlanan işlem (çizgi, silme, metin) `onChange` ile tek adım olarak bildirilir.
 */
export function NoteCanvas({
  content,
  tools,
  onChange,
}: {
  content: NotePageContent;
  tools: NoteToolState;
  onChange: (next: NotePageContent) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const scale = width / NOTE_PAGE_WIDTH;
  const height = Math.round(NOTE_PAGE_HEIGHT * scale);

  /** Silgi sürüklenirken gizlenen çizgi ve metinler (bırakınca tek adımda silinir) */
  const [erasing, setErasing] = useState<Set<string>>(new Set());
  const erasingRef = useRef<Set<string> | null>(null);
  const liveStroke = useRef<NoteStroke | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NoteText | null>(null);
  const textRefs = useRef(new Map<string, HTMLDivElement>());
  const contentRef = useRef(content);
  contentRef.current = content;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const prepare = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas || !width) return null;
      const ratio = window.devicePixelRatio || 1;
      const w = Math.floor(width * ratio);
      const h = Math.floor(height * ratio);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
      return ctx;
    },
    [width, height, scale],
  );

  // Kaydedilmiş içerik: önce marker'lar (yazının altında kalsın), sonra kalem.
  useLayoutEffect(() => {
    const ctx = prepare(baseRef.current);
    if (!ctx) return;
    drawPaper(ctx);
    const visible = content.strokes.filter((s) => !erasing.has(s.id));
    for (const s of visible) if (s.tool === "marker") drawStroke(ctx, s);
    for (const s of visible) if (s.tool === "pen") drawStroke(ctx, s);
  }, [content, erasing, prepare]);

  const clearLive = useCallback(() => {
    const ctx = prepare(liveRef.current);
    if (!ctx) return;
    ctx.clearRect(0, 0, NOTE_PAGE_WIDTH, NOTE_PAGE_HEIGHT);
  }, [prepare]);
  useLayoutEffect(clearLive, [clearLive]);

  const toPage = (e: { clientX: number; clientY: number }) => {
    const rect = liveRef.current!.getBoundingClientRect();
    return { x: round((e.clientX - rect.left) / scale), y: round((e.clientY - rect.top) / scale) };
  };

  // --- Metin ---
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const commitDraft = useCallback(() => {
    const current = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    setEditingId(null);
    if (!current) return;
    const texts = contentRef.current.texts;
    const old = texts.find((t) => t.id === current.id);
    const trimmed = current.text.replace(/\s+$/, "");
    let next: NoteText[] | null = null;
    if (!trimmed) {
      if (old) next = texts.filter((t) => t.id !== current.id);
    } else if (!old) {
      next = [...texts, { ...current, text: trimmed }];
    } else if (old.text !== trimmed) {
      next = texts.map((t) => (t.id === current.id ? { ...current, text: trimmed } : t));
    }
    if (next) onChange({ ...contentRef.current, texts: next });
  }, [onChange]);

  // Araç değişince açık metin kutusu kaydedilir.
  useEffect(() => {
    if (tools.tool !== "text") commitDraft();
  }, [tools.tool, commitDraft]);

  function startText(x: number, y: number) {
    const w = Math.max(120, Math.min(560, NOTE_PAGE_WIDTH - x - 24));
    const text: NoteText = { id: newId(), x, y: y - tools.textSize * 0.7, w, text: "", color: tools.textColor, size: tools.textSize };
    setDraft(text);
    setEditingId(text.id);
  }

  // --- Silgi ---
  function eraseAt(x: number, y: number) {
    const hit = erasingRef.current!;
    const before = hit.size;
    for (const s of contentRef.current.strokes) {
      if (!hit.has(s.id) && hitsStroke(s, x, y, ERASER_RADIUS)) hit.add(s.id);
    }
    const rect = liveRef.current!.getBoundingClientRect();
    for (const t of contentRef.current.texts) {
      const el = textRefs.current.get(t.id);
      if (!el || hit.has(t.id)) continue;
      const r = el.getBoundingClientRect();
      const left = (r.left - rect.left) / scale;
      const top = (r.top - rect.top) / scale;
      if (x >= left - ERASER_RADIUS && x <= left + r.width / scale + ERASER_RADIUS && y >= top - ERASER_RADIUS && y <= top + r.height / scale + ERASER_RADIUS) {
        hit.add(t.id);
      }
    }
    if (hit.size !== before) setErasing(new Set(hit));
  }

  // --- İşaretçi ---
  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0 || !width) return;
    const { x, y } = toPage(e);
    if (tools.tool === "text") {
      e.preventDefault();
      // Açık kutu kaydedilir, tıklanan yerde yenisi açılır (boş bırakılan kutu kaybolur).
      commitDraft();
      startText(x, y);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tools.tool === "eraser") {
      erasingRef.current = new Set();
      eraseAt(x, y);
      return;
    }
    const marker = tools.tool === "marker";
    liveStroke.current = {
      id: newId(),
      tool: marker ? "marker" : "pen",
      color: marker ? tools.markerColor : tools.penColor,
      width: marker ? tools.markerWidth : tools.penWidth,
      points: [x, y],
    };
    drawLive();
  }

  function drawLive() {
    const stroke = liveStroke.current;
    const ctx = prepare(liveRef.current);
    if (!stroke || !ctx) return;
    ctx.clearRect(0, 0, NOTE_PAGE_WIDTH, NOTE_PAGE_HEIGHT);
    drawStroke(ctx, stroke);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (erasingRef.current) {
      const { x, y } = toPage(e);
      eraseAt(x, y);
      return;
    }
    const stroke = liveStroke.current;
    if (!stroke) return;
    // Hızlı çizimde ara noktalar kaybolmasın.
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const { x, y } = toPage(ev);
      const lx = stroke.points[stroke.points.length - 2]!;
      const ly = stroke.points[stroke.points.length - 1]!;
      if ((x - lx) ** 2 + (y - ly) ** 2 < 2.25) continue;
      if (stroke.points.length < 8000) stroke.points.push(x, y);
    }
    drawLive();
  }

  function onPointerUp() {
    if (erasingRef.current) {
      const hit = erasingRef.current;
      erasingRef.current = null;
      setErasing(new Set());
      if (hit.size) {
        const c = contentRef.current;
        onChange({ strokes: c.strokes.filter((s) => !hit.has(s.id)), texts: c.texts.filter((t) => !hit.has(t.id)) });
      }
      return;
    }
    const stroke = liveStroke.current;
    liveStroke.current = null;
    if (!stroke) return;
    onChange({ ...contentRef.current, strokes: [...contentRef.current.strokes, stroke] });
    // Alt tuval yeni içerikle çizildikten sonra üstteki temizlenir (titreme olmasın).
    requestAnimationFrame(clearLive);
  }

  const texts = draft && !content.texts.some((t) => t.id === draft.id) ? [...content.texts, draft] : content.texts;
  const drawing = tools.tool !== "text";

  return (
    <div ref={hostRef} className="w-full">
      <div
        className="relative overflow-hidden rounded-md bg-white shadow-card"
        style={{ height: height || undefined, aspectRatio: height ? undefined : `${NOTE_PAGE_WIDTH} / ${NOTE_PAGE_HEIGHT}` }}
      >
        <canvas ref={baseRef} className="absolute inset-0 size-full" aria-hidden />
        <canvas
          ref={liveRef}
          className={cn(
            "absolute inset-0 size-full",
            tools.tool === "text" ? "cursor-text" : tools.tool === "eraser" ? "cursor-cell" : "cursor-crosshair",
          )}
          // Çizerken dokunmatik ekranda sayfa kaymasın; metin aracında kaydırma serbest.
          style={{ touchAction: drawing ? "none" : "auto" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label="Not sayfası"
          role="img"
        />
        {scale > 0 &&
          texts.map((t) => {
            const editing = t.id === editingId && draft;
            const hidden = erasing.has(t.id);
            const style = {
              left: t.x * scale,
              top: t.y * scale,
              width: t.w * scale,
              color: t.color,
              fontSize: t.size * scale,
              lineHeight: 1.3,
            };
            return editing ? (
              <textarea
                key={t.id}
                autoFocus
                value={draft.text}
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                onBlur={commitDraft}
                onKeyDown={(e) => {
                  if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur();
                }}
                ref={(el) => {
                  if (!el) return;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
                rows={1}
                aria-label="Not metni"
                placeholder="Yaz…"
                className="absolute resize-none overflow-hidden rounded-sm bg-white/80 p-0 font-sans outline outline-2 outline-primary/60 placeholder:text-black/30"
                style={{ ...style, color: draft.color, fontSize: draft.size * scale }}
              />
            ) : (
              <div
                key={t.id}
                ref={(el) => {
                  if (el) textRefs.current.set(t.id, el);
                  else textRefs.current.delete(t.id);
                }}
                onPointerDown={(e) => {
                  if (tools.tool !== "text") return;
                  e.preventDefault();
                  e.stopPropagation();
                  if (draft) commitDraft();
                  setDraft(t);
                  setEditingId(t.id);
                }}
                className={cn(
                  "absolute whitespace-pre-wrap break-words font-sans",
                  tools.tool === "text" ? "cursor-text rounded-sm hover:outline hover:outline-1 hover:outline-primary/40" : "pointer-events-none",
                  hidden && "opacity-0",
                )}
                style={style}
              >
                {t.text}
              </div>
            );
          })}
      </div>
    </div>
  );
}
