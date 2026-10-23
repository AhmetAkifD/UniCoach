import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import { EXAM_OUTCOME_LABELS, examOutcome, type ExamDetail } from "@unicoach/shared";
import { FILTER_LABELS, filteredIndexes, type ReviewFilter } from "@/components/exams/exam-result";
import { QuestionView } from "@/components/exams/question-view";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";

const TONES = { correct: "success", wrong: "danger", blank: "neutral" } as const;

/**
 * Sonuçta soruları tek tek gözden geçirme: soru görseli, senin cevabın ve doğru cevap; sonuçtaki filtrenin
 * soruları arasında oklarla geçilir. "Kaynağında düzenle" düzenleyiciyi açar, dönünce sonuç kaynaktaki
 * düzeltmelerle yeniden hesaplanır.
 */
export default function ReviewScreen() {
  const params = useLocalSearchParams<{ id: string; soru?: string; filtre?: ReviewFilter }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const filter: ReviewFilter = params.filtre && params.filtre in FILTER_LABELS ? params.filtre : "all";
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const editing = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const returning = editing.current;
      editing.current = false;
      (returning ? api.exams.sync(params.id) : api.exams.get(params.id)).then(setExam, () => undefined);
    }, [params.id]),
  );

  if (!exam) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: "Gözden geçir" }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const indexes = filteredIndexes(exam, filter);
  // Açılışta sonuçta dokunulan soru; düzeltme sonrası filtreden çıktıysa en yakını.
  const start = Math.max(0, indexes.indexOf(Number(params.soru)));
  const k = Math.min(position ?? start, Math.max(0, indexes.length - 1));
  const qIndex = indexes[k];
  const q = qIndex === undefined ? null : exam.questions[qIndex]!;
  const multiSection = new Set(exam.questions.map((x) => x.section)).size > 1;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: `${FILTER_LABELS[filter]} · ${indexes.length ? k + 1 : 0}/${indexes.length}` }} />
      {!q ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[6] }}>
          <Text tone="textMuted">Bu filtrede soru kalmadı.</Text>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[3], paddingHorizontal: spacing[4], paddingTop: spacing[3] }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], flexShrink: 1 }}>
              <Text size="lg" weight="semibold" style={{ fontVariant: ["tabular-nums"] }}>
                {qIndex! + 1}. soru
              </Text>
              <Badge tone={TONES[examOutcome(q)]}>{EXAM_OUTCOME_LABELS[examOutcome(q)]}</Badge>
            </View>
            {q.bookQuestionId && (
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Kutu ya da cevap yanlışsa Soru Bankası'nda düzelt"
                hitSlop={8}
                onPress={() => {
                  editing.current = true;
                  router.push({ pathname: "/sorular/[id]", params: { id: exam.bookId, soru: q.bookQuestionId! } });
                }}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Pencil size={14} color={colors.textMuted} />
                <Text size="sm" weight="medium" tone="textMuted">
                  Kaynağında düzenle
                </Text>
              </Pressable>
            )}
          </View>
          {multiSection && (
            <Text size="sm" tone="textMuted" style={{ paddingHorizontal: spacing[4] }}>
              {q.section}
            </Text>
          )}
          <View style={{ flex: 1, margin: spacing[3], borderRadius: radius.lg, overflow: "hidden" }}>
            <QuestionView bookId={exam.bookId} q={q} style={{ flex: 1 }} />
          </View>
          <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: insets.bottom }}>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing[6], paddingTop: spacing[3] }}>
              <AnswerChip label="Senin cevabın" value={q.answer ?? "Boş"} tone={examOutcome(q) === "correct" ? "success" : examOutcome(q) === "wrong" ? "danger" : "text"} />
              <AnswerChip label="Doğru cevap" value={q.correctAnswer ?? "—"} tone="success" />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
              <IconButton label="Önceki soru" disabled={k === 0} onPress={() => setPosition(k - 1)}>
                <ChevronLeft size={24} color={colors.text} />
              </IconButton>
              <Text weight="medium" style={{ fontVariant: ["tabular-nums"] }}>
                {k + 1} / {indexes.length}
              </Text>
              <IconButton label="Sonraki soru" disabled={k >= indexes.length - 1} onPress={() => setPosition(k + 1)}>
                <ChevronRight size={24} color={colors.text} />
              </IconButton>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function AnswerChip({ label, value, tone }: { label: string; value: string; tone: "success" | "danger" | "text" }) {
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <Text size="xs" tone="textMuted">
        {label}
      </Text>
      <Text size="2xl" weight="bold" tone={tone}>
        {value}
      </Text>
    </View>
  );
}
