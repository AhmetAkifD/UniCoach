import type { ReactNode } from "react";
import { Pressable } from "react-native";
import { radius } from "@unicoach/design";
import { useTheme } from "@/lib/theme";

/** 44px yalnızca ikonlu düğme (sayfa okları gibi); ekran okuyucu için `label` zorunlu. */
export function IconButton({ label, disabled, onPress, children }: { label: string; disabled?: boolean; onPress: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.35 : 1,
        backgroundColor: pressed ? colors.surfaceMuted : "transparent",
      })}
    >
      {children}
    </Pressable>
  );
}
