import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from "react-native";
import { spacing } from "@unicoach/design";
import { type PageFrameHandle } from "@/components/page-frame";
import { bookPdfSource, PdfPageFrame } from "@/components/pdf-page-frame";
import { Text } from "@/components/ui/text";
import { API_BASE_URL } from "@/lib/api";
import { pdfjsAssets } from "@/lib/offline-files";
import { questionViewHtml, type QuestionBox, type QuestionViewEvent } from "@/lib/question-view-page";
import { useTheme } from "@/lib/theme";

/**
 * Sınav sorusunu PDF'ten resim olarak gösterir (web'deki QuestionImage). Sayfa bir kez açılır, soru değişince
 * yalnızca yeni kutu çizilir. `hidden` iken soru gizlenir (duraklatılmış sınav).
 */
export function QuestionView({
  bookId,
  q,
  hidden = false,
  style,
}: {
  bookId: string;
  q: QuestionBox;
  hidden?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const frameRef = useRef<PageFrameHandle>(null);
  const [ready, setReady] = useState(false);
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pdf = useMemo(() => bookPdfSource(bookId), []);
  const html = useMemo(
    () => questionViewHtml({ source: pdf.source, background: colors.surfaceMuted }, pdfjsAssets()),
    // Sayfa yalnızca ilk açılışta kurulur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!ready) return;
    if (hidden) {
      frameRef.current?.call("hide");
      return;
    }
    setShown(false);
    frameRef.current?.call("show", { page: q.page, x: q.x, y: q.y, w: q.w, h: q.h });
  }, [ready, hidden, q.page, q.x, q.y, q.w, q.h]);

  return (
    <View style={[{ backgroundColor: colors.surfaceMuted }, style]}>
      <PdfPageFrame
        ref={frameRef}
        file={pdf.file}
        html={html}
        baseUrl={`${API_BASE_URL}/`}
        background={colors.surfaceMuted}
        onMessage={(m) => {
          const e = m as QuestionViewEvent;
          if (e.type === "loaded") setReady(true);
          else if (e.type === "shown") setShown(true);
          else setError(e.message);
        }}
        style={{ flex: 1 }}
      />
      {!hidden && !shown && (
        <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: spacing[3], padding: spacing[6] }} pointerEvents="none">
          {error ? (
            <Text tone="textMuted" style={{ textAlign: "center" }}>
              {error}
            </Text>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      )}
    </View>
  );
}
