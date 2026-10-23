import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { TriangleAlert } from "lucide-react-native";
import { spacing } from "@unicoach/design";
import { ApiError, type BookQuestion, type BookSummary } from "@unicoach/shared";
import { QuestionEditor } from "@/components/question-bank/question-editor";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";

/**
 * Soruları çıkar ve cevap anahtarını düzenle (web'deki /soru-bankasi/[id]/sorular); PDF ekranının üstüne açılır.
 * `?soru=<id>`: sınavdan "Kaynağında düzenle" ile gelindi, o soru açılıp seçilir (geri dönünce sınav sürer).
 */
export default function QuestionsScreen() {
  const { id, soru } = useLocalSearchParams<{ id: string; soru?: string }>();
  const { colors } = useTheme();
  const [data, setData] = useState<{ book: BookSummary; questions: BookQuestion[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [book, questions] = await Promise.all([api.books.get(id), api.books.questions(id)]);
      setData({ book, questions });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? "Bu PDF bulunamadı. Silinmiş olabilir." : "Sorular yüklenemedi.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[4], backgroundColor: colors.bg, padding: spacing[6] }}>
        <Stack.Screen options={{ title: "Soruları çıkar" }} />
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
  return <QuestionEditor book={data.book} initial={data.questions} focusId={soru} />;
}
