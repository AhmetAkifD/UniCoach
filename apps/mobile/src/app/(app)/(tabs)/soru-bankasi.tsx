import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { BookOpenText, Info, Plus, SearchX, TriangleAlert } from "lucide-react-native";
import { layout, radius, spacing } from "@unicoach/design";
import { groupByTopic, subjectFilters, type BookSummary, type SubjectFilter } from "@unicoach/shared";
import { LibraryFilters } from "@/components/library/library-filters";
import { BookCard } from "@/components/question-bank/book-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { subjectColor } from "@/lib/subject-color";
import { useTheme } from "@/lib/theme";
import { useSyncRefresh } from "@/lib/sync";

/** Soru Bankası: öğrencinin soru kitabı PDF'leri, derslere ve konulara göre (web'deki /soru-bankasi). */
export default function QuestionBankScreen() {
  const { user } = useSession();
  const { colors } = useTheme();
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<SubjectFilter>({ exam: null, ders: null });

  const load = useCallback(async () => {
    try {
      setBooks(await api.books.list());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  // Arka planda eşitleme veriyi değiştirince (ör. web'de yapılan değişiklik) yeniden okunur.
  useSyncRefresh(() => void load());
  // Sekmeye her dönüşte (PDF yükleyip ya da okuyup gelince) kalınan sayfalar yenilenir.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const upload = () => router.push("/pdf-yukle");

  if (!books) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[4], backgroundColor: colors.bg, padding: spacing[6] }}>
        {error ? (
          <>
            <TriangleAlert size={32} color={colors.textSubtle} strokeWidth={1.75} />
            <Text tone="textMuted" style={{ textAlign: "center" }}>
              Soru bankan yüklenemedi.
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

  const { exam, ders, examOptions, dersOptions, groups } = subjectFilters(books, {
    track: user?.examTrack ?? null,
    exam: filter.exam,
    ders: filter.ders,
  });

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
        <Text tone="textMuted">Kaynaklarını derslere ayrılmış şekilde görüntüle.</Text>
        {books.length > 0 && (
          <Button icon={<Plus size={20} color={colors.onPrimary} />} onPress={upload} style={{ alignSelf: "flex-start" }}>
            PDF yükle
          </Button>
        )}
      </View>

      {!user?.examTrack && (
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/profil")}
          style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start", borderRadius: radius.md, backgroundColor: colors.infoSoft, padding: spacing[3] }}
        >
          <Info size={16} color={colors.info} style={{ marginTop: 2 }} />
          <Text size="sm" tone="info" style={{ flex: 1 }}>
            Hangi sınava hazırlandığını henüz seçmedin.{" "}
            <Text size="sm" weight="medium" tone="info" style={{ textDecorationLine: "underline" }}>
              Profilinden seç
            </Text>{" "}
            ki dersler ona göre sıralansın.
          </Text>
        </Pressable>
      )}

      {books.length > 0 && <LibraryFilters exams={examOptions} dersler={dersOptions} exam={exam} ders={ders} onChange={setFilter} />}

      {books.length === 0 ? (
        <Card style={{ alignItems: "center", gap: spacing[3], paddingVertical: spacing[10] }}>
          <BookOpenText size={40} color={colors.textSubtle} strokeWidth={1.75} />
          <Text size="lg" weight="semibold">
            Soru bankan boş
          </Text>
          <Text size="sm" tone="textMuted" style={{ textAlign: "center" }}>
            Çözdüğün soru kitaplarının PDF'lerini yükle. Hepsi derslerine göre burada durur, kaldığın sayfadan açılır.
          </Text>
          <Button icon={<Plus size={20} color={colors.onPrimary} />} onPress={upload} style={{ marginTop: spacing[2] }}>
            İlk PDF'ini yükle
          </Button>
        </Card>
      ) : groups.length === 0 ? (
        <Card style={{ alignItems: "center", gap: spacing[3], paddingVertical: spacing[8] }}>
          <SearchX size={36} color={colors.textSubtle} strokeWidth={1.75} />
          <Text weight="semibold">Bu filtrede PDF yok</Text>
          <Button variant="ghost" size="sm" onPress={() => setFilter({ exam: null, ders: null })}>
            Filtreyi temizle
          </Button>
        </Card>
      ) : (
        groups.map(({ subject, items }) => {
          const color = subjectColor(subject.id);
          const topicGroups = groupByTopic(items);
          const showTopics = topicGroups.some(([topic]) => topic !== null);
          return (
            <View key={subject.id} style={{ gap: spacing[4] }}>
              <View accessibilityRole="header" style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
                <Text size="xl" weight="semibold">
                  {subject.label}
                </Text>
                <Text size="sm" tone="textMuted">
                  {items.length}
                </Text>
              </View>
              {topicGroups.map(([topic, list]) => (
                <View key={topic ?? "konusuz"} style={{ gap: spacing[3] }}>
                  {showTopics && (
                    <Text size="sm" weight="medium" tone="textMuted">
                      {topic ?? "Konu belirtilmemiş"}
                    </Text>
                  )}
                  {list.map((book) => (
                    <BookCard key={book.id} book={book} color={color} showTopic={!showTopics} />
                  ))}
                </View>
              ))}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
