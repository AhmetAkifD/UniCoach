"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookImage,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Download,
  File,
  GalleryVertical,
  ListChecks,
  Loader2,
  Minus,
  MoveHorizontal,
  MoveVertical,
  Pencil,
  Plus,
  RectangleVertical,
  Trash2,
} from "lucide-react";
import type { BookSummary } from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToolButton, ToolGroup } from "@/components/ui/tool-button";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { openPdf, type PDFDocumentProxy } from "@/lib/pdf";
import { DEFAULT_VIEWER_PREFS, loadViewerPrefs, saveViewerPrefs, type ViewerPrefs } from "@/lib/viewer-prefs";

/** Sayfa değiştikten bu süre sonra kalınan sayfa kaydedilir. */
const SAVE_DELAY_MS = 1_000;
/** Yakınlaştırma, sayfa genişliğine sığdırılmış boyuta göre çarpandır. */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;
/** Site başlığı (64px) + yapışık araç çubuğu; sayfa konumu ve "sayfaya sığdır" bu yüksekliği hesaba katar. */
const CHROME_HEIGHT = 64 + 60;
/** Yan yana iki sayfa ve satırlar arasındaki boşluk (px). */
const GAP = 12;
/** Kaydırma görünümünde ekranın bu kadar (ekran yüksekliği oranı) üstü ve altındaki sayfalar da çizilir. */
const RENDER_AHEAD = 1.5;
/** Sayfa boyutu henüz bilinmezken A4 oranı varsayılır. */
const DEFAULT_ASPECT = 297 / 210;

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/**
 * Sayfaları satırlara böler. Tek sayfada her satır bir sayfadır. Yan yana görünümde kapak ayrıysa
 * 1. sayfa tek başına durur, ardından 2–3, 4–5… (basılı kitaptaki gibi); değilse 1–2, 3–4…
 */
function buildRows(pageCount: number, spread: boolean, coverAlone: boolean): number[][] {
  const rows: number[][] = [];
  let p = 1;
  if (spread && coverAlone && pageCount > 0) rows.push([p++]);
  while (p <= pageCount) {
    rows.push(spread && p + 1 <= pageCount ? [p, p + 1] : [p]);
    p += spread ? 2 : 1;
  }
  return rows;
}

/**
 * PDF okuyucu: araç çubuğu (sayfa, görünüm, yakınlaştırma), sayfalar ve kalınan sayfanın kaydı.
 * Soru Bankası sayfasında pencereyle birlikte kayar; `embedded` (çalışma alanı) iken kendi kutusunda kayar
 * ve bulunduğu alanın yüksekliğini doldurur.
 */
export function BookReader({
  book: initial,
  onBookChange,
  embedded = false,
}: {
  book: BookSummary;
  onBookChange?: (book: BookSummary) => void;
  embedded?: boolean;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(Math.max(1, initial.lastPage));
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const [prefs, setPrefs] = useState<ViewerPrefs>(DEFAULT_VIEWER_PREFS);
  const pageCount = doc?.numPages ?? initial.pageCount ?? 0;

  // Görünüm tercihleri tarayıcıda hatırlanır (kapak ayarı kitaba özel).
  useEffect(() => setPrefs(loadViewerPrefs(initial.id)), [initial.id]);
  const updatePrefs = (patch: Partial<ViewerPrefs>) => {
    const next = { ...prefs, ...patch };
    saveViewerPrefs(initial.id, next);
    setPrefs(next);
  };

  const rows = useMemo(
    () => buildRows(pageCount, prefs.spread, prefs.coverAlone),
    [pageCount, prefs.spread, prefs.coverAlone],
  );
  const rowIndex = Math.max(0, rows.findIndex((r) => r.includes(page)));
  /** Bir sayfanın CSS genişliği: alan genişliği (yan yana ise yarısı) × yakınlaştırma. */
  const pageWidth = Math.max(0, Math.floor((prefs.spread ? (width - GAP) / 2 : width) * zoom));

  // --- Belgeyi aç ---
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    const task = openPdf(browserApi.books.filePath(initial.id));
    task
      .then((t) => t.promise)
      .then(async (pdf) => {
        if (cancelled) return;
        // Yer tutucuların yüksekliği ilk sayfanın oranından alınır.
        const first = (await pdf.getPage(1)).getViewport({ scale: 1 });
        if (cancelled) return;
        setAspect(first.height / first.width);
        setDoc(pdf);
        setPage((p) => Math.min(p, pdf.numPages));
      })
      .catch(() => {
        if (!cancelled) setLoadError("PDF açılamadı. Bağlantını kontrol edip tekrar dene.");
      });
    return () => {
      cancelled = true;
      // Yükleme görevi kapatılınca belge ve worker bağlantısı da serbest kalır.
      void task.then((t) => t.destroy());
      setDoc(null);
    };
  }, [initial.id, attempt]);

  // --- Kalınan sayfayı kaydet ---
  const savedRef = useRef({ page: initial.lastPage, pageCount: initial.pageCount });
  const pendingRef = useRef<{ page: number; pageCount: number } | null>(null);
  const save = useCallback(
    (next: { page: number; pageCount: number }) => {
      pendingRef.current = null;
      if (savedRef.current.page === next.page && savedRef.current.pageCount === next.pageCount) return;
      savedRef.current = next;
      browserApi.books
        .saveProgress(initial.id, next)
        .then(onBookChange)
        .catch(() => undefined);
    },
    [initial.id, onBookChange],
  );
  useEffect(() => {
    if (!doc) return;
    const next = { page, pageCount: doc.numPages };
    // Sayfa sayısı ilk açılışta öğrenilir; hemen kaydedilir.
    if (savedRef.current.pageCount !== doc.numPages) return save(next);
    pendingRef.current = next;
    const timer = setTimeout(() => save(next), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [doc, page, save]);
  useEffect(() => {
    // Sekme kapanırken bekleyen kayıt kaybolmasın.
    const flush = () => {
      const pending = pendingRef.current;
      if (!pending) return;
      void fetch(`/api/books/${encodeURIComponent(initial.id)}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending),
        keepalive: true,
      });
      pendingRef.current = null;
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [initial.id]);

  // --- Alan genişliğini izle ---
  const areaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  // --- Kaydırma görünümü: ekrana yakın satırlar ve geçerli sayfa ---
  const rowsRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState<[number, number]>([0, 0]);
  /** Programla kaydırılırken geçerli sayfa kaydırma olayından yeniden hesaplanmaz. */
  const jumpingRef = useRef(false);
  const measure = useCallback(() => {
    const host = rowsRef.current;
    if (!host) return;
    const els = host.children;
    const view = visibleArea();
    const ahead = (view.bottom - view.top) * RENDER_AHEAD;
    // Görünen alanın ortasından geçen satır geçerli satırdır.
    const anchor = (view.top + view.bottom) / 2;
    let first = -1;
    let last = -1;
    let current = -1;
    for (let i = 0; i < els.length; i++) {
      const rect = els[i]!.getBoundingClientRect();
      if (rect.top > view.bottom + ahead) break;
      if (rect.bottom > view.top - ahead) {
        if (first < 0) first = i;
        last = i;
      }
      if (current < 0 && rect.bottom > anchor) current = i;
    }
    if (first >= 0) setNear((n) => (n[0] === first && n[1] === last ? n : [first, last]));
    if (!jumpingRef.current && current >= 0 && rows[current]) setPage(rows[current]![0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  useEffect(() => {
    if (!prefs.scroll || !doc) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const target: HTMLElement | Window = (embedded && scrollRef.current) || window;
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [prefs.scroll, doc, measure, embedded]);

  /** Kaydırma görünümünde bir satırı araç çubuğunun hemen altına getirir. */
  const scrollToRow = useCallback(
    (index: number, onlyIfPassed = false) => {
      const el = rowsRef.current?.children[index] as HTMLElement | undefined;
      if (!el) return;
      const top = el.getBoundingClientRect().top - visibleArea().top - 8;
      // İlk sayfa zaten ekrandaysa sayfa başlığı görünür kalsın diye kaydırılmaz.
      if (onlyIfPassed && top >= 0) return measure();
      jumpingRef.current = true;
      const box = embedded ? scrollRef.current : null;
      if (box) box.scrollTop += top;
      else window.scrollTo({ top: window.scrollY + top });
      requestAnimationFrame(() => {
        jumpingRef.current = false;
        measure();
      });
    },
    [measure],
  );

  // Açılışta ve görünüm/yakınlaştırma değişince geçerli sayfa ekranda kalsın.
  const pageRef = useRef(page);
  pageRef.current = page;
  useLayoutEffect(() => {
    if (!doc || !pageWidth || !prefs.scroll) return;
    const index = Math.max(0, rows.findIndex((r) => r.includes(pageRef.current)));
    scrollToRow(index, index === 0);
  }, [doc, prefs.scroll, rows, pageWidth, scrollToRow]);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const goTo = useCallback(
    (next: number) => {
      if (!pageCount) return;
      const clamped = Math.min(Math.max(1, next), pageCount);
      const index = Math.max(0, rows.findIndex((r) => r.includes(clamped)));
      setPage(rows[index]?.[0] ?? clamped);
      if (prefs.scroll) return scrollToRow(index);
      // Sayfa sayfa görünümde yeni sayfanın başı görünsün.
      if (embedded) {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
        return;
      }
      const top = toolbarRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 64) toolbarRef.current?.scrollIntoView({ block: "start" });
    },
    [pageCount, rows, prefs.scroll, scrollToRow, embedded],
  );
  const step = useCallback(
    (delta: 1 | -1) => {
      const target = rows[rowIndex + delta];
      if (target) goTo(target[0]!);
    },
    [rows, rowIndex, goTo],
  );

  function fitPage() {
    if (!width) return;
    const fitWidthHeight = (prefs.spread ? (width - GAP) / 2 : width) * aspect;
    const view = visibleArea();
    const available = view.bottom - view.top - 2 * GAP;
    setZoom(Math.min(1, Math.max(ZOOM_MIN, available / fitWidthHeight)));
  }

  // Kısayollar: ← → (ve PageUp/PageDown) sonraki/önceki sayfaya (yan yana görünümde sonraki çifte) geçer.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || document.querySelector("dialog[open]")) return;
      const forward = e.key === "ArrowRight" || e.key === "PageDown";
      const back = e.key === "ArrowLeft" || e.key === "PageUp";
      if (!forward && !back) return;
      e.preventDefault();
      step(forward ? 1 : -1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step]);

  const shownRows = prefs.scroll ? rows : rows.slice(rowIndex, rowIndex + 1);
  const rowOffset = prefs.scroll ? 0 : rowIndex;

  /** Sayfaların göründüğü alan (ekran koordinatı): pencere ya da kendi kaydırma kutusu */
  function visibleArea() {
    const box = embedded ? scrollRef.current : null;
    if (box) {
      const rect = box.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    }
    return { top: CHROME_HEIGHT, bottom: window.innerHeight };
  }

  const toolbar = (
<div
          ref={toolbarRef}
          className={cn(
            "flex flex-wrap items-center justify-between gap-x-3 gap-y-1",
            embedded
              ? "border-b border-border px-3 py-1.5"
              : "sticky top-16 z-20 -mx-4 scroll-mt-16 border-b border-border bg-bg/90 px-4 py-2 backdrop-blur md:mx-0 md:rounded-lg md:border md:bg-surface/90",
          )}
        >
          <div className="flex items-center gap-1">
            <ToolButton label="Önceki sayfa" onClick={() => step(-1)} disabled={!doc || rowIndex <= 0}>
              <ChevronLeft className="size-5" />
            </ToolButton>
            <PageInput page={page} pageCount={pageCount} disabled={!doc} onGo={goTo} />
            <ToolButton label="Sonraki sayfa" onClick={() => step(1)} disabled={!doc || rowIndex >= rows.length - 1}>
              <ChevronRight className="size-5" />
            </ToolButton>
          </div>
          <div className="flex flex-wrap items-center gap-y-1">
            <ToolGroup>
              <ToolButton label="Aşağı kaydırarak oku" onClick={() => updatePrefs({ scroll: true })} active={prefs.scroll}>
                <GalleryVertical className="size-5" />
              </ToolButton>
              <ToolButton label="Sayfa sayfa oku" onClick={() => updatePrefs({ scroll: false })} active={!prefs.scroll}>
                <RectangleVertical className="size-5" />
              </ToolButton>
            </ToolGroup>
            <ToolGroup>
              <ToolButton label="Tek sayfa" onClick={() => updatePrefs({ spread: false })} active={!prefs.spread}>
                <File className="size-5" />
              </ToolButton>
              <ToolButton label="Yan yana iki sayfa" onClick={() => updatePrefs({ spread: true })} active={prefs.spread}>
                <BookOpen className="size-5" />
              </ToolButton>
              {prefs.spread && (
                <ToolButton
                  label={prefs.coverAlone ? "Kapak ayrı: 1 | 2–3 | 4–5…" : "Kapak ayrı değil: 1–2 | 3–4…"}
                  onClick={() => updatePrefs({ coverAlone: !prefs.coverAlone })}
                  active={prefs.coverAlone}
                >
                  <BookImage className="size-5" />
                </ToolButton>
              )}
            </ToolGroup>
            <ToolGroup>
              <ToolButton
                label="Uzaklaştır"
                onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
                disabled={!doc || zoom <= ZOOM_MIN}
              >
                <Minus className="size-5" />
              </ToolButton>
              <span className="w-11 text-center text-sm tabular-nums text-text-muted">%{Math.round(zoom * 100)}</span>
              <ToolButton
                label="Yakınlaştır"
                onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
                disabled={!doc || zoom >= ZOOM_MAX}
              >
                <Plus className="size-5" />
              </ToolButton>
              <ToolButton label="Genişliğe sığdır" onClick={() => setZoom(1)} disabled={!doc} active={zoom === 1}>
                <MoveHorizontal className="size-5" />
              </ToolButton>
              <ToolButton label="Sayfaya sığdır" onClick={fitPage} disabled={!doc}>
                <MoveVertical className="size-5" />
              </ToolButton>
            </ToolGroup>
          </div>
        </div>
  );
  const pages = (
      <>
        <div ref={areaRef} className={cn("relative overflow-x-auto", !embedded && "min-h-[60vh]")}>
          {loadError ? (
            <Card className="flex flex-col items-center gap-3 py-14 text-center">
              <CircleAlert className="size-9 text-danger" strokeWidth={1.75} aria-hidden />
              <p className="font-semibold">{loadError}</p>
              <Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
                Tekrar dene
              </Button>
            </Card>
          ) : !doc || !pageWidth ? (
            <div className="flex justify-center pt-24" role="status">
              <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm text-text-muted shadow-card">
                <Loader2 className="size-4 animate-spin" aria-hidden /> PDF açılıyor…
              </span>
            </div>
          ) : (
            <div ref={rowsRef} className="flex w-max min-w-full flex-col" style={{ gap: GAP }}>
              {shownRows.map((row, i) => {
                const index = i + rowOffset;
                const render = !prefs.scroll || (index >= near[0] && index <= near[1]);
                const alone = prefs.spread && row.length === 1;
                // Yan yana görünümde tek kalan sayfa kitaptaki yerinde durur: kapak sağda, son tek sayfa solda.
                const coverRow = alone && row[0] === 1 && prefs.coverAlone;
                return (
                  <div key={row.join("-")} className="flex justify-center" style={{ gap: GAP }}>
                    {coverRow && <div style={{ width: pageWidth }} aria-hidden />}
                    {row.map((n) => (
                      <PdfPage key={n} doc={doc} pageNumber={n} width={pageWidth} aspect={aspect} render={render} />
                    ))}
                    {alone && !coverRow && <div style={{ width: pageWidth }} aria-hidden />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {doc && !prefs.scroll && rows.length > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="ghost" onClick={() => step(-1)} disabled={rowIndex <= 0}>
              <ChevronLeft className="size-5" aria-hidden /> Önceki
            </Button>
            <span className="text-sm tabular-nums text-text-muted">
              {rows[rowIndex]?.join("–")} / {pageCount}
            </span>
            <Button variant="ghost" onClick={() => step(1)} disabled={rowIndex >= rows.length - 1}>
              Sonraki <ChevronRight className="size-5" aria-hidden />
            </Button>
          </div>
        )}
      </>
  );

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {toolbar}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-surface-muted p-3">
          {pages}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {toolbar}
      {pages}
    </div>
  );
}

/**
 * Tek bir PDF sayfası. `render` kapalıyken aynı boyutta beyaz bir yer tutucu kalır ve çizim bellekten atılır;
 * açıkken sayfa ayrı bir canvas'a çizilip hazır olunca yer tutucunun yerine konur.
 */
const PdfPage = memo(function PdfPage({
  doc,
  pageNumber,
  width,
  aspect: fallbackAspect,
  render,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  aspect: number;
  render: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(false);
  const height = Math.floor(width * (aspect ?? fallbackAspect));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!render) {
      host.replaceChildren();
      setDrawn(false);
      return;
    }
    let cancelled = false;
    let cancelTask: (() => void) | undefined;
    void (async () => {
      try {
        const pdfPage = await doc.getPage(pageNumber);
        if (cancelled) return;
        const base = pdfPage.getViewport({ scale: 1 });
        setAspect(base.height / base.width);
        const viewport = pdfPage.getViewport({ scale: width / base.width });
        const ratio = window.devicePixelRatio || 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.className = "block size-full";
        const task = pdfPage.render({
          canvas,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        });
        cancelTask = () => task.cancel();
        await task.promise;
        if (cancelled) return;
        host.replaceChildren(canvas);
        setDrawn(true);
      } catch {
        // Yerine yenisi çizildiği ya da sayfa ekrandan uzaklaştığı için iptal edilen çizim; hata değil.
      }
    })();
    return () => {
      cancelled = true;
      cancelTask?.();
    };
  }, [doc, pageNumber, width, render]);

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-md bg-white shadow-card"
      style={{ width, height }}
      role="img"
      aria-label={`Sayfa ${pageNumber}`}
    >
      <div ref={hostRef} className="size-full" />
      {!drawn && (
        <span className="absolute inset-0 flex items-center justify-center text-sm tabular-nums text-black/30">
          {pageNumber}
        </span>
      )}
    </div>
  );
});

/** "34 / 412": sayı yazılıp Enter'a basılınca o sayfaya gider. */
function PageInput({
  page,
  pageCount,
  disabled,
  onGo,
}: {
  page: number;
  pageCount: number;
  disabled: boolean;
  onGo: (page: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <form
      className="flex items-center gap-1.5 text-sm tabular-nums text-text-muted"
      onSubmit={(e) => {
        e.preventDefault();
        const value = Number(draft);
        if (Number.isInteger(value)) onGo(value);
        setDraft(null);
        (document.activeElement as HTMLElement | null)?.blur();
      }}
    >
      <input
        aria-label="Sayfa numarası"
        inputMode="numeric"
        disabled={disabled}
        value={draft ?? String(page)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={() => setDraft(null)}
        className="h-9 w-14 rounded-md border border-border-strong bg-surface text-center text-text"
      />
      <span>/ {pageCount || "–"}</span>
    </form>
  );
}

