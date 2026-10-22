import { View } from "react-native";
import { Check, X } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import { PASSWORD_RULES } from "@unicoach/shared";
import { useTheme } from "@/lib/theme";
import { Text } from "./ui/text";

/** Şifre yazılırken görünen canlı kural listesi (kurallar packages/shared'dan). */
export function PasswordChecklist({ password }: { password: string }) {
  const { colors } = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={{ gap: 4, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, padding: spacing[3] }}>
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        const Icon = ok ? Check : X;
        return (
          <View key={rule.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            <Icon size={16} color={ok ? colors.success : colors.textMuted} />
            <Text size="sm" tone={ok ? "success" : "textMuted"}>
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
