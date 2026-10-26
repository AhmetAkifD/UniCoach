import type { ReactNode } from "react";
import { View } from "react-native";
import { TriangleAlert } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import {
  comparisonYear,
  formatRank,
  formatScore,
  programMetaLine,
  programYears,
  rankComparison,
  type PreferenceWarning,
  type ProgramSummary,
} from "@unicoach/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/lib/theme";

/**
 * Programın yıllara göre taban puanı ve başarı sırası (en yeni önce; web'deki ProgramYears). Karşılaştırmada
 * kullanılan yıl (öğrencinin sonuç yılına en yakın olan) vurgulanır.
 */
export function ProgramYears({ program, highlightYear }: { program: ProgramSummary; highlightYear: number | null }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: "row", paddingHorizontal: spacing[2] }}>
        {["Yıl", "Taban puan", "Başarı sırası"].map((h, i) => (
          <Text key={h} size="xs" tone="textSubtle" style={{ flex: i ? 1 : 0.6, textAlign: i ? "right" : "left" }}>
            {h}
          </Text>
        ))}
      </View>
      {programYears(program).map((y) => {
        const on = y.year === highlightYear;
        return (
          <View
            key={y.year}
            style={{ flexDirection: "row", paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm, backgroundColor: on ? colors.primarySoft : "transparent" }}
          >
            <Text size="sm" weight={on ? "semibold" : "regular"} tone={on ? "primarySoftText" : "textMuted"} style={{ flex: 0.6, fontVariant: ["tabular-nums"] }}>
              {y.year}
            </Text>
            <Text size="sm" tone={on ? "primarySoftText" : "textMuted"} style={{ flex: 1, textAlign: "right", fontVariant: ["tabular-nums"] }}>
              {y.minScore ? formatScore(y.minScore) : "–"}
            </Text>
            <Text size="sm" weight={on ? "bold" : "medium"} tone={on ? "primarySoftText" : "text"} style={{ flex: 1, textAlign: "right", fontVariant: ["tabular-nums"] }}>
              {y.rank ? formatRank(y.rank) : "–"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Program kartı (keşfet listesi ve tercih listesi): ad, üniversite, ayrıntılar, kontenjan, sıra karşılaştırması,
 * yıllar ve uyarılar. `leading` sol üstte (tercih sırası), `actions` altta.
 */
export function ProgramCard({
  program: p,
  myRank,
  resultYear,
  warnings = [],
  leading,
  actions,
  withEducationType = true,
}: {
  program: ProgramSummary;
  /** Öğrencinin programın puan türündeki yerleştirme sırası */
  myRank: number | undefined;
  resultYear: number | null;
  warnings?: PreferenceWarning[];
  leading?: ReactNode;
  actions?: ReactNode;
  withEducationType?: boolean;
}) {
  const { colors } = useTheme();
  const cmp = rankComparison(myRank, p, resultYear);
  const refYear = myRank ? (comparisonYear(p, resultYear)?.year ?? null) : null;
  return (
    <Card style={{ gap: spacing[3], padding: spacing[4] }}>
      <View style={{ flexDirection: "row", gap: spacing[3], alignItems: "flex-start" }}>
        {leading}
        <View style={{ flex: 1, gap: 2 }}>
          <Text weight="semibold">{p.name}</Text>
          <Text size="sm" tone="textMuted">
            {p.universityName}
          </Text>
          <Text size="xs" tone="textSubtle">
            {programMetaLine(p, withEducationType)}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4], flexWrap: "wrap" }}>
        <Text size="sm" style={{ fontVariant: ["tabular-nums"] }}>
          <Text size="sm" tone="textMuted">
            Kontenjan{" "}
          </Text>
          {p.quota ?? "–"}
        </Text>
        {cmp && (
          <Badge tone={cmp.tone}>
            {cmp.label}
            {cmp.year ? ` (${cmp.year})` : ""}
          </Badge>
        )}
      </View>
      <ProgramYears program={p} highlightYear={refYear} />
      {warnings.map((w) => (
        <View
          key={w.text}
          style={{
            flexDirection: "row",
            gap: spacing[2],
            alignItems: "flex-start",
            borderRadius: radius.md,
            padding: spacing[3],
            backgroundColor: w.tone === "danger" ? colors.dangerSoft : colors.warningSoft,
          }}
        >
          <TriangleAlert size={16} color={w.tone === "danger" ? colors.danger : colors.warning} style={{ marginTop: 2 }} />
          <Text size="sm" tone={w.tone} style={{ flex: 1 }}>
            {w.text}
          </Text>
        </View>
      ))}
      {actions}
    </Card>
  );
}
