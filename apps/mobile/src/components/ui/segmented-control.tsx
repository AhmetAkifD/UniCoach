import { Pressable, View } from "react-native";
import { radius, spacing } from "@unicoach/design";
import { useTheme } from "@/lib/theme";
import { Text } from "./text";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** Birkaç seçenekten biri (web'deki SegmentedControl); ekran okuyucuda radyo grubu. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  disabled,
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text size="sm" weight="medium" tone="textMuted">
        {label}
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={{
          flexDirection: "row",
          gap: 4,
          padding: 4,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.border,
          backgroundColor: colors.surfaceMuted,
        }}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={{
                flex: 1,
                minHeight: 36,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: spacing[2],
                paddingVertical: 6,
                borderRadius: radius.sm,
                backgroundColor: selected ? colors.surface : "transparent",
              }}
            >
              <Text size="sm" weight="medium" tone={selected ? "text" : "textMuted"}>
                {option.label}
              </Text>
              {option.hint && (
                <Text size="xs" tone="textSubtle">
                  {option.hint}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
      {error && (
        <Text size="sm" tone="danger">
          {error}
        </Text>
      )}
    </View>
  );
}
