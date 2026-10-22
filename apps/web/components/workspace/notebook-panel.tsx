"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Eraser,
  FilePlus2,
  Highlighter,
  Loader2,
  NotebookPen,
  Pencil,
  Plus,
  Redo2,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import {
  ApiError,
  NOTE_MARKER_COLORS,
  NOTE_MARKER_WIDTH,
  NOTE_PEN_COLORS,
  NOTE_PEN_WIDTHS,
  NOTE_TEXT_SIZES,
  NOTEBOOK_MAX_PAGES,
  type NotebookDetail,
  type NotebookSummary,
  type NotePageContent,
} from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { ToolButton, ToolGroup } from "@/components/ui/tool-button";
import { useDialog } from "@/components/ui/use-dialog";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { NoteCanvas, type NoteToolState } from "./note-canvas";

/** Son değişiklikten bu süre sonra sayfa kendiliğinden kaydedilir. */
const SAVE_DELAY_MS = 800;
const HISTORY_LIMIT = 100;
const TOOLS_KEY = "uc_note_tools";

const DEFAULT_TOOLS: NoteToolState = {
  tool: "pen",
  penColor: NOTE_PEN_COLORS[0].value,
  penWidth: NOTE_PEN_WIDTHS[1],
  markerColor: NOTE_MARKER_COLORS[0].value,
  markerWidth: NOTE_MARKER_WIDTH,
  textColor: NOTE_PEN_COLORS[0].value,
  textSize: NOTE_TEXT_SIZES[1],
};

function loadTools(): NoteToolState {
  try {
    const raw = localStorage.getItem(TOOLS_KEY);
    return raw ? { ...DEFAULT_TOOLS, ...(JSON.parse(raw) as Partial<NoteToolState>) } : DEFAULT_TOOLS;
  } catch {
    return DEFAULT_TOOLS;
  }
}

type SaveState = "saved" | "pending" | "saving" | "error";

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/**
 * Not defteri: defter seçimi, araçlar (kalem, marker, silgi, metin), geri al/yinele, sayfalar.
 * Her değişiklik kısa bir gecikmeyle kendiliğinden kaydedilir; sayfa ya da defter değişmeden önce bekleyen kayıt gönderilir.
 */
export function NotebookPanel({
  initialNotebooks,
  notebookId,
  onSelect,
}: {
  initialNotebooks: NotebookSummary[];
  notebookId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { confirm, prompt, alert, dialog } = useDialog();
  const [notebooks, setNotebooks] = useState(initialNotebooks);
  const [detail, setDetail] = useState<NotebookDetail | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [content, setContent] = useState<NotePageContent | null>(null);
  const [undo, setUndo] = useState<NotePageContent[]>([]);
  const [redo, setRedo] = useState<NotePageContent[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tools, setToolsState] = useState(DEFAULT_TOOLS);
  const [busy, setBusy] = useState(false);

  useEffect(() => setToolsState(loadTools()), []);
  const setTools = (patch: Partial<NoteToolState>) =>
    setToolsState((t) => {
      const next = { ...t, ...patch };
      try {
        localStorage.setItem(TOOLS_KEY, JSON.stringify(next));
      } catch {
        // Tarayıcı depolaması kapalıysa araç seçimi yalnızca bu oturumda kalır.
      }
      return next;
    });

  // --- Kayıt ---
  const dirtyRef = useRef<{ notebookId: string; pageId: string; content: NotePageContent } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const dirty = dirtyRef.current;
    if (!dirty) return true;
    setSaveState("saving");
    try {
      await browserApi.notebooks.savePage(dirty.notebookId, dirty.pageId, { content: dirty.content });
      // Kayıt sürerken yeni değişiklik geldiyse o da sırada kalır.
      if (dirtyRef.current === dirty) {
        dirtyRef.current = null;
        setSaveState("saved");
      } else {
        setSaveState("pending");
      }
      return true;
    } catch {
      setSaveState("error");
      return false;
    }
  }, []);

  const change = useCallback(
    (next: NotePageContent) => {
      if (!detail || !pageId || !content) return;
      setUndo((u) => [...u.slice(-HISTORY_LIMIT + 1), content]);
      setRedo([]);
      setContent(next);
      dirtyRef.current = { notebookId: detail.id, pageId, content: next };
      setSaveState("pending");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [detail, pageId, content, flush],
  );

  // Sekme kapanırken bekleyen kayıt kaybolmasın (keepalive; çok büyük sayfalarda tarayıcı reddedebilir).
  useEffect(() => {
    const onHide = () => {
      const dirty = dirtyRef.current;
      if (!dirty) return;
      void fetch(browserApi.notebooks.pagePath(dirty.notebookId, dirty.pageId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: dirty.content }),
        keepalive: true,
      });
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void flush();
    };
  }, [flush]);

  // --- Defter ve sayfa yükleme ---
  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setPageId(null);
    setContent(null);
    setLoadError(null);
    if (!notebookId) return;
    void (async () => {
      await flush();
      try {
        const d = await browserApi.notebooks.get(notebookId);
        if (cancelled) return;
        setDetail(d);
        setPageId(d.pages[0]?.id ?? null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) onSelect(null);
        else setLoadError("Defter açılamadı.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId]);

  useEffect(() => {
    let cancelled = false;
    setContent(null);
    setUndo([]);
    setRedo([]);
    if (!detail || !pageId) return;
    void (async () => {
      await flush();
      try {
        const page = await browserApi.notebooks.page(detail.id, pageId);
        if (!cancelled) setContent(page.content);
      } catch {
        if (!cancelled) setLoadError("Sayfa açılamadı.");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id, pageId]);

  // --- Geri al / yinele ---
  const applyHistory = useCallback(
    (from: "undo" | "redo") => {
      if (!detail || !pageId || !content) return;
      const stack = from === "undo" ? undo : redo;
      const target = stack[stack.length - 1];
      if (!target) return;
      if (from === "undo") {
        setUndo(stack.slice(0, -1));
        setRedo((r) => [...r, content]);
      } else {
        setRedo(stack.slice(0, -1));
        setUndo((u) => [...u, content]);
      }
      setContent(target);
      dirtyRef.current = { notebookId: detail.id, pageId, content: target };
      setSaveState("pending");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [detail, pageId, content, undo, redo, flush],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTyping(e.target) || document.querySelector("dialog[open]")) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        applyHistory("undo");
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        applyHistory("redo");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyHistory]);

  // --- Defter işlemleri ---
  const refreshList = () => browserApi.notebooks.list().then(setNotebooks).catch(() => undefined);

  async function createNotebook() {
    const title = await prompt({ title: "Yeni defter", placeholder: "Defterin adı (ör. Fizik notları)", confirmLabel: "Oluştur" });
    if (!title) return;
    setBusy(true);
    try {
      const d = await browserApi.notebooks.create({ title });
      await refreshList();
      onSelect(d.id);
    } catch (err) {
      await alert({ title: "Defter oluşturulamadı", message: err instanceof ApiError ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function renameNotebook() {
    if (!detail) return;
    const title = await prompt({ title: "Defterin adı", defaultValue: detail.title, confirmLabel: "Kaydet" });
    if (!title || title === detail.title) return;
    try {
      const d = await browserApi.notebooks.update(detail.id, { title });
      setDetail((cur) => (cur ? { ...cur, title: d.title } : cur));
      await refreshList();
    } catch (err) {
      await alert({ title: "Ad değiştirilemedi", message: err instanceof ApiError ? err.message : undefined });
    }
  }

  async function deleteNotebook() {
    if (!detail) return;
    const ok = await confirm({
      title: "Defteri sil",
      message: `"${detail.title}" ve içindeki ${detail.pageCount} sayfa silinecek. Bu geri alınamaz.`,
      confirmLabel: "Sil",
      danger: true,
    });
    if (!ok) return;
    dirtyRef.current = null;
    try {
      await browserApi.notebooks.remove(detail.id);
      await refreshList();
      onSelect(null);
    } catch {
      await alert({ title: "Defter silinemedi" });
    }
  }

  // --- Sayfa işlemleri ---
  const pageIndex = detail && pageId ? detail.pages.findIndex((p) => p.id === pageId) : -1;

  async function addPage() {
    if (!detail || !pageId) return;
    setBusy(true);
    try {
      await flush();
      const d = await browserApi.notebooks.addPage(detail.id, { afterPageId: pageId });
      setDetail(d);
      setPageId(d.pages[pageIndex + 1]?.id ?? d.pages[d.pages.length - 1]!.id);
      void refreshList();
    } catch (err) {
      await alert({ title: "Sayfa eklenemedi", message: err instanceof ApiError ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  async function deletePage() {
    if (!detail || !pageId || detail.pages.length < 2) return;
    const ok = await confirm({
      title: `${pageIndex + 1}. sayfayı sil`,
      message: "Bu sayfadaki notlar silinecek. Bu geri alınamaz.",
      confirmLabel: "Sil",
      danger: true,
    });
    if (!ok) return;
    dirtyRef.current = null;
    setBusy(true);
    try {
      const d = await browserApi.notebooks.removePage(detail.id, pageId);
      setDetail(d);
      setPageId(d.pages[Math.min(pageIndex, d.pages.length - 1)]!.id);
      void refreshList();
    } catch (err) {
      await alert({ title: "Sayfa silinemedi", message: err instanceof ApiError ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  const goPage = (index: number) => {
    const target = detail?.pages[index];
    if (target) setPageId(target.id);
  };

  // --- Görünüm ---
  if (!notebooks.length && !notebookId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        {dialog}
        <NotebookPen className="size-10 text-text-subtle" strokeWidth={1.75} aria-hidden />
        <p className="text-lg font-semibold">Henüz defterin yok</p>
        <p className="max-w-sm text-sm text-text-muted">
          Bir defter aç; kalemle yaz, önemli yerleri marker'la işaretle ya da klavyeyle not al. Notların kendiliğinden kaydedilir.
        </p>
        <Button onClick={() => void createNotebook()} loading={busy}>
          <Plus className="size-4" aria-hidden /> Defter oluştur
        </Button>
      </div>
    );
  }

  const colors = tools.tool === "marker" ? NOTE_MARKER_COLORS : NOTE_PEN_COLORS;
  const activeColor = tools.tool === "marker" ? tools.markerColor : tools.tool === "text" ? tools.textColor : tools.penColor;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {dialog}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <select
          aria-label="Defter"
          value={notebookId ?? ""}
          onChange={(e) => onSelect(e.target.value || null)}
          className="h-9 min-w-0 max-w-[16rem] flex-1 rounded-md border border-border-strong bg-surface px-2.5 text-sm text-text"
        >
          {!notebookId && <option value="">Defter seç</option>}
          {notebooks.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
        <ToolGroup>
          <ToolButton label="Yeni defter" onClick={() => void createNotebook()} disabled={busy}>
            <Plus className="size-5" />
          </ToolButton>
          <ToolButton label="Defterin adını değiştir" onClick={() => void renameNotebook()} disabled={!detail}>
            <Pencil className="size-4" />
          </ToolButton>
          <ToolButton label="Defteri sil" onClick={() => void deleteNotebook()} disabled={!detail}>
            <Trash2 className="size-4" />
          </ToolButton>
        </ToolGroup>
        <SaveStatus state={saveState} onRetry={() => void flush()} />
      </div>

      {detail && (
        <div className="flex flex-wrap items-center gap-y-1 border-b border-border px-3 py-1.5">
          <ToolGroup>
            <ToolButton label="Kalem" onClick={() => setTools({ tool: "pen" })} active={tools.tool === "pen"}>
              <Pencil className="size-5" />
            </ToolButton>
            <ToolButton label="Marker" onClick={() => setTools({ tool: "marker" })} active={tools.tool === "marker"}>
              <Highlighter className="size-5" />
            </ToolButton>
            <ToolButton label="Silgi" onClick={() => setTools({ tool: "eraser" })} active={tools.tool === "eraser"}>
              <Eraser className="size-5" />
            </ToolButton>
            <ToolButton label="Metin yaz" onClick={() => setTools({ tool: "text" })} active={tools.tool === "text"}>
              <Type className="size-5" />
            </ToolButton>
          </ToolGroup>
          {tools.tool !== "eraser" && (
            <ToolGroup>
              {colors.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  aria-label={c.label}
                  title={c.label}
                  aria-pressed={activeColor === c.value}
                  onClick={() =>
                    setTools(
                      tools.tool === "marker" ? { markerColor: c.value } : tools.tool === "text" ? { textColor: c.value } : { penColor: c.value },
                    )
                  }
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-md hover:bg-surface-muted",
                    activeColor === c.value && "bg-primary-soft",
                  )}
                >
                  <span
                    className={cn("size-5 rounded-full border border-black/10", activeColor === c.value && "ring-2 ring-primary ring-offset-1 ring-offset-surface")}
                    style={{ backgroundColor: c.value }}
                  />
                </button>
              ))}
            </ToolGroup>
          )}
          {tools.tool === "pen" && (
            <ToolGroup>
              {NOTE_PEN_WIDTHS.map((w, i) => (
                <ToolButton key={w} label={["İnce", "Orta", "Kalın"][i]!} onClick={() => setTools({ penWidth: w })} active={tools.penWidth === w}>
                  <span className="rounded-full bg-current" style={{ width: 3 + i * 4, height: 3 + i * 4 }} />
                </ToolButton>
              ))}
            </ToolGroup>
          )}
          {tools.tool === "text" && (
            <ToolGroup>
              {NOTE_TEXT_SIZES.map((s, i) => (
                <ToolButton key={s} label={["Küçük yazı", "Orta yazı", "Büyük yazı"][i]!} onClick={() => setTools({ textSize: s })} active={tools.textSize === s}>
                  <span className="font-semibold" style={{ fontSize: 11 + i * 4 }}>
                    A
                  </span>
                </ToolButton>
              ))}
            </ToolGroup>
          )}
          <ToolGroup>
            <ToolButton label="Geri al (Ctrl+Z)" onClick={() => applyHistory("undo")} disabled={!undo.length}>
              <Undo2 className="size-5" />
            </ToolButton>
            <ToolButton label="Yinele (Ctrl+Y)" onClick={() => applyHistory("redo")} disabled={!redo.length}>
              <Redo2 className="size-5" />
            </ToolButton>
          </ToolGroup>
          <ToolGroup className="ml-auto">
            <ToolButton label="Önceki sayfa" onClick={() => goPage(pageIndex - 1)} disabled={busy || pageIndex <= 0}>
              <ChevronLeft className="size-5" />
            </ToolButton>
            <span className="px-1 text-sm tabular-nums text-text-muted">
              {pageIndex + 1} / {detail.pages.length}
            </span>
            <ToolButton label="Sonraki sayfa" onClick={() => goPage(pageIndex + 1)} disabled={busy || pageIndex >= detail.pages.length - 1}>
              <ChevronRight className="size-5" />
            </ToolButton>
            <ToolButton
              label="Bu sayfanın arkasına sayfa ekle"
              onClick={() => void addPage()}
              disabled={busy || detail.pages.length >= NOTEBOOK_MAX_PAGES}
            >
              <FilePlus2 className="size-5" />
            </ToolButton>
            <ToolButton label="Bu sayfayı sil" onClick={() => void deletePage()} disabled={busy || detail.pages.length < 2}>
              <Trash2 className="size-4" />
            </ToolButton>
          </ToolGroup>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted p-3">
        {loadError ? (
          <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-3 text-sm text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {loadError}
          </div>
        ) : !notebookId ? (
          <p className="pt-10 text-center text-sm text-text-muted">Yukarıdan bir defter seç ya da yenisini oluştur.</p>
        ) : !content ? (
          <p className="flex items-center justify-center gap-2 pt-10 text-sm text-text-muted" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Sayfa açılıyor…
          </p>
        ) : (
          <NoteCanvas key={pageId} content={content} tools={tools} onChange={change} />
        )}
      </div>
    </div>
  );
}

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "error") {
    return (
      <button type="button" onClick={onRetry} className="ml-auto text-xs font-medium text-danger hover:underline">
        Kaydedilemedi · Tekrar dene
      </button>
    );
  }
  return (
    <span className="ml-auto text-xs text-text-subtle" role="status">
      {state === "saved" ? "Kaydedildi" : "Kaydediliyor…"}
    </span>
  );
}
