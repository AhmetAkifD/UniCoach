import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { ArrowRight, BookOpenCheck, ChevronRight, PlayCircle } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import { findSubject, libraryProgress, type SourceSummary } from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Text } from "@/components/ui/text";
import { subjectColor } from "@/lib/subject-color";
import { useTheme } from "@/lib/theme";

/** Kartta gösterilen en fazla ders sayısı (gerisi Konular sekmesinde) */
const SUBJECTS_SHOWN = 6;

/**
 * Ana sayfadaki "Konu ilerlemen" kartı (web'deki TopicProgressCard): bütün videolardan izlenen oran, en son çalışılan
 * kaynağa "Kaldığın yerden devam et" ve derslere göre ilerleme. Hesap ortak paketteki `libraryProgress`te.
 */
export function TopicProgressCard({ sources }: { sources: SourceSummary[] | null }) {
  const { colors } = useTheme();
  const progress = sources ? libraryProgress(sources) : null;

  if (!progress || !progress.total) {
    return (
      <Card style={{ gap: spacing[3], alignItems: "center", paddingVertical: spacing[8] }}>
        <BookOpenCheck size={32} color={colors.textSubtle} strokeWidth={1.75} />
        <Text weight="semibold">Konu ilerlemen</Text>
        <Text size="sm" tone="textMuted" style={{ textAlign: "center" }}>
          {sources
            ? "Konular'a YouTube videolarını ya da oynatma listelerini ekle; izledikçe ilerlemen burada görünecek."
            : "İlerlemen yüklenemedi. Aşağı çekip yenile."}
        </Text>
        {sources && (
          <Button variant="secondary" size="sm" onPress={() => router.navigate("/konular")}>
            Konular'a git
          </Button>
        )}
      </Card>
    );
  }

  const { resume } = progress;
  const shown = progress.subjects.slice(0, SUBJECTS_SHOWN);
  return (
    <Card style={{ gap: spacing[4] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing[3] }}>
        <View style={{ gap: 2, flex: 1 }}>
          <Text size="lg" weight="semibold">
            Konu ilerlemen
          </Text>
          <Text size="sm" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
            {progress.watched} / {progress.total} video izlendi
          </Text>
        </View>
        <Text size="3xl" weight="bold" style={{ fontVariant: ["tabular-nums"] }}>
          %{progress.percent}
        </Text>
      </View>

      {resume && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Kaldığın yerden devam et: ${resume.title}`}
          onPress={() => router.push({ pathname: "/kaynak/[id]", params: { id: resume.id } })}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[3],
            padding: spacing[2],
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.surfaceMuted : "transparent",
          })}
        >
          <View style={{ width: 96, aspectRatio: 16 / 9, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.surfaceMuted }}>
            {resume.thumbnailUrl && <Image source={{ uri: resume.thumbnailUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />}
            <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
              <PlayCircle size={26} color="#fff" />
            </View>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text size="xs" weight="medium" tone="primary">
              Kaldığın yerden devam et
            </Text>
            <Text size="sm" weight="medium" numberOfLines={2}>
              {resume.title}
            </Text>
            <Text size="xs" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
              {findSubject(resume.subject)?.label ?? resume.subject} · {resume.watchedCount}/{resume.itemCount} izlendi
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textSubtle} />
        </Pressable>
      )}

      <View style={{ gap: spacing[3] }} accessibilityLabel="Derslere göre ilerleme">
        {shown.map((s) => (
          <View key={s.subject} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: subjectColor(s.subject) }} />
              <Text size="sm" style={{ flex: 1 }} numberOfLines={1}>
                {s.label}
              </Text>
              <Text size="sm" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
                {s.watched}/{s.total}
              </Text>
            </View>
            <ProgressBar value={s.percent} color={subjectColor(s.subject)} label={`${s.label} ilerlemesi`} showValue={false} />
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="link"
        onPress={() => router.navigate("/konular")}
        hitSlop={8}
        style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}
      >
        <Text size="sm" weight="medium" tone="primary">
          {progress.subjects.length > shown.length ? `Tüm dersler (${progress.subjects.length})` : "Konular'a git"}
        </Text>
        <ArrowRight size={14} color={colors.primary} />
      </Pressable>
    </Card>
  );
}
