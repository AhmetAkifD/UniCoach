import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, CircleAlert, Clock, Flag, Grid3x3, Pause, Pencil, Play, Plus } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import {
  ApiError,
  CHOICE_LETTERS,
  examRemainingMs,
  firstBlankIndex,
  formatClock,
  type ChoiceLetter,
  type ExamDetail,
} from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useDialog } from "@/components/ui/use-dialog";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { QuestionView } from "./question-view";

/** Süre bu kadar azalınca sayaç uyarı rengine geçer. */
const WARN_MS = 5 * 60_000;

/**
 * Sınav ekranı (web'deki ExamRunner): soru görseli, A–E ve Boş düğmeleri, oklar, soru haritası ve geri sayım.
 * Süre sunucuda tutulur; uygulama arka plana geçince ya da ekrandan çıkınca sınav duraklatılır, dönünce
 * "Devam et" ile sürer. Her cevap hemen kaydedilir. "Kaynağında düzenle" süreyi durdurup soru düzenleyicisini
 * açar; dönünce sınav devam ettirilir ve sorular kaynaktan yeniden okunur.
 */
export function ExamRunner({ exam: initial, onFinished }: { exam: ExamDetail; onFinished: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { confirm, prompt, dialog } = useDialog();
  const [exam, setExam] = useState(initial);
  const [answers, setAnswers] = useState<Record<string, ChoiceLetter | null>>(() =>
    Object.fromEntries(initial.questions.map((q) => [q.id, q.answer])),
  );
  const [index, setIndex] = useState(() => firstBlankIndex(initial.questions));
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [timerBusy, setTimerBusy] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const q = exam.questions[Math.min(index, exam.questions.length - 1)]!;
  const answered = useMemo(() => Object.values(answers).filter(Boolean).length, [answers]);

  // --- Geri sayım (sunucu saatine göre). Duraklatılmışken kalan süre donar. ---
  const offset = useRef(Date.parse(initial.now) - Date.now());
  const [clock, setClock] = useState({ deadline: initial.deadline, pausedAt: initial.pausedAt });
  const timed = clock.deadline !== null;
  const paused = !!clock.pausedAt;
  const [remaining, setRemaining] = useState(() => examRemainingMs(clock, offset.current));
  const applyClock = (next: ExamDetail) => {
    offset.current = Date.parse(next.now) - Date.now();
    setClock({ deadline: next.deadline, pausedAt: next.pausedAt });
  };

  /** Bitirme ve düzenleyiciye geçişte otomatik duraklatma yapılmaz. */
  const skipAutoPause = useRef(false);
  /** Düzenleyiciden dönülünce sınav devam ettirilir ve sorular yeniden okunur. */
  const editing = useRef(false);

  const finish = useCallback(async () => {
    setFinishing(true);
    skipAutoPause.current = true;
    try {
      await api.exams.finish(exam.id);
    } catch {
      // Süre dolunca sunucu sınavı zaten kapatır; yeniden okununca sonuç görünür.
    }
    onFinished();
  }, [exam.id, onFinished]);

  useEffect(() => {
    if (!timed) return;
    if (paused) {
      setRemaining(examRemainingMs(clock, offset.current));
      return;
    }
    const tick = () => {
      const ms = examRemainingMs(clock, offset.current)!;
      setRemaining(ms);
      if (ms <= 0) {
        clearInterval(timer);
        void finish();
      }
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [clock, timed, paused, finish]);

  // --- Otomatik duraklatma: uygulama arka plana geçince ve ekrandan çıkınca ---
  const state = useRef({ timed, paused });
  state.current = { timed, paused };
  const autoPause = useCallback(() => {
    const { timed, paused } = state.current;
    if (!timed || paused || skipAutoPause.current) return;
    setClock((c) => ({ ...c, pausedAt: new Date(Date.now() + offset.current).toISOString() }));
    api.exams.pause(exam.id).then(applyClock, () => undefined);
  }, [exam.id]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => s !== "active" && autoPause());
    return () => sub.remove();
  }, [autoPause]);

  useFocusEffect(
    useCallback(() => {
      if (editing.current) {
        // Düzenleyiciden dönüldü: devam ettir, sorular kaynaktan yeniden kopyalanır.
        editing.current = false;
        skipAutoPause.current = false;
        api.exams.resume(exam.id).then(
          (next) => {
            applyClock(next);
            setExam(next);
          },
          () => setError("Sınav devam ettirilemedi."),
        );
      }
      return () => autoPause();
    }, [exam.id, autoPause]),
  );

  async function togglePause() {
    setTimerBusy(true);
    setError(null);
    try {
      const next = paused ? await api.exams.resume(exam.id) : await api.exams.pause(exam.id);
      applyClock(next);
      if (paused) setExam(next);
    } catch {
      setError(paused ? "Sınav devam ettirilemedi." : "Sınav duraklatılamadı.");
    } finally {
      setTimerBusy(false);
    }
  }

  async function addTime() {
    const value = await prompt({
      title: "Süre ekle",
      message: "Kaç dakika eklensin? (1–180)",
      defaultValue: "10",
      placeholder: "Dakika",
      keyboardType: "number-pad",
      maxLength: 3,
      confirmLabel: "Ekle",
    });
    if (!value) return;
    const minutes = Number(value.replace(/\D/g, ""));
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) return setError("1 ile 180 dakika arasında bir süre gir.");
    try {
      applyClock(await api.exams.extend(exam.id, { minutes }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Süre eklenemedi.");
    }
  }

  async function editSource() {
    if (!q.bookQuestionId) return;
    setTimerBusy(true);
    try {
      skipAutoPause.current = true;
      if (timed && !paused) applyClock(await api.exams.pause(exam.id));
      editing.current = true;
      router.push({ pathname: "/sorular/[id]", params: { id: exam.bookId, soru: q.bookQuestionId } });
    } catch {
      skipAutoPause.current = false;
      setError("Sınav duraklatılamadı; düzenlemeye geçilmedi.");
    } finally {
      setTimerBusy(false);
    }
  }

  const choose = (letter: ChoiceLetter | null) => {
    const previous = answers[q.id] ?? null;
    setAnswers((a) => ({ ...a, [q.id]: letter }));
    setError(null);
    api.exams.answer(exam.id, q.id, { answer: letter }).catch((err) => {
      setAnswers((a) => ({ ...a, [q.id]: previous }));
      // 409: sınav bitti ya da duraklatıldı; güncel hâli okunur.
      if (err instanceof ApiError && err.status === 409) return onFinished();
      setError("Cevap kaydedilemedi. Bağlantını kontrol edip tekrar işaretle.");
    });
  };

  const go = (i: number) => setIndex(Math.min(Math.max(0, i), exam.questions.length - 1));

  async function confirmFinish() {
    const blank = exam.questions.length - answered;
    const ok = await confirm({
      title: "Sınavı bitir",
      message: `${blank ? `${blank} soru boş. ` : ""}Bitirdikten sonra cevaplar değiştirilemez.`,
      confirmLabel: "Bitir",
    });
    if (ok) void finish();
  }

  const multiSection = new Set(exam.questions.map((x) => x.section)).size > 1;
  const low = remaining !== null && remaining < WARN_MS;
  const current = answers[q.id] ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {dialog}
      <Stack.Screen
        options={{
          title: exam.title,
          headerRight: () => (
            <Button size="sm" loading={finishing} icon={<Flag size={16} color={colors.onPrimary} />} onPress={() => void confirmFinish()}>
              Bitir
            </Button>
          ),
        }}
      />

      {/* Süre şeridi */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[2],
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
          backgroundColor: colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          accessibilityRole="timer"
          accessibilityLabel={remaining !== null ? `Kalan süre ${formatClock(remaining)}` : "Süresiz"}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            height: 36,
            paddingHorizontal: spacing[3],
            borderRadius: radius.full,
            backgroundColor: remaining === null ? colors.surfaceMuted : paused ? colors.warningSoft : low ? colors.dangerSoft : colors.primarySoft,
          }}
        >
          {paused ? (
            <Pause size={16} color={colors.warning} />
          ) : (
            <Clock size={16} color={remaining === null ? colors.textMuted : low ? colors.danger : colors.primarySoftText} />
          )}
          <Text
            weight="semibold"
            tone={remaining === null ? "textMuted" : paused ? "warning" : low ? "danger" : "primarySoftText"}
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {remaining !== null ? formatClock(remaining) : "Süresiz"}
          </Text>
        </View>
        {timed && (
          <>
            <IconButton label={paused ? "Süreyi başlat" : "Süreyi durdur"} disabled={timerBusy || finishing} onPress={() => void togglePause()}>
              {paused ? <Play size={20} color={colors.text} /> : <Pause size={20} color={colors.text} />}
            </IconButton>
            <IconButton label="Süre ekle" disabled={finishing} onPress={() => void addTime()}>
              <Plus size={20} color={colors.text} />
            </IconButton>
          </>
        )}
        <Text size="sm" tone="textMuted" style={{ marginLeft: "auto", fontVariant: ["tabular-nums"] }}>
          {answered}/{exam.questions.length} cevaplandı
        </Text>
      </View>

      {error && (
        <View accessibilityRole="alert" style={{ flexDirection: "row", gap: spacing[2], alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[2], backgroundColor: colors.dangerSoft }}>
          <CircleAlert size={16} color={colors.danger} />
          <Text size="sm" tone="danger" style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      )}

      {/* Soru başlığı */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[3], paddingHorizontal: spacing[4], paddingTop: spacing[3] }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing[2], flexShrink: 1 }}>
          <Text size="lg" weight="semibold" style={{ fontVariant: ["tabular-nums"] }}>
            {index + 1}. soru
          </Text>
          {multiSection && (
            <Text size="sm" tone="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {q.section}
            </Text>
          )}
        </View>
        {q.bookQuestionId && (
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Kutu ya da cevap yanlışsa düzelt; bu sırada süre durur"
            disabled={timerBusy || finishing}
            onPress={() => void editSource()}
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Pencil size={14} color={colors.textMuted} />
            <Text size="sm" weight="medium" tone="textMuted">
              Kaynağında düzenle
            </Text>
          </Pressable>
        )}
      </View>

      {/* Soru görseli; duraklatılmışken gizlenir */}
      <View style={{ flex: 1, margin: spacing[3], borderRadius: radius.lg, overflow: "hidden" }}>
        <QuestionView bookId={exam.bookId} q={q} hidden={paused} style={{ flex: 1 }} />
        {paused && (
          <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: spacing[3], padding: spacing[6], backgroundColor: colors.surfaceMuted }}>
            <Pause size={32} color={colors.warning} />
            <Text weight="semibold">Sınav duraklatıldı</Text>
            <Text size="sm" tone="textMuted" style={{ textAlign: "center" }}>
              Süre işlemiyor. Devam edince soru yeniden görünür.
            </Text>
            <Button icon={<Play size={18} color={colors.onPrimary} />} loading={timerBusy} onPress={() => void togglePause()}>
              Devam et
            </Button>
          </View>
        )}
      </View>

      {/* Cevaplar ve gezinme */}
      <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: insets.bottom }}>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Cevabın"
          style={{ flexDirection: "row", justifyContent: "center", gap: spacing[2], paddingTop: spacing[3], paddingHorizontal: spacing[3], opacity: paused ? 0.4 : 1 }}
          pointerEvents={paused ? "none" : "auto"}
        >
          {CHOICE_LETTERS.slice(0, q.choiceCount).map((letter) => {
            const active = current === letter;
            return (
              <Pressable
                key={letter}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`Cevap ${letter}`}
                onPress={() => choose(active ? null : letter)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.borderStrong,
                  backgroundColor: active ? colors.primary : "transparent",
                }}
              >
                <Text size="lg" weight="semibold" style={{ color: active ? colors.onPrimary : colors.text }}>
                  {letter}
                </Text>
              </Pressable>
            );
          })}
          {/* Boş: işaretli cevabı kaldırır; cevap yokken seçili görünür. */}
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: !current }}
            accessibilityLabel="Boş bırak"
            onPress={() => current && choose(null)}
            style={{
              height: 48,
              paddingHorizontal: spacing[4],
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: !current ? colors.textMuted : colors.borderStrong,
              backgroundColor: !current ? colors.surfaceMuted : "transparent",
            }}
          >
            <Text weight="semibold" tone={!current ? "text" : "textMuted"}>
              Boş
            </Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
          <IconButton label="Önceki soru" disabled={index === 0} onPress={() => go(index - 1)}>
            <ChevronLeft size={24} color={colors.text} />
          </IconButton>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Soru ${index + 1} / ${exam.questions.length}. Soru haritasını aç.`}
            onPress={() => setMapOpen(true)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing[2],
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[2],
              borderRadius: radius.md,
              backgroundColor: pressed ? colors.surfaceMuted : "transparent",
            })}
          >
            <Grid3x3 size={18} color={colors.textMuted} />
            <Text weight="medium" style={{ fontVariant: ["tabular-nums"] }}>
              {index + 1} / {exam.questions.length}
            </Text>
          </Pressable>
          <IconButton label="Sonraki soru" disabled={index === exam.questions.length - 1} onPress={() => go(index + 1)}>
            <ChevronRight size={24} color={colors.text} />
          </IconButton>
        </View>
      </View>

      <Sheet visible={mapOpen} title={`Sorular · ${exam.questions.length - answered} boş`} onClose={() => setMapOpen(false)}>
        <QuestionMap
          count={exam.questions.length}
          current={index}
          toneOf={(i) => (answers[exam.questions[i]!.id] ? "answered" : "blank")}
          labelOf={(i) => `${i + 1}. soru${answers[exam.questions[i]!.id] ? `, cevap ${answers[exam.questions[i]!.id]}` : ", boş"}`}
          onPick={(i) => {
            setMapOpen(false);
            go(i);
          }}
        />
        <View style={{ flexDirection: "row", gap: spacing[4], paddingHorizontal: spacing[5], paddingTop: spacing[3] }}>
          <Legend color={colors.primary} label="Cevaplandı" />
          <Legend color={colors.surfaceMuted} label="Boş" />
        </View>
      </Sheet>
    </View>
  );
}

export type MapTone = "answered" | "blank" | "correct" | "wrong";

/** Soru haritası: numaralı kareler; dokununca o soruya gidilir. */
export function QuestionMap({
  count,
  current,
  number = (i) => i + 1,
  toneOf,
  labelOf,
  onPick,
}: {
  count: number;
  current: number | null;
  /** Karede yazan numara (varsayılan sıra + 1) */
  number?: (i: number) => number;
  toneOf: (i: number) => MapTone;
  labelOf: (i: number) => string;
  onPick: (i: number) => void;
}) {
  const { colors } = useTheme();
  const tones: Record<MapTone, [string, string]> = {
    answered: [colors.primary, colors.onPrimary],
    blank: [colors.surfaceMuted, colors.textMuted],
    correct: [colors.successSoft, colors.success],
    wrong: [colors.dangerSoft, colors.danger],
  };
  return (
    <ScrollView scrollEnabled={false} contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: spacing[5] }}>
      {Array.from({ length: count }, (_, i) => {
        const [bg, fg] = tones[toneOf(i)];
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={labelOf(i)}
            accessibilityState={{ selected: i === current }}
            onPress={() => onPick(i)}
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: bg,
              borderWidth: i === current ? 2 : 0,
              borderColor: colors.primary,
            }}
          >
            <Text size="sm" weight="medium" style={{ color: fg, fontVariant: ["tabular-nums"] }}>
              {number(i)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color }} />
      <Text size="xs" tone="textMuted">
        {label}
      </Text>
    </View>
  );
}
