import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ClipboardList, Clock, Pause, Plus, TriangleAlert } from "lucide-react-native";
import { layout, spacing } from "@unicoach/design";
import { examRemainingMs, formatClock, formatDate, formatNet, type ExamSummary } from "@unicoach/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, PressableCard } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useSyncRefresh } from "@/lib/sync";

const openExam = (id: string) => router.push({ pathname: "/sinav/[id]", params: { id } });

/** Sınavlar: devam eden sınavlar ve sonuçlar (web'deki /sinavlar). */
export default function ExamsScreen() {
  const { colors } = useTheme();
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setExams(await api.exams.list());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  // Arka planda eşitleme veriyi değiştirince (ör. web'de yapılan değişiklik) yeniden okunur.
  useSyncRefresh(() => void load());
  // Sekmeye her dönüşte (sınav çözüp gelince) yenilenir.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const newExam = () => router.push("/sinav-yeni");

  if (!exams) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[4], backgroundColor: colors.bg, padding: spacing[6] }}>
        {error ? (
          <>
            <TriangleAlert size={32} color={colors.textSubtle} strokeWidth={1.75} />
            <Text tone="textMuted" style={{ textAlign: "center" }}>
              Sınavların yüklenemedi.
            </Text>
            <Button variant="secondary" onPress={() => void load()}>
              Tekrar dene
            </Button>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  const ongoing = exams.filter((e) => !e.finishedAt);
  const finished = exams.filter((e) => e.finishedAt);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: layout.pageGutter.mobile, gap: spacing[6], paddingBottom: spacing[10] }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.primary}
          colors={[colors.primary]}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      <View style={{ gap: spacing[4] }}>
        <Text tone="textMuted">Soru Bankası'nda çıkardığın testlerle süreli deneme çöz, netini gör.</Text>
        {exams.length > 0 && (
          <Button icon={<Plus size={20} color={colors.onPrimary} />} onPress={newExam} style={{ alignSelf: "flex-start" }}>
            Yeni sınav
          </Button>
        )}
      </View>

      {exams.length === 0 && (
        <Card style={{ alignItems: "center", gap: spacing[3], paddingVertical: spacing[10] }}>
          <ClipboardList size={40} color={colors.textSubtle} strokeWidth={1.75} />
          <Text size="lg" weight="semibold">
            Henüz sınav çözmedin
          </Text>
          <Text size="sm" tone="textMuted" style={{ textAlign: "center" }}>
            Soru Bankası'nda soruları çıkardığın bir PDF'ten test seç, süreyi belirle ve başla. Sonunda netini ve yanlışlarını görürsün.
          </Text>
          <Button icon={<Plus size={20} color={colors.onPrimary} />} onPress={newExam} style={{ marginTop: spacing[2] }}>
            İlk sınavını başlat
          </Button>
        </Card>
      )}

      {ongoing.length > 0 && (
        <View style={{ gap: spacing[4] }}>
          <Text size="xl" weight="semibold" accessibilityRole="header">
            Devam eden
          </Text>
          {ongoing.map((e) => {
            const left = examRemainingMs(e);
            return (
              <PressableCard key={e.id} onPress={() => openExam(e.id)} style={{ gap: spacing[3], borderColor: colors.primary }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  {e.pausedAt ? (
                    <Badge tone="warning" icon={Pause}>
                      Duraklatıldı
                    </Badge>
                  ) : (
                    <Badge tone="primary" icon={Clock}>
                      Devam ediyor
                    </Badge>
                  )}
                  <Text size="xs" tone="textMuted">
                    {formatDate(e.startedAt)}
                  </Text>
                </View>
                <Text weight="semibold" numberOfLines={2}>
                  {e.title}
                </Text>
                <Text size="sm" tone="textMuted">
                  {e.bookTitle}
                </Text>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text size="sm" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
                    {e.answeredCount}/{e.questionCount} cevaplandı
                  </Text>
                  {left !== null && (
                    <Text size="sm" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
                      Kalan {formatClock(left)}
                    </Text>
                  )}
                </View>
              </PressableCard>
            );
          })}
        </View>
      )}

      {finished.length > 0 && (
        <View style={{ gap: spacing[4] }}>
          <Text size="xl" weight="semibold" accessibilityRole="header">
            Sonuçlar
          </Text>
          {finished.map((e) => (
            <PressableCard key={e.id} onPress={() => openExam(e.id)} style={{ gap: spacing[3] }}>
              <View style={{ flexDirection: "row", gap: spacing[3], alignItems: "flex-start" }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text weight="semibold" numberOfLines={2}>
                    {e.title}
                  </Text>
                  <Text size="sm" tone="textMuted" numberOfLines={1}>
                    {e.bookTitle}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text size="3xl" weight="bold" style={{ fontVariant: ["tabular-nums"] }}>
                    {formatNet(e.net ?? 0)}
                  </Text>
                  <Text size="xs" tone="textMuted">
                    net
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", gap: spacing[3] }}>
                  <Text size="sm" tone="success">
                    {e.correct} D
                  </Text>
                  <Text size="sm" tone="danger">
                    {e.wrong} Y
                  </Text>
                  <Text size="sm" tone="textMuted">
                    {e.blank} B
                  </Text>
                </View>
                <Text size="xs" tone="textMuted">
                  {formatDate(e.finishedAt!)}
                </Text>
              </View>
            </PressableCard>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
