import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown, X } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import { EXAM_TRACK_LABELS, SUBJECTS, findSubject, type ExamTrack } from "@unicoach/shared";
import { Text } from "@/components/ui/text";
import { subjectColor } from "@/lib/subject-color";
import { useTheme } from "@/lib/theme";

/**
 * Ders seçimi (web'deki SubjectSelect). React Native'de `select` olmadığı için alan dokununca alttan liste açılır.
 * Öğrencinin sınavının dersleri önce listelenir; diğer sınavın dersleri de seçilebilir, o durumda yalnızca
 * küçük bir hatırlatma gösterilir (engellenmez).
 */
export function SubjectSelect({
  value,
  onChange,
  examTrack,
  error,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  examTrack: ExamTrack | null;
  error?: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const tracks: ExamTrack[] = examTrack === "LGS" ? ["LGS", "YKS"] : ["YKS", "LGS"];
  const selected = findSubject(value);
  const otherTrack = selected && examTrack && selected.track !== examTrack;

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ders: ${selected?.label ?? "seçilmedi"}`}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{
          height: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[2],
          paddingHorizontal: spacing[3] + 2,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.borderStrong,
          backgroundColor: colors.surface,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: subjectColor(selected.id) }} />}
        <Text tone={selected ? "text" : "textSubtle"} style={{ flex: 1 }} numberOfLines={1}>
          {selected?.label ?? "Ders seç"}
        </Text>
        <ChevronDown size={18} color={colors.textMuted} />
      </Pressable>
      {error ? (
        <Text size="sm" tone="danger">
          {error}
        </Text>
      ) : otherTrack ? (
        <Text size="sm" tone="warning">
          Bu ders {EXAM_TRACK_LABELS[selected.track]} dersi; sen {EXAM_TRACK_LABELS[examTrack]} sınavına hazırlanıyorsun. Yine de
          ekleyebilirsin.
        </Text>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType="slide"
        // Android: karartma durum çubuğunun ve gezinme çubuğunun altına da uzansın.
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <Pressable
            onPress={() => undefined}
            style={{
              maxHeight: "80%",
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingBottom: insets.bottom,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing[4], paddingLeft: spacing[5] }}>
              <Text size="lg" weight="semibold">
                Ders seç
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={() => setOpen(false)} hitSlop={8}>
                <X size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: spacing[2], paddingBottom: spacing[4] }}>
              {tracks.map((track) => (
                <View key={track}>
                  <Text size="xs" weight="semibold" tone="textSubtle" style={{ paddingHorizontal: spacing[3], paddingTop: spacing[3], paddingBottom: spacing[1] }}>
                    {EXAM_TRACK_LABELS[track]}
                  </Text>
                  {SUBJECTS.filter((s) => s.track === track).map((s) => {
                    const active = s.id === value;
                    return (
                      <Pressable
                        key={s.id}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        onPress={() => {
                          setOpen(false);
                          if (!active) onChange(s.id);
                        }}
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
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: subjectColor(s.id) }} />
                        <Text style={{ flex: 1 }} tone={active ? "primarySoftText" : "text"} weight={active ? "medium" : "regular"}>
                          {s.label}
                        </Text>
                        {active && <Check size={18} color={colors.primarySoftText} />}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
