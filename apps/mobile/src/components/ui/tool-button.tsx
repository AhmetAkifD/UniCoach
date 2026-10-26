import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { radius, spacing } from "@unicoach/design";
import { useTheme } from "@/lib/theme";

/** Araç çubuğunda ilişkili düğmeleri ince bir çizgiyle ayırır (web'deki ToolGroup). */
export function ToolGroup({ children, first = false }: { children: ReactNode; first?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        paddingHorizontal: spacing[1] + 2,
        borderLeftWidth: first ? 0 : 1,
        borderLeftColor: colors.border,
      }}
    >
      {children}
    </View>
  );
}

/**
 * 36px yalnızca ikonlu araç düğmesi (web'deki ToolButton); `label` ekran okuyucu adıdır, `active` seçili aracı
 * gösterir. İkon rengi düğmenin durumuna göre verilir: `children` rengi alan bir işlev olabilir.
 */
export function ToolButton({
  label,
  onPress,
  disabled,
  active,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode | ((color: string) => ReactNode);
}) {
  const { colors } = useTheme();
  const color = active ? colors.primarySoftText : colors.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={2}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
        backgroundColor: active ? colors.primarySoft : pressed ? colors.surfaceMuted : "transparent",
      })}
    >
      {typeof children === "function" ? children(color) : children}
    </Pressable>
  );
}
