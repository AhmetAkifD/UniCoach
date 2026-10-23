import { View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { CircleCheck, ListVideo, PlayCircle, TriangleAlert } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import type { SourceSummary } from "@unicoach/shared";
import { PressableCard } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/lib/theme";

/** Kütüphanedeki bir kaynak (video ya da oynatma listesi): küçük resim, ad, kanal, ilerleme (web'deki SourceCard). */
export function SourceCard({ source, color }: { source: SourceSummary; color: string }) {
  const { colors } = useTheme();
  const done = source.itemCount > 0 && source.watchedCount === source.itemCount;
  const percent = source.itemCount ? (source.watchedCount / source.itemCount) * 100 : 0;
  const KindIcon = source.kind === "PLAYLIST" ? ListVideo : PlayCircle;

  return (
    <PressableCard
      accessibilityLabel={`${source.title}, ${source.watchedCount}/${source.itemCount} izlendi`}
      onPress={() => router.push({ pathname: "/kaynak/[id]", params: { id: source.id } })}
      style={{ padding: 0, overflow: "hidden" }}
    >
      <View style={{ aspectRatio: 16 / 9, backgroundColor: colors.surfaceMuted }}>
        {source.thumbnailUrl && (
          <Image source={{ uri: source.thumbnailUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} />
        )}
        <View
          style={{
            position: "absolute",
            right: 8,
            bottom: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            borderRadius: radius.sm,
            backgroundColor: "rgba(0,0,0,0.75)",
            paddingHorizontal: 6,
            paddingVertical: 2,
          }}
        >
          <KindIcon size={14} color="#fff" />
          <Text size="xs" weight="medium" style={{ color: "#fff" }}>
            {source.kind === "PLAYLIST" ? `${source.itemCount} video` : "Video"}
          </Text>
        </View>
        {done && (
          <View
            style={{
              position: "absolute",
              left: 8,
              top: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              borderRadius: radius.full,
              backgroundColor: colors.successSoft,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <CircleCheck size={14} color={colors.success} />
            <Text size="xs" weight="medium" tone="success">
              Bitti
            </Text>
          </View>
        )}
      </View>
      <View style={{ padding: spacing[4], gap: spacing[2] }}>
        <Text weight="semibold" numberOfLines={2}>
          {source.title}
        </Text>
        {source.author && (
          <Text size="sm" tone="textMuted">
            {source.author}
          </Text>
        )}
        <View style={{ gap: 4, paddingTop: 2 }}>
          <ProgressBar value={percent} color={color} label={`${source.title} ilerlemesi`} showValue={false} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text size="xs" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
              {source.watchedCount}/{source.itemCount} izlendi
            </Text>
            {source.truncated && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <TriangleAlert size={14} color={colors.warning} />
                <Text size="xs" tone="warning">
                  İlk 200 video
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </PressableCard>
  );
}
