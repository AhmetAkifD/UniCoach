"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import {
  BookOpenText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  PlaySquare,
} from "lucide-react";
import {
  findSubject,
  type BookSummary,
  type NotebookSummary,
  type SourceDetail,
  type SourceSummary,
} from "@unicoach/shared";
import { useSourcePlayer } from "@/components/library/use-source-player";
import { BookReader } from "@/components/question-bank/book-reader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToolButton } from "@/components/ui/tool-button";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { NotebookPanel } from "./notebook-panel";

const LAST_KEY = "uc_workspace";
const LAYOUT_KEY = "uc_workspace_layout";

export interface WorkspaceSelection {
  video: string | null;
  pdf: string | null;
  notebook: string | null;
}

/** Bölmelerin boyutu (yüzde): sol sütunun genişliği ve sol sütunda videonun yüksekliği */
interface Layout {
  left: number;
  video: number;
}
const DEFAULT_LAYOUT: Layout = { left: 50, video: 42 };
const clampLayout = (l: Layout): Layout => ({
  left: Math.min(80, Math.max(20, l.left)),
  video: Math.min(85, Math.max(12, l.video)),
});

/** Fare üst kenara bu kadar yaklaşınca (px) gizli site başlığı iner. */
const HEADER_HOT_ZONE = 6;

/** Ders adına göre gruplanmış seçenekler (açılır listede optgroup) */
function bySubject<T extends { subject: string }>(list: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of list) {
    const label = findSubject(item.subject)?.label ?? item.subject;
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b, "tr"));
}

/** Geniş ekran mı (bölmeler yan yana ve boyutlandırılabilir)? */
function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

/**
 * Çalışma alanı: solda video ve altında not defteri, sağda PDF. Bölmelerin arasındaki çizgiler sürüklenerek
 * boyutlandırılır (boyutlar tarayıcıda hatırlanır). "Tam ekran" tarayıcıyı tam ekrana alır (F11 gibi) ve
 * site başlığını gizler; başlık fare ekranın üst kenarına gelince yüzer şerit olarak iner.
 * Seçimler adres çubuğunda (`?video=…&pdf=…&defter=…`) ve tarayıcıda tutulur.
 */
export function Workspace({
  sources,
  books,
  notebooks,
  initial,
}: {
  sources: SourceSummary[];
  books: BookSummary[];
  notebooks: NotebookSummary[];
  initial: WorkspaceSelection;
}) {
  const [selection, setSelection] = useState(initial);
  const wide = useWide();

  // Adreste seçim yoksa son çalışılan video/PDF/defter açılır.
  useEffect(() => {
    if (initial.video || initial.pdf || initial.notebook) return;
    try {
      const last = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null") as WorkspaceSelection | null;
      if (!last) return;
      setSelection({
        video: sources.some((s) => s.id === last.video) ? last.video : null,
        pdf: books.some((b) => b.id === last.pdf) ? last.pdf : null,
        notebook: notebooks.some((n) => n.id === last.notebook) ? last.notebook : null,
      });
    } catch {
      // Tarayıcı depolaması kapalıysa boş başlanır.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selection.video) params.set("video", selection.video);
    if (selection.pdf) params.set("pdf", selection.pdf);
    if (selection.notebook) params.set("defter", selection.notebook);
    const query = params.toString();
    window.history.replaceState(window.history.state, "", query ? `?${query}` : window.location.pathname);
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify(selection));
    } catch {
      // yok sayılır
    }
  }, [selection]);

  const select = useCallback((patch: Partial<WorkspaceSelection>) => setSelection((s) => ({ ...s, ...patch })), []);

  // --- Bölme boyutları ---
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? "null") as Layout | null;
      if (saved && typeof saved.left === "number" && typeof saved.video === "number") setLayout(clampLayout(saved));
    } catch {
      // varsayılan düzen
    }
  }, []);
  const saveLayout = (next: Layout) => {
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
    } catch {
      // yok sayılır
    }
  };

  const rootRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"col" | "row" | null>(null);

  function startDrag(kind: "col" | "row", e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    const box = (kind === "col" ? rootRef.current : leftRef.current)?.getBoundingClientRect();
    if (!box) return;
    setDragging(kind);
    let latest = layout;
    const onMove = (ev: PointerEvent) => {
      latest = clampLayout(
        kind === "col"
          ? { ...latest, left: ((ev.clientX - box.left) / box.width) * 100 }
          : { ...latest, video: ((ev.clientY - box.top) / box.height) * 100 },
      );
      setLayout(latest);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setDragging(null);
      saveLayout(latest);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function resetLayout() {
    setLayout(DEFAULT_LAYOUT);
    saveLayout(DEFAULT_LAYOUT);
  }

  // --- Tam ekran (genişletilmiş mod) ---
  const [expanded, setExpanded] = useState(false);
  const enterExpanded = () => {
    setExpanded(true);
    // Tarayıcının tam ekranı (F11 gibi); izin verilmezse (uygulama içi tarayıcılar) yalnızca pencere içi genişler.
    document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  const exitExpanded = () => {
    setExpanded(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  };
  useEffect(() => {
    // Esc ya da tarayıcının kendi düğmesiyle tam ekrandan çıkılınca mod da kapanır (videonun kendi tam ekranı hariç).
    const onChange = () => {
      if (!document.fullscreenElement) setExpanded(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  useEffect(() => {
    const html = document.documentElement;
    if (!expanded) return;
    html.setAttribute("data-workspace-expanded", "");
    const header = document.querySelector<HTMLElement>("[data-site-header]");
    const onMove = (e: PointerEvent) => {
      const open = html.hasAttribute("data-header-open");
      if (!open && e.clientY <= HEADER_HOT_ZONE) html.setAttribute("data-header-open", "");
      else if (open && header && !(e.target instanceof Node && header.contains(e.target)) && e.clientY > header.offsetHeight + 24) {
        html.removeAttribute("data-header-open");
      }
    };
    // Tarayıcı tam ekranı yoksa Esc pencere içi modu kapatır.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement && !document.querySelector("dialog[open]")) setExpanded(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      html.removeAttribute("data-workspace-expanded");
      html.removeAttribute("data-header-open");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);
  // Sayfadan ayrılırken tarayıcı tam ekranda kalmasın.
  useEffect(
    () => () => {
      if (document.fullscreenElement === document.documentElement) void document.exitFullscreen().catch(() => undefined);
    },
    [],
  );

  const expandButton = (
    <ToolButton label={expanded ? "Tam ekrandan çık (Esc)" : "Tam ekran"} onClick={expanded ? exitExpanded : enterExpanded}>
      {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
    </ToolButton>
  );

  const [videoCollapsed, setVideoCollapsed] = useState(false);
  const videoPane = (
    <VideoPane
      sources={sources}
      sourceId={selection.video}
      onSelect={(video) => select({ video })}
      fill={wide}
      collapsed={videoCollapsed}
      onToggleCollapsed={() => setVideoCollapsed((c) => !c)}
    />
  );
  // Video gizliyken ya da seçilmemişken bölmesi yalnızca başlık kadar yer kaplar, kalanı deftere kalır.
  const videoSized = !videoCollapsed && !!selection.video;
  const notebookPane = (
    <Card className={cn("flex min-h-0 flex-col overflow-hidden p-0", wide ? "flex-1" : "h-[80dvh]")}>
      <NotebookPanel initialNotebooks={notebooks} notebookId={selection.notebook} onSelect={(notebook) => select({ notebook })} />
    </Card>
  );
  const pdfPane = (
    <PdfPane
      books={books}
      bookId={selection.pdf}
      onSelect={(pdf) => select({ pdf })}
      actions={wide ? expandButton : null}
      className={wide ? "h-full" : "h-[85dvh]"}
    />
  );

  return (
    <div data-wide className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Çalışma Alanı</h1>
          <p className="text-sm text-text-muted">Videonu izlerken PDF'inden çalış, defterine not al.</p>
        </div>
        {wide && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={resetLayout} title="Bölmeleri ilk boyutlarına döndür">
              Düzeni sıfırla
            </Button>
            <Button variant="secondary" size="sm" onClick={enterExpanded}>
              <Maximize2 className="size-4" aria-hidden /> Tam ekran
            </Button>
          </div>
        )}
      </div>

      {wide ? (
        <div
          ref={rootRef}
          className={cn(
            "flex min-h-0",
            expanded ? "fixed inset-0 z-40 bg-bg p-1.5" : "h-[calc(100dvh-14rem)] min-h-[600px]",
          )}
        >
          <div ref={leftRef} className="flex min-h-0 min-w-0 flex-col" style={{ width: `${layout.left}%` }}>
            <div className="flex min-h-0 shrink-0 flex-col" style={videoSized ? { height: `${layout.video}%` } : undefined}>
              {videoPane}
            </div>
            {videoSized ? (
              <Splitter direction="row" active={dragging === "row"} onPointerDown={(e) => startDrag("row", e)} />
            ) : (
              <div className="h-2.5 shrink-0" />
            )}
            {notebookPane}
          </div>
          <Splitter direction="col" active={dragging === "col"} onPointerDown={(e) => startDrag("col", e)} />
          <div className="min-h-0 min-w-0 flex-1">{pdfPane}</div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {videoPane}
          {notebookPane}
          {pdfPane}
        </div>
      )}

      {/* Sürüklerken fare video iframe'ine ya da çizim alanına kaçmasın. */}
      {dragging && <div className={cn("fixed inset-0 z-[70]", dragging === "col" ? "cursor-col-resize" : "cursor-row-resize")} />}
    </div>
  );
}

/** Bölmeler arasındaki tutamak: ince boşluk, üstüne gelince/sürüklerken çizgi belirir. */
function Splitter({
  direction,
  active,
  onPointerDown,
}: {
  direction: "row" | "col";
  active: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const col = direction === "col";
  return (
    <div
      role="separator"
      aria-orientation={col ? "vertical" : "horizontal"}
      aria-label={col ? "Sol ve sağ bölmenin genişliğini ayarla" : "Video ve defterin yüksekliğini ayarla"}
      onPointerDown={onPointerDown}
      className={cn(
        "group flex shrink-0 touch-none items-center justify-center",
        col ? "w-2.5 cursor-col-resize" : "h-2.5 cursor-row-resize",
      )}
    >
      <span
        className={cn(
          "rounded-full transition-colors duration-fast",
          col ? "h-12 w-1" : "h-1 w-12",
          active ? "bg-primary" : "bg-border-strong group-hover:bg-primary",
        )}
      />
    </div>
  );
}

function PaneHeader({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
      <span className="text-text-muted">{icon}</span>
      {children}
    </div>
  );
}

const selectClass = "h-9 min-w-0 flex-1 rounded-md border border-border-strong bg-surface px-2.5 text-sm text-text";

function VideoPane({
  sources,
  sourceId,
  onSelect,
  fill,
  collapsed,
  onToggleCollapsed,
}: {
  sources: SourceSummary[];
  sourceId: string | null;
  onSelect: (id: string | null) => void;
  /** Bölmenin yüksekliğini doldurur; video bu alana sığacak kadar büyür. */
  fill: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const [detail, setDetail] = useState<SourceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const groups = useMemo(() => bySubject(sources), [sources]);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    if (!sourceId) return;
    browserApi.sources
      .get(sourceId)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setError("Video açılamadı."));
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  return (
    <Card className={cn("flex min-h-0 flex-col overflow-hidden p-0", fill && !collapsed && sourceId && "h-full")}>
      <PaneHeader icon={<PlaySquare className="size-4" aria-hidden />}>
        <select aria-label="Video" value={sourceId ?? ""} onChange={(e) => onSelect(e.target.value || null)} className={selectClass}>
          <option value="">{sources.length ? "Video seç" : "Konu Anlatımı'nda video yok"}</option>
          {groups.map(([label, list]) => (
            <optgroup key={label} label={label}>
              {list.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {sourceId && (
          <>
            <Link
              href={`/konular/${sourceId}`}
              aria-label="Konu Anlatımı'nda aç"
              title="Konu Anlatımı'nda aç"
              className="inline-flex size-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text"
            >
              <ExternalLink className="size-4" />
            </Link>
            <ToolButton label={collapsed ? "Videoyu göster" : "Videoyu gizle"} onClick={onToggleCollapsed}>
              {collapsed ? <ChevronDown className="size-5" /> : <ChevronUp className="size-5" />}
            </ToolButton>
          </>
        )}
      </PaneHeader>
      {!sourceId ? (
        <p className="px-4 py-6 text-center text-sm text-text-muted">
          {sources.length ? (
            "Konu Anlatımı'ndaki videolarından birini seç."
          ) : (
            <>
              Önce <Link href="/konular" className="font-medium text-primary hover:underline">Konu Anlatımı</Link>'na video ekle.
            </>
          )}
        </p>
      ) : error ? (
        <p role="alert" className="px-4 py-6 text-center text-sm text-danger">
          {error}
        </p>
      ) : !detail ? (
        <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-text-muted" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Video açılıyor…
        </p>
      ) : (
        // Gizlenen oynatıcı kapanmaz; ses sürer, yeniden açınca kaldığı yerden görünür.
        <div className={cn("min-h-0 flex-1", collapsed && "hidden")}>
          <WorkspaceVideo key={detail.id} source={detail} fill={fill} />
        </div>
      )}
    </Card>
  );
}

/** Video alanının en küçük yüksekliği (px) */
const MIN_VIDEO_HEIGHT = 120;

function WorkspaceVideo({ source, fill }: { source: SourceDetail; fill: boolean }) {
  const areaRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [areaHeight, setAreaHeight] = useState(0);
  const [controls, setControls] = useState(0);
  // Bölmede video alanı kalan yüksekliği doldurur; kontrol şeridi tam genişlikte kalır (dar videoda iki satıra inmesin).
  const videoHeight = fill && areaHeight ? Math.max(MIN_VIDEO_HEIGHT, areaHeight - controls) : null;
  const { items, current, playIndex, error, stage } = useSourcePlayer(source, { compact: true, videoHeight });

  useEffect(() => {
    const el = areaRef.current;
    if (!el || !fill) return;
    const observer = new ResizeObserver(([entry]) => setAreaHeight(Math.floor(entry!.contentRect.height)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [fill]);

  // Kontrol şeridinin gerçek yüksekliği: oynatıcı kabının yüksekliğinden video alanı çıkarılır.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el || !videoHeight) return;
    const measured = Math.round(el.offsetHeight - videoHeight);
    if (measured > 0 && Math.abs(measured - controls) > 1) setControls(measured);
  }, [videoHeight, controls]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={areaRef} className={cn("bg-black", fill && "min-h-0 flex-1 overflow-hidden")}>
        <div ref={stageRef}>{stage}</div>
      </div>
      {error && (
        <p role="alert" className="shrink-0 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {items.length > 1 && (
        <div className="shrink-0 border-t border-border px-3 py-1.5">
          <select
            aria-label="Listedeki video"
            value={current}
            onChange={(e) => playIndex(Number(e.target.value))}
            className={cn(selectClass, "w-full")}
          >
            {items.map((item, i) => (
              <option key={item.id} value={i}>
                {i + 1}. {item.title}
                {item.watchedAt ? " ✓" : ""}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function PdfPane({
  books,
  bookId,
  onSelect,
  actions,
  className,
}: {
  books: BookSummary[];
  bookId: string | null;
  onSelect: (id: string | null) => void;
  /** Başlığın sağındaki ek düğmeler (tam ekran) */
  actions?: React.ReactNode;
  className?: string;
}) {
  const groups = useMemo(() => bySubject(books), [books]);
  const book = books.find((b) => b.id === bookId) ?? null;
  return (
    <Card className={cn("flex min-h-0 flex-col overflow-hidden p-0", className)}>
      <PaneHeader icon={<BookOpenText className="size-4" aria-hidden />}>
        <select aria-label="PDF" value={bookId ?? ""} onChange={(e) => onSelect(e.target.value || null)} className={selectClass}>
          <option value="">{books.length ? "PDF seç" : "Soru Bankası'nda PDF yok"}</option>
          {groups.map(([label, list]) => (
            <optgroup key={label} label={label}>
              {list.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {book && (
          <Link
            href={`/soru-bankasi/${book.id}`}
            aria-label="Soru Bankası'nda aç"
            title="Soru Bankası'nda aç"
            className="inline-flex size-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text"
          >
            <ExternalLink className="size-4" />
          </Link>
        )}
        {actions}
      </PaneHeader>
      {book ? (
        <div className="min-h-0 flex-1">
          <BookReader key={book.id} book={book} embedded />
        </div>
      ) : (
        <p className="px-4 py-10 text-center text-sm text-text-muted">
          {books.length ? (
            "Soru Bankası'ndaki PDF'lerinden birini seç."
          ) : (
            <>
              Önce <Link href="/soru-bankasi" className="font-medium text-primary hover:underline">Soru Bankası</Link>'na PDF yükle.
            </>
          )}
        </p>
      )}
    </Card>
  );
}
