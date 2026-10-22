import type { ReactNode } from "react";
import { View } from "react-native";
import { radius } from "@unicoach/design";
import { useTheme, type Colors } from "@/lib/theme";
import { Text } from "./text";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const tones: Record<BadgeTone, [keyof Colors, keyof Colors]> = {
  neutral: ["surfaceMuted", "textMuted"],
  primary: ["primarySoft", "primarySoftText"],
  success: ["successSoft", "success"],
  warning: ["warningSoft", "warning"],
  danger: ["dangerSoft", "danger"],
  info: ["infoSoft", "info"],
};

/** Küçük yuvarlak etiket (web'deki Badge). */
export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  const { colors } = useTheme();
  const [bg, fg] = tones[tone];
  return (
    <View style={{ alignSelf: "flex-start", borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 2, backgroundColor: colors[bg] }}>
      <Text size="xs" weight="medium" tone={fg}>
        {children}
      </Text>
    </View>
  );
}
