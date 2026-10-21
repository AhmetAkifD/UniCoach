"use client";

import { useEffect, useRef, useState } from "react";
import { openPdf, type PDFDocumentProxy } from "@/lib/pdf";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";

/** Soru kutusu en fazla bu kadar büyütülür (küçük kutular bulanıklaşmasın). */
const MAX_SCALE = 2.4;
/** Üzerine gelince yakınlaştırma sınırları; tekerlek her adımda bu oranda değiştirir. */
const ZOOM_MIN = 1.25;
const ZOOM_MAX = 5;
const ZOOM_STEP = 1.15;
/** Yakınlaştırılabilir görsel netlik için daha yüksek çözünürlükte çizilir; tuval bu kadar pikseli geçmez. */
const ZOOM_CANVAS_PIXELS = 16_000_000;
/** Son kullanılan yakınlaştırma sorular arasında korunur. */
let lastZoom = 2;

/** Sınavın PDF'ini bir kez açar; sorular ondan resim olarak çizilir. */
export function usePdf(bookId: string) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError(false);
    const task = openPdf(browserApi.books.filePath(bookId));
    task
      .then((t) => t.promise)
      .then((pdf) => !cancelled && setDoc(pdf))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
      void task.then((t) => t.destroy());
    };
  }, [bookId, attempt]);
  return { doc, error, retry: () => setAttempt((a) => a + 1) };
}

/**
 * Sorunun PDF'teki kutusunu resim olarak çizer (formül ve şekiller olduğu gibi kalır). Genişlik kapsayıcıya
 * uyar; `fit` açıkken kapsayıcının yüksekliğine de sığar (sınav ekranı kaydırma gerektirmesin diye).
 * `lazy` açıkken ekrana yaklaşınca çizilir (sonuç sayfasında onlarca soru için).
 */
export function QuestionImage({
  doc,
  q,
  lazy = false,
  fit = false,
  zoomable = false,
  className,
}: {
  doc: PDFDocumentProxy | null;
  q: { page: number; x: number; y: number; w: number; h: number };
  lazy?: boolean;
  fit?: boolean;
  /** Fare üzerine gelince yakınlaşır, tekerlekle yakınlık ayarlanır (küçülen soruların okunması için). */
  zoomable?: boolean;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [visible, setVisible] = useState(!lazy);
  const [drawn, setDrawn] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<{ level: number; x: number; y: number } | null>(null);

  // Tekerlek yakınlığı değiştirir; sayfanın kaymasını engellemek için pasif olmayan dinleyici gerekir.
  useEffect(() => {
    const frame = frameRef.current;
    if (!zoomable || !frame) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => {
        const level = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, (z?.level ?? lastZoom) * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP)));
        lastZoom = level;
        return { level, x: z?.x ?? 50, y: z?.y ?? 50 };
      });
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, [zoomable]);

  /** İmlecin görseldeki yeri (yüzde) yakınlaştırmanın merkezi olur. */
  const moveZoom = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!zoomable || e.pointerType !== "mouse") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoom((z) => ({ level: z?.level ?? lastZoom, x, y }));
  };

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const resize = new ResizeObserver(([e]) => {
      setWidth(Math.floor(e!.contentRect.width));
      setHeight(Math.floor(e!.contentRect.height));
    });
    resize.observe(box);
    let seen: IntersectionObserver | undefined;
    if (lazy) {
      seen = new IntersectionObserver(([e]) => e!.isIntersecting && setVisible(true), { rootMargin: "600px 0px" });
      seen.observe(box);
    }
    return () => {
      resize.disconnect();
      seen?.disconnect();
    };
  }, [lazy]);

  const scale = !width || (fit && !height) ? 0 : Math.min(width / q.w, fit ? height / q.h : Infinity, MAX_SCALE);

  useEffect(() => {
    if (!doc || !visible || !scale) return;
    let cancelled = false;
    let cancelTask: (() => void) | undefined;
    void (async () => {
      try {
        const page = await doc.getPage(q.page);
        if (cancelled) return;
        const ratio = window.devicePixelRatio || 1;
        // Yakınlaştırılabiliyorsa en yüksek yakınlıkta da net görünsün diye büyük çizilir (piksel sınırıyla).
        const sharp = zoomable
          ? Math.max(1, Math.min(ZOOM_MAX, Math.sqrt(ZOOM_CANVAS_PIXELS / (q.w * q.h * (scale * ratio) ** 2))))
          : 1;
        const s = scale * ratio * sharp;
        // Sayfa, kutunun sol üst köşesi tuvalin başlangıcına gelecek şekilde kaydırılarak çizilir.
        const viewport = page.getViewport({ scale: s, offsetX: -q.x * s, offsetY: -q.y * s });
        const canvas = canvasRef.current!;
        canvas.width = Math.ceil(q.w * s);
        canvas.height = Math.ceil(q.h * s);
        const task = page.render({ canvas, viewport });
        cancelTask = () => task.cancel();
        await task.promise;
        if (!cancelled) setDrawn(true);
      } catch {
        // Yeni ölçüyle yeniden çizildiği için iptal edildi.
      }
    })();
    return () => {
      cancelled = true;
      cancelTask?.();
    };
  }, [doc, visible, scale, zoomable, q.page, q.x, q.y, q.w, q.h]);

  return (
    <div ref={boxRef} className={cn("w-full", fit && "flex h-full min-h-0 items-center justify-center", className)}>
      <div
        ref={frameRef}
        className={cn(
          "relative mx-auto overflow-hidden rounded-md bg-white ring-1 ring-border",
          !drawn && "animate-pulse",
          zoomable && "cursor-zoom-in",
        )}
        style={{ width: scale ? q.w * scale : "100%", height: scale ? q.h * scale : 160 }}
        onPointerMove={moveZoom}
        onPointerEnter={moveZoom}
        onPointerLeave={() => setZoom(null)}
      >
        <canvas
          ref={canvasRef}
          className="block size-full transition-transform duration-fast ease-calm"
          style={zoom ? { transform: `scale(${zoom.level})`, transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
          aria-hidden
        />
      </div>
    </div>
  );
}
