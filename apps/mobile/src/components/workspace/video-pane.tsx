import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { ChevronLeft, ChevronRight, CircleCheck, Minimize2, PlaySquare } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import { ApiError, type SourceDetail, type SourceSummary } from "@unicoach/shared";
import { YouTubeFrame } from "@/components/library/youtube-frame";
import { useSourcePlayer } from "@/components/library/use-source-player";
import { Text } from "@/components/ui/text";
import { ToolButton } from "@/components/ui/tool-button";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { PaneBar } from "./pane-bar";
import { PickSheet } from "./pick-sheet";

/**
 * Çalışma Alanı'nın video bölmesi: seçili kaynağın oynatıcısı (Konu Anlatımı ile aynı `useSourcePlayer`; ilerleme
 * aynı kurallarla kaydedilir). Başlık şeridinde önceki/sonraki video ve izlendi işareti. Tam ekranda (yatay) video
 * ekranı kaplar; köşedeki düğme ya da geri tuşu çıkar.
 */
export function VideoPane({
  sources,
  sourceId,
  onSelect,
  maximized,
  onToggleMaximize,
  onPlayerFullscreen,
}: {
  sources: SourceSummary[] | null;
  sourceId: string | null;
  onSelect: (id: string | null) => void;
  maximized: boolean;
  onToggleMaximize: () => void;
  /** YouTube'un kendi tam ekran düğmesi */
  onPlayerFullscreen: (on: boolean) => void;
}) {
  const { colors } = useTheme();
  const [source, setSource] = useState<SourceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    setError(null);
    if (!sourceId) return;
    api.sources.get(sourceId).then(
      (s) => !cancelled && setSource(s),
      (err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) onSelect(null);
        else setError("Video açılamadı.");
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  const picker = (
    <PickSheet
      visible={pickerOpen}
      title="Video seç"
      items={sources}
      value={sourceId}
      empty="Konu Anlatımı'na henüz video ya da oynatma listesi eklemedin."
      onPick={onSelect}
      onClose={() => setPickerOpen(false)}
    />
  );

  if (source) {
    return (
      <>
        <Player
          key={source.id}
          source={source}
          maximized={maximized}
          onToggleMaximize={onToggleMaximize}
          onPick={() => setPickerOpen(true)}
          onPlayerFullscreen={onPlayerFullscreen}
        />
        {picker}
      </>
    );
  }

  return (
    <View style={{ backgroundColor: colors.surface }}>
      <PaneBar icon={PlaySquare} title={null} placeholder="Video seç" onPick={() => setPickerOpen(true)} maximized={maximized} onToggleMaximize={onToggleMaximize} />
      <View style={{ height: 96, alignItems: "center", justifyContent: "center", padding: spacing[4] }}>
        {error ? (
          <Text size="sm" tone="danger">
            {error}
          </Text>
        ) : sourceId ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text size="sm" tone="textMuted" style={{ textAlign: "center" }}>
            Konu Anlatımı'ndaki videolarından birini seç; izlerken aşağıda PDF'inden çalış, defterine not al.
          </Text>
        )}
      </View>
      {picker}
    </View>
  );
}

function Player({
  source,
  maximized,
  onToggleMaximize,
  onPick,
  onPlayerFullscreen,
}: {
  source: SourceDetail;
  maximized: boolean;
  onToggleMaximize: () => void;
  onPick: () => void;
  onPlayerFullscreen: (on: boolean) => void;
}) {
  const { colors } = useTheme();
  const { frameRef, initial, onEvent, items, current, playIndex, toggleWatched, error, setError } = useSourcePlayer(source, onPlayerFullscreen);
  const item = items[current];
  const many = items.length > 1;

  return (
    <View style={maximized ? { flex: 1, backgroundColor: "#000" } : { backgroundColor: colors.surface }}>
      {!maximized && (
        <PaneBar
          icon={PlaySquare}
          title={many ? `${current + 1}/${items.length} · ${item?.title ?? source.title}` : (item?.title ?? source.title)}
          placeholder="Video seç"
          onPick={onPick}
          maximized={maximized}
          onToggleMaximize={onToggleMaximize}
        >
          {many && (
            <>
              <ToolButton label="Önceki video" disabled={current <= 0} onPress={() => playIndex(current - 1)}>
                {(c) => <ChevronLeft size={20} color={c} />}
              </ToolButton>
              <ToolButton label="Sonraki video" disabled={current >= items.length - 1} onPress={() => playIndex(current + 1)}>
                {(c) => <ChevronRight size={20} color={c} />}
              </ToolButton>
            </>
          )}
          {item && (
            <ToolButton label={item.watchedAt ? "İzlendi işaretini kaldır" : "İzlendi olarak işaretle"} active={!!item.watchedAt} onPress={() => toggleWatched(item)}>
              {(c) => <CircleCheck size={18} color={c} />}
            </ToolButton>
          )}
        </PaneBar>
      )}
      {/* Oynatıcı ağaçta yerini korur ki tam ekrana geçince WebView yeniden kurulmasın. */}
      <YouTubeFrame ref={frameRef} initial={initial} onEvent={onEvent} style={maximized ? { flex: 1 } : { width: "100%", aspectRatio: 16 / 9 }} />
      {maximized && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tam ekrandan çık"
          onPress={onToggleMaximize}
          hitSlop={8}
          style={{ position: "absolute", top: spacing[3], right: spacing[3], padding: spacing[2], borderRadius: radius.md, backgroundColor: "rgba(0,0,0,0.45)" }}
        >
          <Minimize2 size={20} color="#fff" />
        </Pressable>
      )}
      {error && !maximized && (
        <Pressable accessibilityRole="alert" onPress={() => setError(undefined)} style={{ backgroundColor: colors.dangerSoft, paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
          <Text size="xs" tone="danger">
            {error} (kapatmak için dokun)
          </Text>
        </Pressable>
      )}
    </View>
  );
}
