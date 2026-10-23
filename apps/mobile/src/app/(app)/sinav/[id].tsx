import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { TriangleAlert } from "lucide-react-native";
import { spacing } from "@unicoach/design";
import { ApiError, type ExamDetail } from "@unicoach/shared";
import { ExamResult } from "@/components/exams/exam-result";
import { ExamRunner } from "@/components/exams/exam-runner";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";

/** Bir sınav (web'deki /sinavlar/[id]): bitmemişse çözülür, bitince (süre dolunca da) sonuç gösterilir. */
export default function ExamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setExam(await api.exams.get(id));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? "Bu sınav bulunamadı. Silinmiş olabilir." : "Sınav yüklenemedi.");
    }
  }, [id]);

  // Sonuç, gözden geçirmede kaynağında düzeltilip dönülünce yeniden okunur. Çözülen sınav kendi durumunu yönetir.
  useFocusEffect(
    useCallback(() => {
      if (!exam || exam.finishedAt) void load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  if (!exam) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[4], backgroundColor: colors.bg, padding: spacing[6] }}>
        <Stack.Screen options={{ title: "Sınav" }} />
        {error ? (
          <>
            <TriangleAlert size={32} color={colors.textSubtle} strokeWidth={1.75} />
            <Text tone="textMuted" style={{ textAlign: "center" }}>
              {error}
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
  return exam.finishedAt ? <ExamResult exam={exam} /> : <ExamRunner key={exam.id} exam={exam} onFinished={() => void load()} />;
}
