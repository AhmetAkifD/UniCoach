import { View } from "react-native";
import { radius, spacing } from "@unicoach/design";
import { useTheme } from "@/lib/theme";
import { Text } from "./text";

export interface ProgressBarProps {
  /** 0-100 */
  value: number;
  label?: string;
  /** Dolgu rengi; varsayılan birincil renk. Ders rengi için ör. "#6366F1". */
  color?: string;
  showValue?: boolean;
}

/** İnce ilerleme çubuğu (web'deki ProgressBar). */
export function ProgressBar({ value, label, color, showValue = true }: ProgressBarProps) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: pct }}
        style={{ flex: 1, height: 8, borderRadius: radius.full, backgroundColor: colors.surfaceMuted, overflow: "hidden" }}
      >
        <View style={{ width: `${pct}%`, height: "100%", borderRadius: radius.full, backgroundColor: color ?? colors.primary }} />
      </View>
      {showValue && (
        <Text size="sm" weight="medium" tone="textMuted" style={{ width: 40, textAlign: "right", fontVariant: ["tabular-nums"] }}>
          %{pct}
        </Text>
      )}
    </View>
  );
}
