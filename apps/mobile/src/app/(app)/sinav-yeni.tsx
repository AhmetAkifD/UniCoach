import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { BookOpenText, Check, CircleAlert, Play } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import {
  ApiError,
  EXAM_MAX_MINUTES,
  findSubject,
  suggestedMinutes,
  type BookQuestion,
  type BookSummary,
  type ExamTrack,
} from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { subjectColor } from "@/lib/subject-color";
import { useTheme } from "@/lib/theme";

/** Yeni sınav: PDF → testler → süre (web'deki NewExamForm). Yalnızca cevabı girilmiş sorular sınava girer. */
export default function NewExamScreen() {
  const { pdf } = useLocalSearchParams<{ pdf?: string }>();
  const { user } = useSession();
  const { colors } = useTheme();
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [bookId, setBookId] = useState("");
  const [questions, setQuestions] = useState<BookQuestion[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [minutes, setMinutes] = useState("");
  const [untimed, setUntimed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api.books.list().then(
      (list) => {
        const withQuestions = list.filter((b) => b.questionCount > 0);
        setBooks(withQuestions);
        setBookId(withQuestions.some((b) => b.id === pdf) ? pdf! : (withQuestions[0]?.id ?? ""));
      },
      () => setError("PDF'lerin yüklenemedi."),
    );
  }, [pdf]);

  // PDF değişince testleri yükle; cevaplı olanların hepsi seçili gelir.
  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    setQuestions(null);
    api.books.questions(bookId).then(
      (qs) => {
        if (cancelled) return;
        setQuestions(qs);
        setSelected(new Set(qs.filter((q) => q.answer).map((q) => q.section)));
      },
      () => !cancelled && setError("Testler yüklenemedi."),
    );
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const book = books?.find((b) => b.id === bookId);
  const track: ExamTrack = (book && findSubject(book.subject)?.track) ?? user?.examTrack ?? "YKS";
  const sections = useMemo(() => {
    const names = [...new Set((questions ?? []).map((q) => q.section))];
    return names.map((name) => {
      const list = questions!.filter((q) => q.section === name);
      return { name, total: list.length, answered: list.filter((q) => q.answer).length };
    });
  }, [questions]);
  const answerable = sections.filter((s) => s.answered);
  const count = sections.filter((s) => selected.has(s.name)).reduce((n, s) => n + s.answered, 0);
  const suggestion = count ? suggestedMinutes(count, track) : 0;
  const minutesValue = minutes === "" ? suggestion : Number(minutes);

  function toggle(name: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function submit() {
    setError(null);
    if (!count) return setError("En az bir test seç.");
    if (!untimed && (!Number.isInteger(minutesValue) || minutesValue < 1 || minutesValue > EXAM_MAX_MINUTES)) {
      return setError(`Süre 1–${EXAM_MAX_MINUTES} dakika arasında olmalı.`);
    }
    setPending(true);
    try {
      const exam = await api.exams.create({
        bookId,
        sections: sections.filter((s) => selected.has(s.name) && s.answered).map((s) => s.name),
        durationMin: untimed ? null : minutesValue,
      });
      router.replace({ pathname: "/sinav/[id]", params: { id: exam.id } });
    } catch (err) {
      setError(err instanceof ApiError ? (err.errors?.durationMin ?? err.errors?.sections ?? err.message) : "Sınav başlatılamadı.");
      setPending(false);
    }
  }

  if (!books) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: spacing[6] }}>
        {error ? <Text tone="textMuted">{error}</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }

  if (!books.length) {
    return (
      <Screen edges={["bottom"]}>
        <Card style={{ alignItems: "center", gap: spacing[3], paddingVertical: spacing[10] }}>
          <BookOpenText size={40} color={colors.textSubtle} strokeWidth={1.75} />
          <Text size="lg" weight="semibold">
            Önce soruları çıkar
          </Text>
          <Text size="sm" tone="textMuted" style={{ textAlign: "center" }}>
            Sınav, Soru Bankası'ndaki PDF'lerden çıkardığın sorularla kurulur. Bir PDF aç ve "Soruları çıkar"a gir.
          </Text>
          <Button variant="secondary" onPress={() => router.replace("/soru-bankasi")}>
            Soru Bankası'na git
          </Button>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen edges={["bottom"]}>
      <Text tone="textMuted">Soru Bankası'nda çıkardığın testlerden süreli bir deneme kur.</Text>

      <View style={{ gap: spacing[3] }}>
        <Text weight="semibold">1. PDF</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="PDF" style={{ gap: spacing[2] }}>
          {books.map((b) => {
            const active = b.id === bookId;
            return (
              <Pressable
                key={b.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => setBookId(b.id)}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: spacing[3],
                  padding: spacing[3],
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primarySoft : colors.surface,
                }}
              >
                <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: subjectColor(b.subject) }} />
                <View style={{ flex: 1 }}>
                  <Text weight="medium" numberOfLines={1}>
                    {b.title}
                  </Text>
                  <Text size="sm" tone="textMuted">
                    {findSubject(b.subject)?.label ?? b.subject} · {b.questionCount} soru
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: spacing[3] }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text weight="semibold">2. Testler</Text>
          {answerable.length > 1 && (
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setSelected(selected.size === answerable.length ? new Set() : new Set(answerable.map((s) => s.name)))}
            >
              <Text size="sm" weight="medium" tone="primary">
                {selected.size === answerable.length ? "Hiçbirini seçme" : "Tümünü seç"}
              </Text>
            </Pressable>
          )}
        </View>
        {!questions ? (
          <ActivityIndicator color={colors.primary} style={{ alignSelf: "flex-start" }} />
        ) : (
          <Card flush>
            {sections.map((s, i) => {
              const checked = selected.has(s.name);
              return (
                <Pressable
                  key={s.name}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked, disabled: !s.answered }}
                  disabled={!s.answered}
                  onPress={() => toggle(s.name)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing[3],
                    paddingHorizontal: spacing[4],
                    minHeight: 48,
                    opacity: s.answered ? 1 : 0.5,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: radius.sm,
                      borderWidth: 1.5,
                      alignItems: "center",
                      justifyContent: "center",
                      borderColor: checked ? colors.primary : colors.borderStrong,
                      backgroundColor: checked ? colors.primary : "transparent",
                    }}
                  >
                    {checked && <Check size={14} strokeWidth={3} color={colors.onPrimary} />}
                  </View>
                  <Text weight="medium" style={{ flex: 1 }} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text size="sm" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
                    {s.answered === s.total ? `${s.total} soru` : `${s.answered}/${s.total} cevaplı`}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        )}
        {sections.some((s) => s.answered < s.total) && (
          <Text size="xs" tone="textSubtle">
            Cevabı girilmemiş sorular sınava alınmaz.
          </Text>
        )}
      </View>

      <View style={{ gap: spacing[3] }}>
        <Text weight="semibold">3. Süre</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
          <View style={{ width: 96 }}>
            <Input
              accessibilityLabel="Süre (dakika)"
              keyboardType="number-pad"
              editable={!untimed}
              value={untimed ? "" : minutes === "" ? String(suggestion || "") : minutes}
              onChangeText={(t) => setMinutes(t.replace(/\D/g, "").slice(0, 3))}
              style={{ opacity: untimed ? 0.5 : 1, fontVariant: ["tabular-nums"] }}
            />
          </View>
          <Text tone="textMuted">dakika</Text>
        </View>
        <Text size="xs" tone="textSubtle">
          Önerilen {suggestion || "–"} dk: {track === "LGS" ? "LGS" : "TYT"} süresine göre soru başına {track === "LGS" ? "~1,7" : "~1,4"} dakika.
        </Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: untimed }}
          onPress={() => setUntimed((u) => !u)}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], alignSelf: "flex-start", paddingVertical: spacing[1] }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: radius.sm,
              borderWidth: 1.5,
              alignItems: "center",
              justifyContent: "center",
              borderColor: untimed ? colors.primary : colors.borderStrong,
              backgroundColor: untimed ? colors.primary : "transparent",
            }}
          >
            {untimed && <Check size={14} strokeWidth={3} color={colors.onPrimary} />}
          </View>
          <Text>Süresiz çöz</Text>
        </Pressable>
      </View>

      <Card style={{ gap: 4 }}>
        <Text size="sm" tone="textMuted">
          Sınavda
        </Text>
        <Text size="2xl" weight="bold" style={{ fontVariant: ["tabular-nums"] }}>
          {count} soru
        </Text>
        <Text size="sm" tone="textMuted">
          {track === "LGS" ? "3 yanlış 1 doğruyu götürür" : "4 yanlış 1 doğruyu götürür"}
        </Text>
      </Card>

      {error && (
        <View
          accessibilityRole="alert"
          style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start", borderRadius: radius.md, backgroundColor: colors.dangerSoft, padding: spacing[3] }}
        >
          <CircleAlert size={16} color={colors.danger} style={{ marginTop: 2 }} />
          <Text size="sm" tone="danger" style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      )}
      <Button icon={<Play size={18} color={colors.onPrimary} />} loading={pending} disabled={!count} onPress={() => void submit()}>
        Sınavı başlat
      </Button>
    </Screen>
  );
}
