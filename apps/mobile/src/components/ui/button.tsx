import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { radius, spacing } from "@unicoach/design";
import { useTheme } from "@/lib/theme";
import { Text } from "./text";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const heights: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 52 };

export interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Metnin solundaki ikon */
  icon?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Web'deki Button ile aynı varyantlar ve boyutlar. */
export function Button({ variant = "primary", size = "md", loading, disabled, icon, children, style, ...props }: ButtonProps) {
  const { colors } = useTheme();
  const bg = { primary: colors.primary, secondary: colors.primarySoft, ghost: "transparent", danger: colors.danger }[variant];
  const fg = { primary: colors.onPrimary, secondary: colors.primarySoftText, ghost: colors.text, danger: colors.onPrimary }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={typeof children === "string" ? children : undefined}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      style={({ pressed }) => [
        {
          height: heights[size],
          paddingHorizontal: size === "sm" ? spacing[3] : spacing[5],
          borderRadius: radius.md,
          backgroundColor: bg,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing[2],
        },
        style,
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <View>{icon}</View> : null}
      {typeof children === "string" ? (
        <Text weight="medium" size={size === "sm" ? "sm" : size === "lg" ? "lg" : "base"} style={{ color: fg }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
