import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Check, SplitSquareVertical, Trash2 } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import {
  ANSWER_KEY_METHOD_LABELS,
  ANSWER_KEY_METHODS,
  CHOICE_LETTERS,
  DETECT_METHOD_LABELS,
  DETECT_METHODS,
  parseAnswerKeyText,
  type AnswerKeyMethod,
  type ChoiceLetter,
  type DetectMethod,
  type EditorQuestion,
} from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { fonts, useTheme } from "@/lib/theme";

/** Doğru cevap düğmeleri (A–E); seçili olana yeniden dokunmak cevabı kaldırır. */
export function AnswerChoices({
  q,
  onChange,
  size = 40,
}: {
  q: EditorQuestion;
  onChange: (answer: ChoiceLetter | null) => void;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Doğru cevap" style={{ flexDirection: "row", gap: spacing[2] }}>
      {CHOICE_LETTERS.slice(0, q.choiceCount).map((letter) => {
        const active = q.answer === letter;
        return (
          <Pressable
            key={letter}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={`Cevap ${letter}`}
            onPress={() => onChange(active ? null : letter)}
            hitSlop={4}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: active ? colors.success : colors.borderStrong,
              backgroundColor: active ? colors.successSoft : "transparent",
            }}
          >
            <Text size="sm" weight="semibold" tone={active ? "success" : "textMuted"}>
              {letter}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Seçili sorunun ayrıntıları (web'deki QuestionForm): test adı, numara, cevap, şık sayısı, yeni test, silme. */
export function QuestionSheet({
  visible,
  onClose,
  q,
  sections,
  duplicate,
  onChange,
  onSplit,
  onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  q: EditorQuestion | null;
  sections: string[];
  duplicate: boolean;
  onChange: (value: Partial<EditorQuestion>) => void;
  onSplit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const [numberDraft, setNumberDraft] = useState<string | null>(null);
  if (!q) return null;
  const others = sections.filter((s) => s !== q.section);
  return (
    <Sheet visible={visible} title={`${q.section} · ${q.number}. soru`} onClose={onClose}>
      <View style={{ paddingHorizontal: spacing[5], gap: spacing[5] }}>
        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Test adı"
              value={q.section}
              onChangeText={(section) => onChange({ section })}
              maxLength={60}
              error={q.section.trim() ? undefined : "Test adı yaz."}
            />
          </View>
          <View style={{ width: 88 }}>
            <Input
              label="No"
              keyboardType="number-pad"
              value={numberDraft ?? String(q.number)}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, "").slice(0, 3);
                setNumberDraft(digits);
                const n = Number(digits);
                if (n >= 1) onChange({ number: n });
              }}
              onBlur={() => setNumberDraft(null)}
              error={duplicate ? "Tekrar" : undefined}
            />
          </View>
        </View>
        {others.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }} style={{ marginTop: -spacing[3] }}>
            {others.map((s) => (
              <Pressable
                key={s}
                accessibilityRole="button"
                accessibilityLabel={`Test: ${s}`}
                onPress={() => onChange({ section: s })}
                style={{ height: 30, justifyContent: "center", paddingHorizontal: spacing[3], borderRadius: radius.full, borderWidth: 1, borderColor: colors.border }}
              >
                <Text size="sm" tone="textMuted">
                  {s}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <View style={{ gap: spacing[2] }}>
          <Text size="sm" weight="medium">
            Doğru cevap
          </Text>
          <AnswerChoices q={q} onChange={(answer) => onChange({ answer })} size={44} />
        </View>
        <SegmentedControl
          label="Şık sayısı"
          options={[
            { value: "4", label: "4 şık" },
            { value: "5", label: "5 şık" },
          ]}
          value={String(q.choiceCount) as "4" | "5"}
          onChange={(value) => {
            const n = Number(value);
            onChange({ choiceCount: n, answer: q.answer && CHOICE_LETTERS.indexOf(q.answer) >= n ? null : q.answer });
          }}
        />
        <View style={{ gap: spacing[3] }}>
          <Button variant="secondary" icon={<SplitSquareVertical size={18} color={colors.primarySoftText} />} onPress={onSplit}>
            Buradan yeni test başlat
          </Button>
          <Text size="xs" tone="textSubtle" style={{ marginTop: -spacing[2] }}>
            Bu soru ve testteki sonrakiler yeni teste taşınır, 1'den numaralanır.
          </Text>
          <Button variant="danger" icon={<Trash2 size={18} color={colors.onPrimary} />} onPress={onDelete}>
            Soruyu sil
          </Button>
        </View>
      </View>
    </Sheet>
  );
}

/** Testler ve elle cevap anahtarı girme (web'deki "Testler" kartı ve AnswerKeyForm). */
export function TestsSheet({
  visible,
  onClose,
  sorted,
  sections,
  onOpenTest,
  onApplyKey,
}: {
  visible: boolean;
  onClose: () => void;
  sorted: EditorQuestion[];
  sections: string[];
  onOpenTest: (section: string) => void;
  /** Uygulanan cevap sayısını döner. */
  onApplyKey: (section: string, answers: Map<number, string>) => number;
}) {
  const { colors } = useTheme();
  const [section, setSection] = useState<string | null>(null);
  const [text, setText] = useState("");
  const target = section && sections.includes(section) ? section : (sections[0] ?? null);
  const parsed = parseAnswerKeyText(text);
  const answered = sorted.filter((q) => q.answer).length;
  return (
    <Sheet visible={visible} title="Testler" onClose={onClose}>
      <View style={{ paddingHorizontal: spacing[5], gap: spacing[5] }}>
        <Text size="sm" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
          {sorted.length} soru · {answered} cevaplı
        </Text>
        {sections.length === 0 ? (
          <Text size="sm" tone="textMuted">
            Sorular bulununca testler burada listelenir.
          </Text>
        ) : (
          <View style={{ gap: spacing[1] }}>
            {sections.map((s) => {
              const list = sorted.filter((q) => q.section === s);
              return (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  accessibilityLabel={`${s} testine git`}
                  onPress={() => onOpenTest(s)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: spacing[3],
                    paddingVertical: spacing[2],
                    paddingHorizontal: spacing[2],
                    marginHorizontal: -spacing[2],
                    borderRadius: radius.md,
                    backgroundColor: pressed ? colors.surfaceMuted : "transparent",
                  })}
                >
                  <Text numberOfLines={1} style={{ flex: 1 }}>
                    {s}
                  </Text>
                  <Text size="sm" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
                    {list.length} · {list.filter((q) => q.answer).length} cevaplı
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {target && (
          <View style={{ gap: spacing[3], borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing[4] }}>
            <Text weight="semibold">Cevap anahtarı gir</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
              {sections.map((s) => {
                const active = s === target;
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    onPress={() => setSection(s)}
                    style={{
                      height: 32,
                      justifyContent: "center",
                      paddingHorizontal: spacing[3],
                      borderRadius: radius.full,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primarySoft : colors.surface,
                    }}
                  >
                    <Text size="sm" weight="medium" tone={active ? "primarySoftText" : "textMuted"}>
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Input
              placeholder={'"CABDE…" ya da "1-C 2-A 3-B…"'}
              value={text}
              onChangeText={setText}
              multiline
              autoCapitalize="characters"
              autoCorrect={false}
              style={{ height: 88, paddingTop: spacing[3], textAlignVertical: "top", fontFamily: fonts.medium, letterSpacing: 1 }}
              hint={`${parsed.size} cevap okundu`}
            />
            <Button
              disabled={!parsed.size}
              onPress={() => {
                onApplyKey(target, parsed);
                setText("");
              }}
            >
              Uygula
            </Button>
          </View>
        )}
      </View>
    </Sheet>
  );
}

/** Soru bulma ve cevap anahtarı yöntemi; seçim PDF için hemen kaydedilir. */
export function MethodsSheet({
  visible,
  onClose,
  detectMethod,
  keyMethod,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  detectMethod: DetectMethod;
  keyMethod: AnswerKeyMethod;
  onChange: (value: { detectMethod?: DetectMethod; keyMethod?: AnswerKeyMethod }) => void;
}) {
  return (
    <Sheet visible={visible} title="Bulma yöntemi" onClose={onClose}>
      <View style={{ paddingHorizontal: spacing[5], gap: spacing[5] }}>
        <Text size="sm" tone="textMuted">
          Kitabın düzenine uyanı seç; bu PDF için hatırlanır. Otomatik, hepsini dener.
        </Text>
        <RadioList
          label="Soruları bulma"
          options={DETECT_METHODS.map((m) => ({ value: m, label: DETECT_METHOD_LABELS[m] }))}
          value={detectMethod}
          onChange={(value) => onChange({ detectMethod: value })}
        />
        <RadioList
          label="Cevap anahtarı"
          options={ANSWER_KEY_METHODS.map((m) => ({ value: m, label: ANSWER_KEY_METHOD_LABELS[m] }))}
          value={keyMethod}
          onChange={(value) => onChange({ keyMethod: value })}
        />
      </View>
    </Sheet>
  );
}

function RadioList<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: spacing[1] }}>
      <Text size="sm" weight="medium">
        {label}
      </Text>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: spacing[3],
              minHeight: 44,
              paddingHorizontal: spacing[3],
              borderRadius: radius.md,
              backgroundColor: active ? colors.primarySoft : pressed ? colors.surfaceMuted : "transparent",
            })}
          >
            <Text style={{ flex: 1 }} tone={active ? "primarySoftText" : "text"} weight={active ? "medium" : "regular"}>
              {o.label}
            </Text>
            {active && <Check size={18} color={colors.primarySoftText} />}
          </Pressable>
        );
      })}
    </View>
  );
}
