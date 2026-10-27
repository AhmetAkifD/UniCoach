import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import type { BookSummary } from "@unicoach/shared";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { useDialog } from "@/components/ui/use-dialog";
import { api, syncEngine } from "@/lib/api";
import type { PdfEvent, PdfFrameHandle } from "@/lib/pdf-viewer";
import { useTheme } from "@/lib/theme";
import { bookPdfSource } from "@/components/pdf-page-frame";
import { PdfFrame } from "./pdf-frame";

/** Sayfa değiştikten bu süre sonra kalınan sayfa kaydedilir (kaydırırken her sayfada istek atılmasın). */
const SAVE_DELAY_MS = 1200;

/**
 * Görüntüleyici ve alttaki sayfa şeridi. Kalınan sayfa (ve ilk açılışta sayfa sayısı) web'deki gibi kaydedilir:
 * sayfa değiştikten kısa süre sonra, uygulama arka plana geçince ve ekrandan çıkınca. PDF ekranı ve Çalışma Alanı kullanır.
 */
export function BookReader({
  book,
  onBookChange,
  embedded = false,
}: {
  book: BookSummary;
  onBookChange: (book: BookSummary) => void;
  /** Çalışma Alanı'nda bir bölmenin içinde: şerit ekranın altına değmez, daha ince. */
  embedded?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { prompt, dialog } = useDialog();
  const frameRef = useRef<PdfFrameHandle>(null);
  // Cihazda indirilmiş kopyası varsa PDF oradan okunur (çevrimdışı da açılır).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pdf = useMemo(() => bookPdfSource(book.id), []);
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
      // Sunucuya ulaşılamıyorsa ve PDF cihazda değilse ne yapacağı söylenir.
      setError(
        !pdf.file && syncEngine.getState().connection === "offline"
          ? "Bu PDF bu cihaza indirilmemiş. Çevrimdışı okumak için sunucuya bağlıyken PDF bilgilerinden \"Çevrimdışı kullan\"ı aç."
          : event.message,
      );
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
        config={{ source: pdf.source, page: Math.max(1, book.lastPage), background: colors.surfaceMuted }}
        file={pdf.file}
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
          paddingTop: embedded ? 2 : spacing[2],
          paddingBottom: embedded ? 2 : spacing[2] + insets.bottom,
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

