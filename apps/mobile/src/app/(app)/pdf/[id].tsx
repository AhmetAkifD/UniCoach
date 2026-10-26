import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Info, ListChecks, NotebookPen, TriangleAlert } from "lucide-react-native";
import { spacing } from "@unicoach/design";
import { ApiError, bookTopics, type BookSummary } from "@unicoach/shared";
import { BookSettings } from "@/components/question-bank/book-settings";
import { BookReader } from "@/components/question-bank/book-reader";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { subjectColor } from "@/lib/subject-color";
import { useTheme } from "@/lib/theme";

/** Bir PDF'in görüntüleyici ekranı (web'deki /soru-bankasi/[id]); sekmelerin üstüne açılır. */
export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { colors } = useTheme();
  const [book, setBook] = useState<BookSummary | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [next, books] = await Promise.all([api.books.get(id), api.books.list()]);
      setBook(next);
      setTopics(bookTopics(books));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? "Bu PDF bulunamadı. Silinmiş olabilir." : "PDF yüklenemedi.");
    }
  }, [id]);

  // Sorular çıkarılıp dönülünce soru sayısı güncellensin.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!book) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[4], backgroundColor: colors.bg, padding: spacing[6] }}>
        <Stack.Screen options={{ title: "Soru Bankası" }} />
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

  const color = subjectColor(book.subject);
  return (
    <>
      <Stack.Screen
        options={{
          title: book.title,
          headerRight: () => (
            <View style={{ flexDirection: "row", gap: spacing[5] }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Çalışma alanında aç"
                onPress={() => router.push({ pathname: "/calisma-alani", params: { pdf: book.id } })}
                hitSlop={10}
              >
                <NotebookPen size={22} color={colors.text} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Soruları çıkar"
                onPress={() => router.push({ pathname: "/sorular/[id]", params: { id: book.id } })}
                hitSlop={10}
              >
                <ListChecks size={22} color={colors.text} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="PDF bilgileri ve ayarları" onPress={() => setSettingsOpen(true)} hitSlop={10}>
                <Info size={22} color={colors.text} />
              </Pressable>
            </View>
          ),
        }}
      />
      <BookReader book={book} onBookChange={setBook} />
      <BookSettings
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        book={book}
        color={color}
        examTrack={user?.examTrack ?? null}
        topics={topics}
        onChanged={setBook}
        onDeleted={() => {
          setSettingsOpen(false);
          router.back();
        }}
      />
    </>
  );
}
