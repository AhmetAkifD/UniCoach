import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, View } from "react-native";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Info, ListChecks, TriangleAlert } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import { ApiError, bookTopics, type BookSummary } from "@unicoach/shared";
import { BookSettings } from "@/components/question-bank/book-settings";
import { PdfFrame } from "@/components/question-bank/pdf-frame";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { useDialog } from "@/components/ui/use-dialog";
import { api, getApiToken } from "@/lib/api";
import type { PdfEvent, PdfFrameHandle } from "@/lib/pdf-viewer";
import { useSession } from "@/lib/session";
import { subjectColor } from "@/lib/subject-color";
import { useTheme } from "@/lib/theme";

/** Sayfa değiştikten bu süre sonra kalınan sayfa kaydedilir (kaydırırken her sayfada istek atılmasın). */
const SAVE_DELAY_MS = 1200;

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

/**
 * Görüntüleyici ve alttaki sayfa şeridi. Kalınan sayfa (ve ilk açılışta sayfa sayısı) web'deki gibi kaydedilir:
 * sayfa değiştikten kısa süre sonra, uygulama arka plana geçince ve ekrandan çıkınca.
 */
function BookReader({ book, onBookChange }: { book: BookSummary; onBookChange: (book: BookSummary) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { prompt, dialog } = useDialog();
  const frameRef = useRef<PdfFrameHandle>(null);
  const [page, setPage] = useState(Math.max(1, book.lastPage));
  const [pageCount, setPageCount] = useState(book.pageCount ?? 0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>();

  const savedRef = useRef({ page: book.lastPage, pageCount: book.pageCount });
  const pendingRef = useRef<{ page: number; pageCount: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBookChangeRef = useRef(onBookChange);
  onBookChangeRef.current = onBookChange;

  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (!next) return;
    const saved = savedRef.current;
    if (next.page === saved.page && next.pageCount === saved.pageCount) return;
    savedRef.current = next;
    api.books
      .saveProgress(book.id, { page: next.page, ...(next.pageCount !== saved.pageCount && { pageCount: next.pageCount }) })
      .then((b) => onBookChangeRef.current(b), () => undefined);
  }, [book.id]);

  const schedule = useCallback(
    (nextPage: number, nextCount: number) => {
      pendingRef.current = { page: nextPage, pageCount: nextCount };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => state !== "active" && flush());
    return () => {
      sub.remove();
      flush();
    };
  }, [flush]);

  const countRef = useRef(pageCount);
  countRef.current = pageCount;
  function onEvent(event: PdfEvent) {
    if (event.type === "error") {
      setStatus("error");
      setError(event.message);
    } else if (event.type === "loaded") {
      setStatus("ready");
      setPageCount(event.pageCount);
      countRef.current = event.pageCount;
    } else {
      setPage(event.page);
      schedule(event.page, countRef.current);
    }
  }

  const goTo = (n: number) => {
    const target = Math.min(Math.max(1, n), pageCount || 1);
    frameRef.current?.goTo(target);
  };

  async function askPage() {
    const value = await prompt({ title: "Sayfaya git", placeholder: `1–${pageCount}`, confirmLabel: "Git" });
    const n = Number(value);
    if (Number.isInteger(n) && n >= 1) goTo(n);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceMuted }}>
      {dialog}
      <PdfFrame
        ref={frameRef}
        config={{ url: api.books.filePath(book.id), token: getApiToken(), page: Math.max(1, book.lastPage), background: colors.surfaceMuted }}
        onEvent={onEvent}
        style={{ flex: 1 }}
      />
      {status !== "ready" && (
        <View
          style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: spacing[3], padding: spacing[6], backgroundColor: colors.surfaceMuted }}
        >
          {status === "error" ? (
            <>
              <TriangleAlert size={32} color={colors.textSubtle} strokeWidth={1.75} />
              <Text tone="textMuted" style={{ textAlign: "center" }}>
                {error}
              </Text>
            </>
          ) : (
            <>
              <ActivityIndicator color={colors.primary} />
              <Text size="sm" tone="textMuted">
                PDF açılıyor…
              </Text>
            </>
          )}
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing[2],
          paddingHorizontal: spacing[3],
          paddingTop: spacing[2],
          paddingBottom: spacing[2] + insets.bottom,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <IconButton label="Önceki sayfa" disabled={status !== "ready" || page <= 1} onPress={() => goTo(page - 1)}>
          <ChevronLeft size={22} color={colors.text} />
        </IconButton>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sayfa ${page} / ${pageCount}. Başka sayfaya gitmek için dokun.`}
          disabled={status !== "ready"}
          onPress={() => void askPage()}
          style={({ pressed }) => ({ paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.md, backgroundColor: pressed ? colors.surfaceMuted : "transparent" })}
        >
          <Text weight="medium" style={{ fontVariant: ["tabular-nums"] }}>
            {pageCount ? `Sayfa ${page} / ${pageCount}` : "Sayfa —"}
          </Text>
        </Pressable>
        <IconButton label="Sonraki sayfa" disabled={status !== "ready" || page >= pageCount} onPress={() => goTo(page + 1)}>
          <ChevronRight size={22} color={colors.text} />
        </IconButton>
      </View>
    </View>
  );
}

