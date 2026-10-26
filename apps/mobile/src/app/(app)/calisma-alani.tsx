import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, PanResponder, Platform, View } from "react-native";
import { Stack, useLocalSearchParams, usePreventRemove } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BookSummary, SourceSummary } from "@unicoach/shared";
import { NotebookPanel } from "@/components/workspace/notebook-panel";
import { PdfPane } from "@/components/workspace/pdf-pane";
import { VideoPane } from "@/components/workspace/video-pane";
import { api } from "@/lib/api";
import { deviceStore } from "@/lib/storage";
import { useTheme } from "@/lib/theme";

const LAST_KEY = "uc_workspace";
const LAYOUT_KEY = "uc_workspace_layout";
/** PDF bölmesinin, PDF + defter yüksekliğindeki payı (sürüklenerek değişir) */
const DEFAULT_SPLIT = 0.5;
const clampSplit = (n: number) => Math.min(0.8, Math.max(0.2, n));

interface Selection {
  video: string | null;
  pdf: string | null;
  notebook: string | null;
}
type Pane = "video" | "pdf" | "notebook";

/**
 * Çalışma Alanı (web'deki /calisma-alani): telefonda bölmeler alt alta — üstte video, ortada PDF, altta defter.
 * PDF ile defterin arasındaki tutamak sürüklenerek boyutlandırılır. Her bölmenin tam ekran düğmesi o bölmeyi bütün
 * ekrana açar (video yatay döner); geri tuşu tam ekrandan çıkar. Bölmeler gizlenince kapanmaz (video çalmaya devam
 * eder). Seçimler adresten (`?video=&pdf=&defter=`) ya da cihazda kalan son seçimden gelir.
 */
export default function WorkspaceScreen() {
  const params = useLocalSearchParams<{ video?: string; pdf?: string; defter?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState<Selection>({ video: params.video ?? null, pdf: params.pdf ?? null, notebook: params.defter ?? null });
  const [sources, setSources] = useState<SourceSummary[] | null>(null);
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [max, setMax] = useState<Pane | null>(null);
  const [split, setSplit] = useState(DEFAULT_SPLIT);
  const restored = useRef(false);

  // Listeler (seçim pencereleri için) ve adreste seçim yoksa son çalışılan video/PDF/defter.
  useEffect(() => {
    const fromParams = !!(params.video || params.pdf || params.defter);
    void Promise.all([api.sources.list().catch(() => []), api.books.list().catch(() => []), deviceStore.get<Selection>(LAST_KEY)]).then(
      ([s, b, last]) => {
        setSources(s);
        setBooks(b);
        if (!fromParams && last) {
          setSelection({
            video: s.some((x) => x.id === last.video) ? last.video : null,
            pdf: b.some((x) => x.id === last.pdf) ? last.pdf : null,
            notebook: last.notebook,
          });
        }
        restored.current = true;
      },
    );
    void deviceStore.get<{ split: number }>(LAYOUT_KEY).then((saved) => saved && typeof saved.split === "number" && setSplit(clampSplit(saved.split)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (restored.current) deviceStore.set(LAST_KEY, selection);
  }, [selection]);

  const select = useCallback((patch: Partial<Selection>) => setSelection((s) => ({ ...s, ...patch })), []);

  // --- Tam ekran ---
  // Video tam ekranda yataya döner; çıkınca ve ekrandan çıkınca dikey kilit geri gelir.
  useEffect(() => {
    if (Platform.OS === "web") return;
    void ScreenOrientation.lockAsync(max === "video" ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, [max]);
  useEffect(
    () => () => {
      if (Platform.OS !== "web") void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    },
    [],
  );
  usePreventRemove(max !== null, () => setMax(null));

  // Klavye açıkken (defterde metin yazılırken) ekran küçülmüyor: defter klavyenin üstündeki alanı tek başına kaplar.
  const [keyboard, setKeyboard] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const shown: Pane | null = max ?? (keyboard ? "notebook" : null);
  const toggle = (pane: Pane) => setMax((m) => (m === pane ? null : pane));

  // --- PDF / defter tutamağı ---
  const areaHeight = useRef(0);
  const splitRef = useRef(split);
  splitRef.current = split;
  const dragStart = useRef(split);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStart.current = splitRef.current;
      },
      onPanResponderMove: (_, g) => {
        if (areaHeight.current) setSplit(clampSplit(dragStart.current + g.dy / areaHeight.current));
      },
      onPanResponderRelease: () => deviceStore.set(LAYOUT_KEY, { split: splitRef.current }),
      onPanResponderTerminate: () => deviceStore.set(LAYOUT_KEY, { split: splitRef.current }),
    }),
  ).current;

  const hidden = { display: "none" } as const;
  const paneStyle = (pane: Pane, normal: object) => (shown === pane ? { flex: 1 } : shown ? hidden : normal);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: max === "video" ? "#000" : colors.bg,
        paddingTop: max && max !== "video" ? insets.top : 0,
        paddingBottom: max === "video" ? 0 : Math.max(insets.bottom, keyboard),
      }}
    >
      <Stack.Screen options={{ title: "Çalışma Alanı", headerShown: max === null }} />
      <StatusBar hidden={max === "video"} />

      <View style={paneStyle("video", {})}>
        <VideoPane
          sources={sources}
          sourceId={selection.video}
          onSelect={(video) => select({ video })}
          maximized={max === "video"}
          onToggleMaximize={() => toggle("video")}
          onPlayerFullscreen={(on) => setMax(on ? "video" : null)}
        />
      </View>

      <View
        style={shown === "video" ? hidden : { flex: 1 }}
        onLayout={(e) => {
          if (!shown) areaHeight.current = e.nativeEvent.layout.height;
        }}
      >
        <View style={paneStyle("pdf", { flex: split })}>
          <PdfPane books={books} bookId={selection.pdf} onSelect={(pdf) => select({ pdf })} maximized={max === "pdf"} onToggleMaximize={() => toggle("pdf")} />
        </View>
        {!shown && (
          <View
            {...pan.panHandlers}
            accessibilityRole="adjustable"
            accessibilityLabel="PDF ile defterin boyutunu değiştir"
            hitSlop={{ top: 8, bottom: 8 }}
            style={{ height: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong }} />
          </View>
        )}
        <View style={paneStyle("notebook", { flex: 1 - split })}>
          <NotebookPanel
            notebookId={selection.notebook}
            onSelect={(notebook) => select({ notebook })}
            maximized={max === "notebook"}
            onToggleMaximize={() => toggle("notebook")}
          />
        </View>
      </View>
    </View>
  );
}
