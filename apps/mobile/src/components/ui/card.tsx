import { Pressable, View, type PressableProps, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { radius, shadow, spacing } from "@unicoach/design";
import { useTheme } from "@/lib/theme";

export interface CardProps extends ViewProps {
  /** Varsayılan iç boşluğu kaldırır (liste ve bölmeli kartlar). */
  flush?: boolean;
}

/** Yuvarlak, ince kenarlı yüzey kartı (web'deki Card). */
export function Card({ flush, style, ...props }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: flush ? 0 : spacing[5],
          elevation: shadow.card.elevation,
          shadowColor: "#0F172A",
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        },
        style,
      ]}
      {...props}
    />
  );
}

/** Dokunulabilir kart (web'deki `interactive`) */
export function PressableCard({ style, ...props }: Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: spacing[5],
          elevation: shadow.card.elevation,
          opacity: pressed ? 0.9 : 1,
        },
        style,
      ]}
      {...props}
    />
  );
}
