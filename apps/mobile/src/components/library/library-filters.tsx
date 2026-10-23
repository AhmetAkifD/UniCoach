import { Pressable, ScrollView, View } from "react-native";
import { layout, radius, spacing } from "@unicoach/design";
import type { SubjectFilter, SubjectFilterOption } from "@unicoach/shared";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/lib/theme";

/**
 * Konu Anlatımı ve Soru Bankası filtreleri (web'deki LibraryFilters): 1. satır sınav, 2. satır ders.
 * Hesap packages/shared `subjectFilters`'tadır; mobilde satırlar yana kayar, seçim ekranın state'inde tutulur.
 */
export function LibraryFilters({
  exams,
  dersler,
  exam,
  ders,
  onChange,
}: {
  exams: SubjectFilterOption[];
  dersler: SubjectFilterOption[];
  exam: string | null;
  ders: string | null;
  onChange: (filter: SubjectFilter) => void;
}) {
  return (
    <View style={{ gap: spacing[2] }}>
      <ChipRow label="Sınav" options={exams} selected={exam?.toLowerCase() ?? null} onChange={onChange} />
      <ChipRow label="Ders" options={dersler} selected={ders} onChange={onChange} />
    </View>
  );
}

function ChipRow({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: SubjectFilterOption[];
  selected: string | null;
  onChange: (filter: SubjectFilter) => void;
}) {
  const { colors } = useTheme();
  const gutter = layout.pageGutter.mobile;
  return (
    // Satır ekran kenarına kadar kayar; ilk çip sayfa boşluğuyla hizalı başlar.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={`${label} filtresi`}
      style={{ marginHorizontal: -gutter }}
      contentContainerStyle={{ paddingHorizontal: gutter, gap: spacing[2], alignItems: "center" }}
    >
      <Text size="sm" tone="textMuted" style={{ width: 44 }}>
        {label}
      </Text>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value ?? "tumu"}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.target)}
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
              {option.label}
            </Text>
            <Text size="xs" tone={active ? "primarySoftText" : "textSubtle"} style={{ fontVariant: ["tabular-nums"] }}>
              {option.count}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
