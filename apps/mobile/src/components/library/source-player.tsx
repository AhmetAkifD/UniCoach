import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, View, type FlatListProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown, ChevronUp, CircleCheck, Pencil, Play, Trash2, TriangleAlert, X } from "lucide-react-native";
import { layout, radius, spacing } from "@unicoach/design";
import {
  ApiError,
  PLAYLIST_MAX_ITEMS,
  findSubject,
  formatDuration,
  type ExamTrack,
  type SourceDetail,
  type SourceItem,
  type SourceSummary,
} from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Text } from "@/components/ui/text";
import { useDialog } from "@/components/ui/use-dialog";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { SubjectSelect } from "./subject-select";
import { useSourcePlayer } from "./use-source-player";
import { YouTubeFrame } from "./youtube-frame";

/**
 * Bir kaynağın oynatıcısı (web'deki SourcePlayer): üstte video, altında başlık, ayarlar ve video listesi.
 * Oynatma ve ilerleme kaydı `useSourcePlayer`da (Çalışma Alanı da kullanır).
 */
export function SourcePlayer({
  source,
  examTrack,
  color,
  fullscreen = false,
  onFullscreenChange,
  onChanged,
  onDeleted,
}: {
  source: SourceDetail;
  examTrack: ExamTrack | null;
  color: string;
  /** Yatay ekranda video bütün ekranı kaplar, liste gizlenir. */
  fullscreen?: boolean;
  /** Oynatıcıdaki tam ekran düğmesine basıldı (ekran yönünü değiştirmek için). */
  onFullscreenChange?: (on: boolean) => void;
  onChanged: (summary: SourceSummary) => void;
  onDeleted: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { frameRef, initial, onEvent, items, current, playIndex, toggleWatched, error, setError } = useSourcePlayer(source, onFullscreenChange);
  const listRef = useRef<FlatList<SourceItem>>(null);

  // Sıradaki videoya geçilince satırı görünmüyorsa listeyi ona kaydır (ilk açılışta başlık görünür kalsın diye kaydırılmaz).
  const visibleRef = useRef(new Set<number>());
  const onViewableItemsChanged = useRef<NonNullable<FlatListProps<SourceItem>["onViewableItemsChanged"]>>(({ viewableItems }) => {
    visibleRef.current = new Set(viewableItems.flatMap((v) => (v.index == null ? [] : [v.index])));
  }).current;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!visibleRef.current.has(current)) listRef.current?.scrollToIndex({ index: current, viewPosition: 0.3, animated: true });
  }, [current]);

  const watchedCount = items.filter((it) => it.watchedAt).length;
  const currentItem = items[current];
  const nextItem = items[current + 1];

  const header = (
    <View style={{ gap: spacing[5], paddingBottom: spacing[4] }}>
      {error && (
        <View
          accessibilityRole="alert"
          style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start", borderRadius: radius.md, backgroundColor: colors.dangerSoft, padding: spacing[3] }}
        >
          <TriangleAlert size={16} color={colors.danger} style={{ marginTop: 2 }} />
          <Text size="sm" tone="danger" style={{ flex: 1 }}>
            {error}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={() => setError(undefined)} hitSlop={8}>
            <X size={16} color={colors.danger} />
          </Pressable>
        </View>
      )}

      {currentItem && (
        <View style={{ gap: spacing[2] }}>
          <Text size="sm" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
            {current + 1}. video / {items.length}
          </Text>
          <Text size="lg" weight="semibold">
            {currentItem.title}
          </Text>
          {nextItem && (
            <Text size="sm" tone="textMuted" numberOfLines={1}>
              Sıradaki: {nextItem.title}
            </Text>
          )}
          <Button
            variant={currentItem.watchedAt ? "secondary" : "ghost"}
            size="sm"
            icon={<CircleCheck size={16} color={currentItem.watchedAt ? colors.primarySoftText : colors.text} />}
            style={{ alignSelf: "flex-start", marginLeft: currentItem.watchedAt ? 0 : -spacing[3] }}
            onPress={() => toggleWatched(currentItem)}
          >
            {currentItem.watchedAt ? "İzlendi" : "İzlendi olarak işaretle"}
          </Button>
        </View>
      )}

      <SourceHeader
        source={source}
        examTrack={examTrack}
        color={color}
        watched={watchedCount}
        total={items.length}
        onChanged={onChanged}
        onDeleted={onDeleted}
      />

      {source.truncated && (
        <View style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start", borderRadius: radius.md, backgroundColor: colors.warningSoft, padding: spacing[3] }}>
          <TriangleAlert size={16} color={colors.warning} style={{ marginTop: 2 }} />
          <Text size="sm" tone="warning" style={{ flex: 1 }}>
            YouTube oynatma listelerinin yalnızca ilk {PLAYLIST_MAX_ITEMS} videosunu veriyor; listenin devamı burada görünmeyebilir.
          </Text>
        </View>
      )}

      <Text weight="medium">
        Videolar{" "}
        <Text tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
          · {watchedCount}/{items.length} izlendi
        </Text>
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Oynatıcı her zaman ilk çocuk kalır ki yön değişince WebView yeniden kurulmasın. */}
      <YouTubeFrame
        ref={frameRef}
        initial={initial}
        onEvent={onEvent}
        style={fullscreen ? { flex: 1 } : { width: "100%", aspectRatio: 16 / 9 }}
      />
      {!fullscreen && (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => item.id}
          extraData={current}
          ListHeaderComponent={header}
          contentContainerStyle={{ padding: layout.pageGutter.mobile, paddingBottom: spacing[10] + insets.bottom }}
          onViewableItemsChanged={onViewableItemsChanged}
          onScrollToIndexFailed={(info) => {
            // Satır henüz ölçülmediyse yaklaşık konuma git, sonra tekrar dene.
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
            setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, viewPosition: 0.3 }), 100);
          }}
          renderItem={({ item, index }) => (
            <ItemRow
              item={item}
              index={index}
              active={index === current}
              onPlay={() => playIndex(index)}
              onToggle={() => toggleWatched(item)}
            />
          )}
        />
      )}
    </View>
  );
}

function ItemRow({
  item,
  index,
  active,
  onPlay,
  onToggle,
}: {
  item: SourceItem;
  index: number;
  active: boolean;
  onPlay: () => void;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const meta =
    !item.watchedAt && item.positionSec > 0 && item.durationSec
      ? `${formatDuration(item.positionSec)} / ${formatDuration(item.durationSec)}`
      : item.durationSec
        ? formatDuration(item.durationSec)
        : null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing[2],
        borderRadius: radius.md,
        paddingRight: spacing[1],
        backgroundColor: active ? colors.primarySoft : "transparent",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${index + 1}. video: ${item.title}`}
        accessibilityState={{ selected: active }}
        onPress={onPlay}
        style={{ flex: 1, flexDirection: "row", alignItems: "flex-start", gap: spacing[3], paddingHorizontal: spacing[2], paddingVertical: spacing[3] }}
      >
        <View style={{ width: 26, alignItems: "flex-end", paddingTop: 2 }}>
          {active ? (
            <Play size={14} color={colors.primarySoftText} fill={colors.primarySoftText} />
          ) : (
            <Text size="xs" tone="textSubtle" style={{ fontVariant: ["tabular-nums"] }}>
              {index + 1}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text
            size="sm"
            numberOfLines={2}
            weight={active ? "medium" : "regular"}
            tone={active ? "primarySoftText" : item.watchedAt ? "textMuted" : "text"}
          >
            {item.title}
          </Text>
          {meta && (
            <Text size="xs" tone="textSubtle" style={{ fontVariant: ["tabular-nums"] }}>
              {meta}
            </Text>
          )}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!item.watchedAt }}
        accessibilityLabel={item.watchedAt ? `${index + 1}. videonun izlendi işaretini kaldır` : `${index + 1}. videoyu izlendi işaretle`}
        onPress={onToggle}
        hitSlop={8}
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 1,
          alignItems: "center",
          justifyContent: "center",
          borderColor: item.watchedAt ? colors.success : colors.borderStrong,
          backgroundColor: item.watchedAt ? colors.success : "transparent",
        }}
      >
        {item.watchedAt && <Check size={16} strokeWidth={2.5} color={colors.onPrimary} />}
      </Pressable>
    </View>
  );
}

/** Kaynağın adı, dersi, ilerlemesi ve ayarları (ad, ders, silme). */
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
  onChanged: (summary: SourceSummary) => void;
  onDeleted: () => void;
}) {
  const { colors } = useTheme();
  const { confirm, alert, prompt, dialog } = useDialog();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function run<T>(action: () => Promise<T>, after: (result: T) => void) {
    setPending(true);
    try {
      after(await action());
    } catch (err) {
      await alert({
        title: "Kaydedilemedi",
        message: err instanceof ApiError ? (err.errors?.title ?? err.message) : "Bir sorun oluştu, tekrar dene.",
      });
    } finally {
      setPending(false);
    }
  }

  async function rename() {
    const title = await prompt({ title: "Grup adını değiştir", placeholder: "Grup adı", defaultValue: source.title, maxLength: 120, confirmLabel: "Kaydet" });
    if (title && title !== source.title) await run(() => api.sources.update(source.id, { title }), onChanged);
  }

  async function remove() {
    const ok = await confirm({
      title: "Kaynağı sil",
      message: "Bu kaynak ve izleme ilerlemesi kütüphanenden silinsin mi?",
      confirmLabel: "Sil",
      danger: true,
    });
    if (ok) await run(() => api.sources.remove(source.id), onDeleted);
  }

  return (
    <View style={{ gap: spacing[3] }}>
      {dialog}
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <Text size="xl" weight="semibold">
        {source.title}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: spacing[4], rowGap: spacing[1] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
          <Text size="sm" tone="textMuted">
            {findSubject(source.subject)?.label ?? source.subject}
          </Text>
        </View>
        {source.author && (
          <Text size="sm" tone="textMuted">
            {source.author}
          </Text>
        )}
        <Text size="sm" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
          {watched}/{total} video izlendi
        </Text>
      </View>
      <ProgressBar value={total ? (watched / total) * 100 : 0} color={color} label="Kaynak ilerlemesi" />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: settingsOpen }}
        onPress={() => setSettingsOpen((o) => !o)}
        style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: spacing[1] }}
        hitSlop={8}
      >
        <Text size="sm" tone="textMuted">
          Ayarlar
        </Text>
        {settingsOpen ? <ChevronUp size={16} color={colors.textMuted} /> : <ChevronDown size={16} color={colors.textMuted} />}
      </Pressable>
      {settingsOpen && (
        <View style={{ gap: spacing[3] }}>
          <SubjectSelect
            value={source.subject}
            examTrack={examTrack}
            disabled={pending}
            onChange={(subject) => void run(() => api.sources.update(source.id, { subject }), onChanged)}
          />
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              icon={<Pencil size={16} color={colors.primarySoftText} />}
              onPress={() => void rename()}
              style={{ flex: 1 }}
            >
              Adını değiştir
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              icon={<Trash2 size={16} color={colors.onPrimary} />}
              onPress={() => void remove()}
              style={{ flex: 1 }}
            >
              Kaynağı sil
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}
