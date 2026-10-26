import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { ChevronDown, Maximize2, Minimize2, type LucideIcon } from "lucide-react-native";
import { spacing } from "@unicoach/design";
import { Text } from "@/components/ui/text";
import { ToolButton } from "@/components/ui/tool-button";
import { useTheme } from "@/lib/theme";

/**
 * Çalışma Alanı bölmesinin başlık şeridi: solda seçili video/PDF/defter (dokununca seçim penceresi açılır),
 * sağda bölmeye özel düğmeler ve tam ekran.
 */
export function PaneBar({
  icon: Icon,
  title,
  placeholder,
  onPick,
  maximized,
  onToggleMaximize,
  children,
}: {
  icon: LucideIcon;
  title: string | null;
  /** Seçim yokken gösterilen metin */
  placeholder: string;
  onPick: () => void;
  maximized: boolean;
  onToggleMaximize: () => void;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing[1],
        height: 44,
        paddingLeft: spacing[3],
        paddingRight: spacing[1],
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title ?? placeholder}. Değiştirmek için dokun.`}
        onPress={onPick}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing[2], minHeight: 40 }}
      >
        <Icon size={18} color={colors.primary} strokeWidth={1.9} />
        <Text size="sm" weight="semibold" tone={title ? "text" : "textMuted"} numberOfLines={1} style={{ flexShrink: 1 }}>
          {title ?? placeholder}
        </Text>
        <ChevronDown size={16} color={colors.textMuted} />
      </Pressable>
      {children}
      <ToolButton label={maximized ? "Tam ekrandan çık" : "Tam ekran"} onPress={onToggleMaximize}>
        {(color) => (maximized ? <Minimize2 size={18} color={color} /> : <Maximize2 size={18} color={color} />)}
      </ToolButton>
    </View>
  );
}
