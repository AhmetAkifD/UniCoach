import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, Keyboard, Pressable, ScrollView, View } from "react-native";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eraser,
  FilePlus2,
  Highlighter,
  NotebookPen,
  Pencil,
  Plus,
  Redo2,
  Trash2,
  Type,
  Undo2,
} from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
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
import { PageFrame, type PageFrameHandle } from "@/components/page-frame";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { ToolButton, ToolGroup } from "@/components/ui/tool-button";
import { useDialog } from "@/components/ui/use-dialog";
import { api, API_BASE_URL } from "@/lib/api";
import { notePageHtml, type NotePageEvent, type NoteToolState } from "@/lib/note-page";
import { deviceStore } from "@/lib/storage";
import { useTheme } from "@/lib/theme";
import { PaneBar } from "./pane-bar";

/** Son değişiklikten bu süre sonra sayfa kendiliğinden kaydedilir (web'deki gibi). */
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

type SaveState = "saved" | "pending" | "saving" | "error";
type Dirty = { notebookId: string; pageId: string; content: NotePageContent };

const pageKey = (notebookId: string, pageId: string) => `${notebookId}/${pageId}`;

/**
 * Not defteri bölmesi (web'deki NotebookPanel): defter seçimi, araçlar (kalem, marker, silgi, metin), geri al/yinele,
 * sayfalar. Çizim WebView'deki sayfada (lib/note-page.ts). Her değişiklik kısa bir gecikmeyle kendiliğinden kaydedilir;
 * sayfa ya da defter değişmeden önce, uygulama arka plana geçince ve bölme kapanırken bekleyen kayıt gönderilir.
 */
export function NotebookPanel({
  notebookId,
  onSelect,
  maximized,
  onToggleMaximize,
}: {
  notebookId: string | null;
  onSelect: (id: string | null) => void;
  maximized: boolean;
  onToggleMaximize: () => void;
}) {
  const { colors } = useTheme();
  const { confirm, prompt, alert, dialog } = useDialog();
  const [notebooks, setNotebooks] = useState<NotebookSummary[] | null>(null);
  const [detail, setDetail] = useState<NotebookDetail | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [undo, setUndo] = useState<NotePageContent[]>([]);
  const [redo, setRedo] = useState<NotePageContent[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tools, setToolsState] = useState(DEFAULT_TOOLS);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const frameRef = useRef<PageFrameHandle>(null);
  const readyRef = useRef(false);
  const contentRef = useRef<NotePageContent | null>(null);
  const keyRef = useRef<string | null>(null);

  // --- Araçlar ---
  useEffect(() => {
    void deviceStore.get<Partial<NoteToolState>>(TOOLS_KEY).then((saved) => {
      if (!saved) return;
      const next = { ...DEFAULT_TOOLS, ...saved };
      setToolsState(next);
      frameRef.current?.call("setTools", next);
    });
  }, []);
  const setTools = (patch: Partial<NoteToolState>) => {
    const next = { ...tools, ...patch };
    setToolsState(next);
    frameRef.current?.call("setTools", next);
    deviceStore.set(TOOLS_KEY, next);
  };
  const toolsRef = useRef(tools);
  toolsRef.current = tools;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => notePageHtml({ background: colors.surfaceMuted, tools }), []);

  // --- Kayıt ---
  const dirtyRef = useRef<Dirty | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const dirty = dirtyRef.current;
    if (!dirty) return true;
    setSaveState("saving");
    try {
      await api.notebooks.savePage(dirty.notebookId, dirty.pageId, { content: dirty.content });
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

  const markDirty = useCallback(
    (dirty: Dirty) => {
      dirtyRef.current = dirty;
      setSaveState("pending");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") return;
      frameRef.current?.call("commitText");
      void flush();
    });
    return () => {
      sub.remove();
      void flush();
    };
  }, [flush]);

  // Klavye kapatılınca (geri tuşu) açık metin kutusu kaydedilir; textarea odakta kalsa da yazı bitmiş sayılır.
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => frameRef.current?.call("commitText"));
    return () => sub.remove();
  }, []);

  /** Sayfa değişmeden önce: açık metin kutusu kapatılır, bekleyen kayıt gönderilir. */
  const leavePage = useCallback(async () => {
    frameRef.current?.call("commitText");
    await flush();
  }, [flush]);

  // --- Sayfadan gelen olaylar ---
  function show(content: NotePageContent, key: string) {
    contentRef.current = content;
    keyRef.current = key;
    if (readyRef.current) frameRef.current?.call("load", key, content);
  }

  function onMessage(message: unknown) {
    const event = message as NotePageEvent;
    if (event.type === "ready") {
      readyRef.current = true;
      frameRef.current?.call("setTools", toolsRef.current);
      if (contentRef.current && keyRef.current) frameRef.current?.call("load", keyRef.current, contentRef.current);
      return;
    }
    const [nb, pg] = event.key.split("/");
    if (!nb || !pg) return;
    if (event.key !== keyRef.current) {
      // Sayfa değişirken kapanan metin kutusu: kendi sayfasına kaydedilir.
      void api.notebooks.savePage(nb, pg, { content: event.content }).catch(() => setSaveState("error"));
      return;
    }
    const previous = contentRef.current;
    if (previous) setUndo((u) => [...u.slice(-HISTORY_LIMIT + 1), previous]);
    setRedo([]);
    contentRef.current = event.content;
    markDirty({ notebookId: nb, pageId: pg, content: event.content });
  }

  // --- Defter ve sayfa yükleme ---
  const refreshList = useCallback(() => api.notebooks.list().then(setNotebooks, () => setNotebooks((n) => n ?? [])), []);
  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setPageId(null);
    setLoadError(null);
    if (!notebookId) return;
    void (async () => {
      await leavePage();
      try {
        const d = await api.notebooks.get(notebookId);
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
    setLoaded(false);
    setUndo([]);
    setRedo([]);
    if (!detail || !pageId) return;
    void (async () => {
      await leavePage();
      try {
        const page = await api.notebooks.page(detail.id, pageId);
        if (cancelled) return;
        show(page.content, pageKey(detail.id, pageId));
        setLoaded(true);
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
  function applyHistory(from: "undo" | "redo") {
    const current = contentRef.current;
    if (!detail || !pageId || !current) return;
    const stack = from === "undo" ? undo : redo;
    const target = stack[stack.length - 1];
    if (!target) return;
    if (from === "undo") {
      setUndo(stack.slice(0, -1));
      setRedo((r) => [...r, current]);
    } else {
      setRedo(stack.slice(0, -1));
      setUndo((u) => [...u, current]);
    }
    show(target, pageKey(detail.id, pageId));
    markDirty({ notebookId: detail.id, pageId, content: target });
  }

  // --- Defter işlemleri ---
  async function createNotebook() {
    setPickerOpen(false);
    const title = await prompt({ title: "Yeni defter", placeholder: "Defterin adı (ör. Fizik notları)", confirmLabel: "Oluştur" });
    if (!title) return;
    setBusy(true);
    try {
      const d = await api.notebooks.create({ title });
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
    setPickerOpen(false);
    const title = await prompt({ title: "Defterin adı", defaultValue: detail.title, confirmLabel: "Kaydet" });
    if (!title || title === detail.title) return;
    try {
      const d = await api.notebooks.update(detail.id, { title });
      setDetail((cur) => (cur ? { ...cur, title: d.title } : cur));
      await refreshList();
    } catch (err) {
      await alert({ title: "Ad değiştirilemedi", message: err instanceof ApiError ? err.message : undefined });
    }
  }

  async function deleteNotebook() {
    if (!detail) return;
    setPickerOpen(false);
    const ok = await confirm({
      title: "Defteri sil",
      message: `"${detail.title}" ve içindeki ${detail.pageCount} sayfa silinecek. Bu geri alınamaz.`,
      confirmLabel: "Sil",
      danger: true,
    });
    if (!ok) return;
    dirtyRef.current = null;
    try {
      await api.notebooks.remove(detail.id);
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
      await leavePage();
      const d = await api.notebooks.addPage(detail.id, { afterPageId: pageId });
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
    keyRef.current = null;
    setBusy(true);
    try {
      const d = await api.notebooks.removePage(detail.id, pageId);
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
  const title = detail?.title ?? notebooks?.find((n) => n.id === notebookId)?.title ?? null;
  const palette = tools.tool === "marker" ? NOTE_MARKER_COLORS : NOTE_PEN_COLORS;
  const activeColor = tools.tool === "marker" ? tools.markerColor : tools.tool === "text" ? tools.textColor : tools.penColor;
  const showCanvas = !!notebookId && loaded && !loadError;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceMuted }}>
      {dialog}
      <PaneBar
        icon={NotebookPen}
        title={title}
        placeholder="Defter seç"
        onPick={() => setPickerOpen(true)}
        maximized={maximized}
        onToggleMaximize={onToggleMaximize}
      >
        {notebookId && <SaveStatus state={saveState} onRetry={() => void flush()} />}
      </PaneBar>

      {detail && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}
          contentContainerStyle={{ alignItems: "center", paddingVertical: 2, paddingHorizontal: spacing[1] }}
        >
          <ToolGroup first>
            <ToolButton label="Kalem" onPress={() => setTools({ tool: "pen" })} active={tools.tool === "pen"}>
              {(c) => <Pencil size={18} color={c} />}
            </ToolButton>
            <ToolButton label="Marker" onPress={() => setTools({ tool: "marker" })} active={tools.tool === "marker"}>
              {(c) => <Highlighter size={18} color={c} />}
            </ToolButton>
            <ToolButton label="Silgi" onPress={() => setTools({ tool: "eraser" })} active={tools.tool === "eraser"}>
              {(c) => <Eraser size={18} color={c} />}
            </ToolButton>
            <ToolButton label="Metin yaz" onPress={() => setTools({ tool: "text" })} active={tools.tool === "text"}>
              {(c) => <Type size={18} color={c} />}
            </ToolButton>
          </ToolGroup>
          {tools.tool !== "eraser" && (
            <ToolGroup>
              {palette.map((c) => (
                <ToolButton
                  key={c.value}
                  label={c.label}
                  active={activeColor === c.value}
                  onPress={() =>
                    setTools(tools.tool === "marker" ? { markerColor: c.value } : tools.tool === "text" ? { textColor: c.value } : { penColor: c.value })
                  }
                >
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: c.value, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" }} />
                </ToolButton>
              ))}
            </ToolGroup>
          )}
          {tools.tool === "pen" && (
            <ToolGroup>
              {NOTE_PEN_WIDTHS.map((w, i) => (
                <ToolButton key={w} label={["İnce", "Orta", "Kalın"][i]!} onPress={() => setTools({ penWidth: w })} active={tools.penWidth === w}>
                  {(c) => <View style={{ width: 3 + i * 4, height: 3 + i * 4, borderRadius: 8, backgroundColor: c }} />}
                </ToolButton>
              ))}
            </ToolGroup>
          )}
          {tools.tool === "text" && (
            <ToolGroup>
              {NOTE_TEXT_SIZES.map((s, i) => (
                <ToolButton key={s} label={["Küçük yazı", "Orta yazı", "Büyük yazı"][i]!} onPress={() => setTools({ textSize: s })} active={tools.textSize === s}>
                  {(c) => (
                    <Text weight="semibold" style={{ fontSize: 11 + i * 4, color: c }}>
                      A
                    </Text>
                  )}
                </ToolButton>
              ))}
            </ToolGroup>
          )}
          <ToolGroup>
            <ToolButton label="Geri al" onPress={() => applyHistory("undo")} disabled={!undo.length}>
              {(c) => <Undo2 size={18} color={c} />}
            </ToolButton>
            <ToolButton label="Yinele" onPress={() => applyHistory("redo")} disabled={!redo.length}>
              {(c) => <Redo2 size={18} color={c} />}
            </ToolButton>
          </ToolGroup>
          <ToolGroup>
            <ToolButton label="Önceki sayfa" onPress={() => goPage(pageIndex - 1)} disabled={busy || pageIndex <= 0}>
              {(c) => <ChevronLeft size={20} color={c} />}
            </ToolButton>
            <Text size="sm" tone="textMuted" style={{ paddingHorizontal: 2, fontVariant: ["tabular-nums"] }}>
              {pageIndex + 1} / {detail.pages.length}
            </Text>
            <ToolButton label="Sonraki sayfa" onPress={() => goPage(pageIndex + 1)} disabled={busy || pageIndex >= detail.pages.length - 1}>
              {(c) => <ChevronRight size={20} color={c} />}
            </ToolButton>
            <ToolButton label="Bu sayfanın arkasına sayfa ekle" onPress={() => void addPage()} disabled={busy || detail.pages.length >= NOTEBOOK_MAX_PAGES}>
              {(c) => <FilePlus2 size={18} color={c} />}
            </ToolButton>
            <ToolButton label="Bu sayfayı sil" onPress={() => void deletePage()} disabled={busy || detail.pages.length < 2}>
              {(c) => <Trash2 size={17} color={c} />}
            </ToolButton>
          </ToolGroup>
        </ScrollView>
      )}

      <View style={{ flex: 1 }}>
        {/* Sayfa bir kez açılır; defter ve sayfa değişince içerik `load` ile değişir. */}
        <PageFrame
          ref={frameRef}
          html={html}
          baseUrl={`${API_BASE_URL}/`}
          background={colors.surfaceMuted}
          onMessage={onMessage}
          style={{ flex: 1, opacity: showCanvas ? 1 : 0 }}
        />
        {!showCanvas && (
          <View pointerEvents="box-none" style={{ position: "absolute", backgroundColor: colors.surfaceMuted, inset: 0, alignItems: "center", justifyContent: "center", gap: spacing[3], padding: spacing[4] }}>
            {loadError ? (
              <Text size="sm" tone="danger" style={{ textAlign: "center" }}>
                {loadError}
              </Text>
            ) : notebookId ? (
              <ActivityIndicator color={colors.primary} />
            ) : notebooks && !notebooks.length ? (
              <>
                <Text weight="semibold">Henüz defterin yok</Text>
                <Text size="sm" tone="textMuted" style={{ textAlign: "center" }}>
                  Bir defter aç; kalemle yaz, önemli yerleri marker'la işaretle ya da klavyeyle not al. Notların kendiliğinden kaydedilir.
                </Text>
                <Button size="sm" icon={<Plus size={16} color={colors.onPrimary} />} loading={busy} onPress={() => void createNotebook()}>
                  Defter oluştur
                </Button>
              </>
            ) : (
              <Text size="sm" tone="textMuted" style={{ textAlign: "center" }}>
                Yukarıdan bir defter seç ya da yenisini oluştur.
              </Text>
            )}
          </View>
        )}
      </View>

      <Sheet visible={pickerOpen} title="Defterler" onClose={() => setPickerOpen(false)}>
        <View style={{ paddingHorizontal: spacing[4], gap: spacing[1] }}>
          {(notebooks ?? []).map((n) => {
            const on = n.id === notebookId;
            return (
              <Pressable
                key={n.id}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  setPickerOpen(false);
                  if (!on) onSelect(n.id);
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing[3],
                  minHeight: 48,
                  paddingHorizontal: spacing[3],
                  borderRadius: radius.md,
                  backgroundColor: on ? colors.primarySoft : pressed ? colors.surfaceMuted : "transparent",
                })}
              >
                <View style={{ flex: 1 }}>
                  <Text weight="medium" tone={on ? "primarySoftText" : "text"} numberOfLines={1}>
                    {n.title}
                  </Text>
                  <Text size="xs" tone="textMuted">
                    {n.pageCount} sayfa
                  </Text>
                </View>
                {on && <Check size={18} color={colors.primarySoftText} />}
              </Pressable>
            );
          })}
          <View style={{ gap: spacing[2], marginTop: spacing[3] }}>
            <Button variant="secondary" icon={<Plus size={18} color={colors.primarySoftText} />} disabled={busy} onPress={() => void createNotebook()}>
              Yeni defter
            </Button>
            {detail && (
              <View style={{ flexDirection: "row", gap: spacing[2] }}>
                <Button variant="ghost" style={{ flex: 1 }} icon={<Pencil size={16} color={colors.text} />} onPress={() => void renameNotebook()}>
                  Adını değiştir
                </Button>
                <Button variant="ghost" style={{ flex: 1 }} icon={<Trash2 size={16} color={colors.danger} />} onPress={() => void deleteNotebook()}>
                  Defteri sil
                </Button>
              </View>
            )}
            {notebookId && (
              <Button
                variant="ghost"
                onPress={() => {
                  setPickerOpen(false);
                  onSelect(null);
                }}
              >
                Defteri kapat
              </Button>
            )}
          </View>
        </View>
      </Sheet>
    </View>
  );
}

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "error") {
    return (
      <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={6}>
        <Text size="xs" weight="medium" tone="danger">
          Kaydedilemedi · Tekrar dene
        </Text>
      </Pressable>
    );
  }
  return (
    <Text size="xs" tone="textSubtle" accessibilityLiveRegion="polite">
      {state === "saved" ? "Kaydedildi" : "Kaydediliyor…"}
    </Text>
  );
}
