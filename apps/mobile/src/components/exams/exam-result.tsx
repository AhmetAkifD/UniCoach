import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Stack, router } from "expo-router";
import { CircleAlert, RotateCcw, Trash2 } from "lucide-react-native";
import { layout, radius, spacing } from "@unicoach/design";
import {
  ApiError,
  examOutcome,
  examSectionResults,
  examUsedMs,
  formatDate,
  formatMinutes,
  formatNet,
  type ExamDetail,
} from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useDialog } from "@/components/ui/use-dialog";
import { api } from "@/lib/api";
import { useTheme, type Colors } from "@/lib/theme";
import { Legend, QuestionMap } from "./exam-runner";

export type ReviewFilter = "all" | "wrong" | "blank" | "correct";
export const FILTER_LABELS: Record<ReviewFilter, string> = { all: "Tümü", wrong: "Yanlışlar", blank: "Boşlar", correct: "Doğrular" };

/** Filtredeki soruların sınav içindeki sıra numaraları */
export function filteredIndexes(exam: ExamDetail, filter: ReviewFilter) {
  return exam.questions.flatMap((q, i) => (filter === "all" || examOutcome(q) === filter ? [i] : []));
}

/**
 * Sonuç (web'deki ExamResult): net, doğru/yanlış/boş, test bazında döküm ve soru haritası. Bir soruya dokununca
 * gözden geçirme ekranı (`sinav-incele/[id]`) o sorudan açılır.
 */
export function ExamResult({ exam }: { exam: ExamDetail }) {
  const { colors } = useTheme();
  const { confirm, dialog } = useDialog();
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sections = useMemo(() => examSectionResults(exam), [exam]);
  const counts: Record<ReviewFilter, number> = { all: exam.questions.length, wrong: exam.wrong ?? 0, blank: exam.blank ?? 0, correct: exam.correct ?? 0 };
  const shown = filteredIndexes(exam, filter);

  async function retake() {
    setError(null);
    setPending(true);
    try {
      const next = await api.exams.create({
        bookId: exam.bookId,
        sections: sections.map((s) => s.name),
        durationMin: exam.durationSec === null ? null : Math.round(exam.durationSec / 60),
      });
      router.replace({ pathname: "/sinav/[id]", params: { id: next.id } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sınav başlatılamadı.");
      setPending(false);
    }
  }

  async function remove() {
    if (!(await confirm({ title: "Sınavı sil", message: "Bu sınav ve sonucu silinsin mi?", confirmLabel: "Sil", danger: true }))) return;
    setPending(true);
    try {
      await api.exams.remove(exam.id);
      router.back();
    } catch {
      setError("Sınav silinemedi.");
      setPending(false);
    }
  }

  const used = examUsedMs(exam);
  const stats: { label: string; value: string; tone: keyof Colors; hint?: string }[] = [
    { label: "Net", value: formatNet(exam.net ?? 0), tone: "text", hint: `${exam.questionCount} sorudan` },
    { label: "Doğru", value: String(exam.correct ?? 0), tone: "success" },
    { label: "Yanlış", value: String(exam.wrong ?? 0), tone: "danger", hint: exam.track === "LGS" ? "3 yanlış 1 doğruyu götürür" : "4 yanlış 1 doğruyu götürür" },
    { label: "Boş", value: String(exam.blank ?? 0), tone: "text" },
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: layout.pageGutter.mobile, gap: spacing[6], paddingBottom: spacing[10] }}>
      {dialog}
      {/* Çözülürken başlıkta olan "Bitir" düğmesi kalkar. */}
      <Stack.Screen options={{ title: "Sonuç", headerRight: () => null }} />

      <View style={{ gap: spacing[2] }}>
        <Text size="2xl" weight="semibold">
          {exam.title}
        </Text>
        <Text size="sm" tone="textMuted">
          {exam.bookTitle} · {formatDate(exam.startedAt)} · {formatMinutes(used)}
          {exam.durationSec !== null && ` / ${formatMinutes((exam.durationSec + exam.extraSec) * 1000)}`}
          {exam.extraSec > 0 && ` (${formatMinutes(exam.extraSec * 1000)} ek süre)`}
        </Text>
        <View style={{ flexDirection: "row", gap: spacing[3], marginTop: spacing[2] }}>
          <Button variant="secondary" size="sm" loading={pending} icon={<RotateCcw size={16} color={colors.primarySoftText} />} onPress={() => void retake()}>
            Tekrar çöz
          </Button>
          <Button variant="ghost" size="sm" disabled={pending} icon={<Trash2 size={16} color={colors.text} />} onPress={() => void remove()}>
            Sil
          </Button>
        </View>
      </View>

      {error && (
        <View accessibilityRole="alert" style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start", borderRadius: radius.md, backgroundColor: colors.dangerSoft, padding: spacing[3] }}>
          <CircleAlert size={16} color={colors.danger} style={{ marginTop: 2 }} />
          <Text size="sm" tone="danger" style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      )}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[3] }}>
        {stats.map((s) => (
          <Card key={s.label} style={{ flexBasis: "47%", flexGrow: 1, gap: 4, padding: spacing[4] }}>
            <Text size="sm" weight="medium" tone="textMuted">
              {s.label}
            </Text>
            <Text size="3xl" weight="bold" tone={s.tone} style={{ fontVariant: ["tabular-nums"] }}>
              {s.value}
            </Text>
            {s.hint && (
              <Text size="xs" tone="textMuted">
                {s.hint}
              </Text>
            )}
          </Card>
        ))}
      </View>

      {sections.length > 1 && (
        <Card flush>
          <View style={{ flexDirection: "row", paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text size="sm" weight="medium" tone="textMuted" style={{ flex: 1 }}>
              Test
            </Text>
            {["D", "Y", "B", "Net"].map((h) => (
              <Text key={h} size="sm" weight="medium" tone="textMuted" style={{ width: h === "Net" ? 52 : 32, textAlign: "right" }}>
                {h}
              </Text>
            ))}
          </View>
          {sections.map((s, i) => (
            <View key={s.name} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <Text size="sm" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                {s.name}
              </Text>
              <Text size="sm" tone="success" style={{ width: 32, textAlign: "right", fontVariant: ["tabular-nums"] }}>
                {s.correct}
              </Text>
              <Text size="sm" tone="danger" style={{ width: 32, textAlign: "right", fontVariant: ["tabular-nums"] }}>
                {s.wrong}
              </Text>
              <Text size="sm" tone="textMuted" style={{ width: 32, textAlign: "right", fontVariant: ["tabular-nums"] }}>
                {s.blank}
              </Text>
              <Text size="sm" weight="semibold" style={{ width: 52, textAlign: "right", fontVariant: ["tabular-nums"] }}>
                {formatNet(s.net)}
              </Text>
            </View>
          ))}
        </Card>
      )}

      <View style={{ gap: spacing[4] }}>
        <Text size="xl" weight="semibold" accessibilityRole="header">
          Soruları gözden geçir
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
          {(["all", "wrong", "blank", "correct"] as const).map((f) => {
            const active = filter === f;
            return (
              <Pressable
                key={f}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(f)}
                style={{
                  height: 32,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: spacing[3],
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primarySoft : colors.surface,
                }}
              >
                <Text size="sm" weight="medium" tone={active ? "primarySoftText" : "textMuted"}>
                  {FILTER_LABELS[f]}
                </Text>
                <Text size="xs" tone={active ? "primarySoftText" : "textSubtle"} style={{ fontVariant: ["tabular-nums"] }}>
                  {counts[f]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {shown.length ? (
          <View style={{ marginHorizontal: -spacing[5] }}>
            <QuestionMapSubset
              exam={exam}
              indexes={shown}
              onPick={(i) => router.push({ pathname: "/sinav-incele/[id]", params: { id: exam.id, soru: String(i), filtre: filter } })}
            />
          </View>
        ) : (
          <Text size="sm" tone="textMuted">
            Bu filtrede soru yok.
          </Text>
        )}
        <View style={{ flexDirection: "row", gap: spacing[4] }}>
          <Legend color={colors.successSoft} label="Doğru" />
          <Legend color={colors.dangerSoft} label="Yanlış" />
          <Legend color={colors.surfaceMuted} label="Boş" />
        </View>
        <Text size="xs" tone="textSubtle">
          Bir soruya dokununca görselini, senin cevabını ve doğru cevabı görürsün.
        </Text>
      </View>
    </ScrollView>
  );
}

/** Soru haritası, yalnızca filtredeki sorular (numaralar sınavdaki sırasıyla). */
function QuestionMapSubset({ exam, indexes, onPick }: { exam: ExamDetail; indexes: number[]; onPick: (i: number) => void }) {
  return (
    <QuestionMap
      count={indexes.length}
      current={null}
      number={(k) => indexes[k]! + 1}
      toneOf={(k) => {
        const o = examOutcome(exam.questions[indexes[k]!]!);
        return o === "blank" ? "blank" : o;
      }}
      labelOf={(k) => {
        const q = exam.questions[indexes[k]!]!;
        const o = examOutcome(q);
        return `${indexes[k]! + 1}. soru, ${o === "correct" ? "doğru" : o === "wrong" ? "yanlış" : "boş"}`;
      }}
      onPick={(k) => onPick(indexes[k]!)}
    />
  );
}
