import { useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { ChevronDown, ChevronUp, CircleAlert } from "lucide-react-native";
import { radius, spacing, typography } from "@unicoach/design";
import {
  ApiError,
  buildResultInput,
  calculateNet,
  formatNet,
  placementCode,
  RESULT_RANK_FIELDS,
  RESULT_SCORE_CODES,
  RESULT_SCORE_LABELS,
  RESULT_SCORE_TYPES,
  RESULT_SESSIONS,
  resultFormHasExtras,
  resultFormTests,
  toResultFormState,
  YKS_FIRST_YEAR,
  type ResultFormErrors,
  type ResultScoreField,
  type ResultScoreType,
  type YksResult,
} from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useDialog } from "@/components/ui/use-dialog";
import { api } from "@/lib/api";
import { fonts, useTheme } from "@/lib/theme";

/**
 * Sonucu elle girme ve düzenleme (web'deki ResultForm; kurallar packages/shared/src/yks-result-form.ts'te).
 * Zorunlu olan yalnızca yerleştirme puanı ve başarı sırasıdır; diğerleri "Diğer bilgiler"de isteğe bağlıdır.
 */
export function ResultForm({
  result,
  savedYears,
  onSaved,
}: {
  /** Verilirse düzenleme: yıl değişmez. */
  result?: YksResult;
  savedYears: number[];
  onSaved: () => void;
}) {
  const { colors } = useTheme();
  const { confirm, dialog } = useDialog();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(result?.year ?? currentYear);
  const [state, setState] = useState(() => toResultFormState(result));
  const [errors, setErrors] = useState<ResultFormErrors>({});
  const [open, setOpen] = useState(() => resultFormHasExtras(toResultFormState(result)));
  const [pending, setPending] = useState(false);
  const testList = useMemo(() => resultFormTests(result), [result]);
  const initialPayload = useMemo(() => JSON.stringify(buildResultInput(toResultFormState(result), testList).payload), [result, testList]);
  const years = Array.from({ length: currentYear - YKS_FIRST_YEAR + 1 }, (_, i) => currentYear - i);

  const setScore = (type: ResultScoreType, field: ResultScoreField, value: string) =>
    setState((s) => ({ ...s, scores: { ...s.scores, [type]: { ...s.scores[type], [field]: value } } }));
  const setTest = (name: string, field: "correct" | "wrong", value: string) =>
    setState((s) => ({
      ...s,
      tests: { ...s.tests, [name]: { ...(s.tests[name] ?? { correct: "", wrong: "" }), [field]: value.replace(/\D/g, "").slice(0, 2) } },
    }));

  async function submit() {
    const { errors: found, payload } = buildResultInput(state, testList);
    setErrors(found);
    if (Object.keys(found).length) {
      if (Object.keys(found).some((k) => k === "obp" || k === "diplomaGrade" || k.startsWith("test.") || /\.(score|rank|bonus)/.test(k))) setOpen(true);
      return;
    }
    if (
      !result &&
      savedYears.includes(year) &&
      !(await confirm({ title: `${year} sonucu zaten kayıtlı`, message: "Kayıtlı sonucun girdiğin değerlerle değiştirilecek.", confirmLabel: "Değiştir" }))
    )
      return;
    // Belgeden okunan sonuç değiştirilmeden kaydedilirse kaynağı korunur.
    const source = result && JSON.stringify(payload) === initialPayload ? result.source : "manual";
    setPending(true);
    try {
      await api.results.save(year, { source, ...payload });
      onSaved();
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? (err.errors?.scores ?? err.errors?.tests ?? err.message) : "Sonuç kaydedilemedi." });
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={{ gap: spacing[4] }}>
      {dialog}
      <Card style={{ gap: spacing[4] }}>
        <View style={{ gap: 4 }}>
          <Text weight="semibold">Yerleştirme puanların</Text>
          <Text size="sm" tone="textMuted">
            Zorunlu olan yalnızca bunlar. Girmediğin puan türlerini boş bırak.
          </Text>
        </View>

        <View style={{ gap: 6 }}>
          <Text size="sm" weight="medium" tone="textMuted">
            Sınav yılı
          </Text>
          {result ? (
            <Text weight="semibold">{year}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
              {years.map((y) => (
                <Chip key={y} label={String(y)} active={y === year} onPress={() => setYear(y)} />
              ))}
            </ScrollView>
          )}
        </View>

        <View style={{ gap: spacing[2] }}>
          <View style={{ flexDirection: "row", gap: spacing[2] }}>
            <View style={{ width: 92 }} />
            <Text size="xs" weight="medium" tone="textMuted" style={{ flex: 1, textAlign: "right" }}>
              Yerleştirme puanı
            </Text>
            <Text size="xs" weight="medium" tone="textMuted" style={{ flex: 1, textAlign: "right" }}>
              Başarı sırası
            </Text>
          </View>
          {RESULT_SCORE_TYPES.map((type) => (
            <View key={type} style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start" }}>
              <View style={{ width: 92, paddingTop: 10 }}>
                <Text size="sm" weight="medium">
                  {RESULT_SCORE_LABELS[type]}
                </Text>
                <Text size="xs" tone="textMuted">
                  {placementCode(type)}
                </Text>
              </View>
              <NumberField
                label={`${RESULT_SCORE_LABELS[type]} yerleştirme puanı`}
                value={state.scores[type].placementScore}
                onChange={(v) => setScore(type, "placementScore", v)}
                error={errors[`${type}.placementScore`]}
              />
              <NumberField
                label={`${RESULT_SCORE_LABELS[type]} yerleştirme başarı sırası`}
                value={state.scores[type].placementRank}
                onChange={(v) => setScore(type, "placementRank", v)}
                error={errors[`${type}.placementRank`]}
                integer
              />
            </View>
          ))}
        </View>
        <Text size="xs" tone="textSubtle">
          Yerleştirme puanı OBP eklenmiş puandır; sonuç belgende Y- ile başlayan satırlardadır (Y-TYT, Y-SAY…). Puanı virgülle yazabilirsin (388,27039), sıradaki
          noktalar isteğe bağlı (224.527).
        </Text>
      </Card>

      <Card flush>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((o) => !o)}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], padding: spacing[5] }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text weight="semibold">Diğer bilgiler</Text>
            <Text size="sm" tone="textMuted">
              İsteğe bağlı: ham puanlar, ek puanlı yerleştirme, OBP ve netler.
            </Text>
          </View>
          {open ? <ChevronUp size={20} color={colors.textMuted} /> : <ChevronDown size={20} color={colors.textMuted} />}
        </Pressable>
        {open && (
          <View style={{ gap: spacing[6], paddingHorizontal: spacing[5], paddingBottom: spacing[5] }}>
            {RESULT_SCORE_TYPES.map((type) => (
              <View key={type} style={{ gap: spacing[2] }}>
                <Text size="sm" weight="medium">
                  {RESULT_SCORE_LABELS[type]}{" "}
                  <Text size="xs" tone="textMuted">
                    ({RESULT_SCORE_CODES[type]})
                  </Text>
                </Text>
                <View style={{ flexDirection: "row", gap: spacing[2] }}>
                  {(["score", "rank"] as const).map((f) => (
                    <LabeledField key={f} label={f === "score" ? "Puan" : "Başarı sırası"}>
                      <NumberField
                        label={`${RESULT_SCORE_LABELS[type]} ${f === "score" ? "puanı" : "başarı sırası"}`}
                        value={state.scores[type][f]}
                        onChange={(v) => setScore(type, f, v)}
                        error={errors[`${type}.${f}`]}
                        integer={RESULT_RANK_FIELDS.has(f)}
                      />
                    </LabeledField>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: spacing[2] }}>
                  {(["bonusScore", "bonusRank"] as const).map((f) => (
                    <LabeledField key={f} label={f === "bonusScore" ? "Ek puanlı puan" : "Ek puanlı sıra"}>
                      <NumberField
                        label={`${RESULT_SCORE_LABELS[type]} ${f === "bonusScore" ? "ek puanlı puanı" : "ek puanlı başarı sırası"}`}
                        value={state.scores[type][f]}
                        onChange={(v) => setScore(type, f, v)}
                        error={errors[`${type}.${f}`]}
                        integer={RESULT_RANK_FIELDS.has(f)}
                      />
                    </LabeledField>
                  ))}
                </View>
              </View>
            ))}
            <Text size="xs" tone="textSubtle">
              Ham puan OBP'siz puandır (belgede "Sınav puanları" sütunu). Ek puanlı yerleştirme yalnızca mesleki eğitim alanından gelenler içindir.
            </Text>

            <View style={{ flexDirection: "row", gap: spacing[3] }}>
              <LabeledField label="OBP">
                <NumberField label="OBP" value={state.obp} onChange={(v) => setState((s) => ({ ...s, obp: v }))} error={errors.obp} />
              </LabeledField>
              <LabeledField label="Diploma notu">
                <NumberField
                  label="Diploma notu"
                  value={state.diplomaGrade}
                  onChange={(v) => setState((s) => ({ ...s, diplomaGrade: v }))}
                  error={errors.diplomaGrade}
                />
              </LabeledField>
            </View>

            {RESULT_SESSIONS.map((session) => (
              <View key={session} style={{ gap: spacing[2] }}>
                <Text size="sm" weight="semibold">
                  {session} doğru ve yanlış sayıların
                </Text>
                <View style={{ flexDirection: "row", gap: spacing[2] }}>
                  <View style={{ flex: 1 }} />
                  {["Doğru", "Yanlış", "Net"].map((h) => (
                    <Text key={h} size="xs" weight="medium" tone="textMuted" style={{ width: h === "Net" ? 48 : 64, textAlign: "right" }}>
                      {h}
                    </Text>
                  ))}
                </View>
                {testList
                  .filter((t) => t.session === session)
                  .map((t) => {
                    const input = state.tests[t.name] ?? { correct: "", wrong: "" };
                    const correct = Number(input.correct || 0);
                    const wrong = Number(input.wrong || 0);
                    const error = errors[`test.${t.name}`];
                    return (
                      <View key={t.name} style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start" }}>
                        <View style={{ flex: 1, paddingTop: 10 }}>
                          <Text size="sm">{t.name}</Text>
                          {error && (
                            <Text size="xs" tone="danger">
                              {error}
                            </Text>
                          )}
                        </View>
                        <View style={{ width: 64 }}>
                          <NumberField label={`${t.name} doğru`} value={input.correct} onChange={(v) => setTest(t.name, "correct", v)} error={error ? " " : undefined} integer />
                        </View>
                        <View style={{ width: 64 }}>
                          <NumberField label={`${t.name} yanlış`} value={input.wrong} onChange={(v) => setTest(t.name, "wrong", v)} error={error ? " " : undefined} integer />
                        </View>
                        <Text size="sm" weight="medium" tone="textMuted" style={{ width: 48, textAlign: "right", paddingTop: 10, fontVariant: ["tabular-nums"] }}>
                          {correct + wrong ? formatNet(calculateNet({ correct, wrong }, "TYT")) : "–"}
                        </Text>
                      </View>
                    );
                  })}
              </View>
            ))}
          </View>
        )}
      </Card>

      {errors.form && (
        <View accessibilityRole="alert" style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start", borderRadius: radius.md, backgroundColor: colors.dangerSoft, padding: spacing[3] }}>
          <CircleAlert size={16} color={colors.danger} style={{ marginTop: 2 }} />
          <Text size="sm" tone="danger" style={{ flex: 1 }}>
            {errors.form}
          </Text>
        </View>
      )}
      {Object.keys(errors).some((k) => k !== "form") && (
        <Text accessibilityRole="alert" size="sm" tone="danger">
          İşaretli alanları düzelt.
        </Text>
      )}
      <Button loading={pending} onPress={() => void submit()}>
        {result ? "Değişiklikleri kaydet" : "Sonucu kaydet"}
      </Button>
    </View>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text size="xs" weight="medium" tone="textMuted">
        {label}
      </Text>
      {children}
    </View>
  );
}

/** Sağa yaslı sayı kutusu (puan ya da sıra). */
function NumberField({
  label,
  value,
  onChange,
  error,
  integer,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  integer?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={integer ? "number-pad" : "decimal-pad"}
        style={{
          height: 42,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.borderStrong,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing[3],
          color: colors.text,
          textAlign: "right",
          fontFamily: fonts.regular,
          fontSize: typography.fontSize.base[0],
          fontVariant: ["tabular-nums"],
        }}
      />
      {error?.trim() ? (
        <Text size="xs" tone="danger" style={{ textAlign: "right" }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Seçilebilir küçük çip (yıl, filtre seçenekleri). */
export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={{
        height: 34,
        justifyContent: "center",
        paddingHorizontal: spacing[3],
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
        backgroundColor: active ? colors.primarySoft : colors.surface,
      }}
    >
      <Text size="sm" weight="medium" tone={active ? "primarySoftText" : "textMuted"} style={{ fontVariant: ["tabular-nums"] }}>
        {label}
      </Text>
    </Pressable>
  );
}
