import { View } from "react-native";
import { radius, spacing } from "@unicoach/design";
import { modules, type ModuleInfo } from "@/lib/modules";
import { useTheme } from "@/lib/theme";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { Screen } from "./ui/screen";
import { Text } from "./ui/text";

/** Mobilde henüz yapılmamış modül sekmesi (web'de kullanılabilir). */
export function ComingSoon({ route }: { route: NonNullable<ModuleInfo["route"]> }) {
  const { colors } = useTheme();
  const mod = modules.find((m) => m.route === route)!;
  const Icon = mod.icon;
  return (
    <Screen edges={[]}>
      <Card style={{ alignItems: "center", gap: spacing[4], paddingVertical: spacing[10] }}>
        <View style={{ width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
          <Icon size={28} color={colors.primarySoftText} strokeWidth={1.75} />
        </View>
        <Badge tone="primary">Mobilde yakında</Badge>
        <Text size="xl" weight="semibold">
          {mod.title}
        </Text>
        <Text tone="textMuted" style={{ textAlign: "center" }}>
          {mod.description}
        </Text>
        <Text size="sm" tone="textSubtle" style={{ textAlign: "center" }}>
          Bu modülü şimdilik web sitesinden kullanabilirsin.
        </Text>
      </Card>
    </Screen>
  );
}
