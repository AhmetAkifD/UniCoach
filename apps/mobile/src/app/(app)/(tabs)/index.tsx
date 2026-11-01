import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Target, TrendingUp } from "lucide-react-native";
import { formatNet, type ExamSummary, type ExamTodayStats, type SourceSummary } from "@unicoach/shared";
import { layout, radius, spacing } from "@unicoach/design";
import { TopicProgressCard } from "@/components/library/topic-progress-card";
import { Badge } from "@/components/ui/badge";
import { Card, PressableCard } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { modules } from "@/lib/modules";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { useSyncRefresh } from "@/lib/sync";

/** Ana sayfa: selam, son deneme, konu ilerlemesi ve modüller — web ana sayfasının mobil karşılığı. */
export default function Home() {
  const { user } = useSession();
  const { colors } = useTheme();
  const [lastExam, setLastExam] = useState<ExamSummary | null>(null);
  const [sources, setSources] = useState<SourceSummary[] | null>(null);
  const [today, setToday] = useState<ExamTodayStats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [exams, list, solved] = await Promise.all([
      api.exams.list().catch(() => null),
      api.sources.list().catch(() => null),
      api.exams.today().catch(() => null),
    ]);
    setLastExam(exams?.find((e) => e.finishedAt) ?? null);
    setSources(list);
    setToday(solved);
  }, []);

  // Arka planda eşitleme veriyi değiştirince (ör. web'de yapılan değişiklik) yeniden okunur.
  useSyncRefresh(() => void load());
  // Sekmeye her dönüşte (ör. deneme çözülüp video izlendikten sonra) yenilenir.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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
      <View style={{ gap: spacing[2] }}>
        <Text size="2xl" weight="semibold">
          Merhaba {user?.firstName} 👋
        </Text>
        <Text tone="textMuted">Bugün hangi konuya çalışmak istersin? Küçük adımlar, büyük netler.</Text>
      </View>

      {/* Son biten sınav varsa kart sonucunu açar. */}
      <PressableCard
        disabled={!lastExam}
        accessibilityLabel={lastExam ? `Son deneme: ${lastExam.title}, ${formatNet(lastExam.net ?? 0)} net` : "Son deneme yok"}
        onPress={() => lastExam && router.push({ pathname: "/sinav/[id]", params: { id: lastExam.id } })}
        style={{ gap: spacing[2] }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text size="sm" weight="medium" tone="textMuted">
            Son deneme
          </Text>
          <TrendingUp size={20} color={colors.primary} />
        </View>
        <Text size="4xl" weight="bold">
          {lastExam ? formatNet(lastExam.net ?? 0) : "—"}
        </Text>
        <Text size="sm" tone="textMuted">
          {lastExam ? `${lastExam.title} · ${lastExam.correct} D, ${lastExam.wrong} Y` : "Henüz deneme çözmedin."}
        </Text>
      </PressableCard>

      <PressableCard
        accessibilityLabel={`Bugün çözülen soru sayısı: ${today?.solved ?? 0}`}
        onPress={() => router.navigate("/sinavlar")}
        style={{ gap: spacing[2] }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text size="sm" weight="medium" tone="textMuted">
            Bugün çözülen soru sayısı
          </Text>
          <Target size={20} color={colors.primary} />
        </View>
        <Text size="4xl" weight="bold">
          {today ? today.solved : "—"}
        </Text>
        <Text size="sm" tone="textMuted">
          {today?.solved ? "Sınavlarda cevapladığın sorular." : "Bugün henüz soru çözmedin."}
        </Text>
      </PressableCard>

      <TopicProgressCard sources={sources} />

      <View style={{ gap: spacing[4] }}>
        <Text size="xl" weight="semibold">
          Modüller
        </Text>
        {modules.map((m) => {
          const Icon = m.icon;
          // Mobilde hazır modülün kartı ekranını açar (Çalışma Alanı dışındakiler sekme).
          const Container = m.ready && m.route ? PressableCard : Card;
          const route = m.route;
          return (
            <Container
              key={m.title}
              onPress={m.ready && route ? () => router.navigate(`/${route}`) : undefined}
              style={{ flexDirection: "row", gap: spacing[4], alignItems: "flex-start" }}
            >
              <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
                <Icon size={20} color={colors.primarySoftText} strokeWidth={1.75} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text size="lg" weight="semibold">
                  {m.title}
                </Text>
                <Text size="sm" tone="textMuted">
                  {m.description}
                </Text>
                {!m.ready && <Badge tone="primary">Mobilde yakında</Badge>}
              </View>
            </Container>
          );
        })}
      </View>
    </ScrollView>
  );
}
