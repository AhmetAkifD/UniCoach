import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { BookOpenText } from "lucide-react-native";
import { spacing } from "@unicoach/design";
import { ApiError, type BookSummary } from "@unicoach/shared";
import { BookReader } from "@/components/question-bank/book-reader";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { PaneBar } from "./pane-bar";
import { PickSheet } from "./pick-sheet";

/** Çalışma Alanı'nın PDF bölmesi: Soru Bankası görüntüleyicisi (`BookReader`, kalınan sayfa aynı kurallarla kaydedilir). */
export function PdfPane({
  books,
  bookId,
  onSelect,
  maximized,
  onToggleMaximize,
}: {
  books: BookSummary[] | null;
  bookId: string | null;
  onSelect: (id: string | null) => void;
  maximized: boolean;
  onToggleMaximize: () => void;
}) {
  const { colors } = useTheme();
  const [book, setBook] = useState<BookSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBook(null);
    setError(null);
    if (!bookId) return;
    api.books.get(bookId).then(
      (b) => !cancelled && setBook(b),
      (err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) onSelect(null);
        else setError("PDF açılamadı.");
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceMuted }}>
      <PaneBar
        icon={BookOpenText}
        title={book?.title ?? null}
        placeholder="PDF seç"
        onPick={() => setPickerOpen(true)}
        maximized={maximized}
        onToggleMaximize={onToggleMaximize}
      />
      {book ? (
        <BookReader key={book.id} book={book} onBookChange={setBook} embedded />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[4] }}>
          {error ? (
            <Text size="sm" tone="danger">
              {error}
            </Text>
          ) : bookId ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text size="sm" tone="textMuted" style={{ textAlign: "center" }}>
              Soru Bankası'ndaki PDF'lerinden birini seç.
            </Text>
          )}
        </View>
      )}
      <PickSheet
        visible={pickerOpen}
        title="PDF seç"
        items={books}
        value={bookId}
        empty="Soru Bankası'na henüz PDF yüklemedin."
        onPick={onSelect}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}
