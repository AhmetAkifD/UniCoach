import { View } from "react-native";
import { spacing } from "@unicoach/design";
import {
  calculateNet,
  formatNet,
  formatRank,
  formatScore,
  placementCode,
  RESULT_SCORE_CODES,
  RESULT_SCORE_LABELS,
  RESULT_SESSIONS,
  type YksScore,
  type YksTest,
} from "@unicoach/shared";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/lib/theme";

interface ResultData {
  diplomaGrade: number | null;
  obp: number | null;
  scores: YksScore[];
  tests: YksTest[];
}

const show = (value: number | null, format: (v: number) => string) => (value === null ? "–" : format(value));
const decimal = (v: number) => v.toLocaleString("tr-TR", { maximumFractionDigits: 3 });

/**
 * Sonucun puanları, sıraları, OBP ve netleri (web'deki ResultSummary). Telefonda tablo yerine her puan türü bir
 * satır kartıdır: solda yerleştirme puanı ve sırası (tercihte kullanılan), altında ham ve ek puanlı değerler.
 */
export function ResultSummary({ result }: { result: ResultData }) {
  const { colors } = useTheme();
  const sessions = RESULT_SESSIONS.map((session) => {
    const tests = result.tests.filter((t) => t.session === session && t.correct + t.wrong > 0);
    return { session, tests, net: tests.reduce((n, t) => n + calculateNet(t, "TYT"), 0) };
  }).filter((s) => s.tests.length);

  return (
    <View style={{ gap: spacing[3] }}>
      <Card flush>
        {result.scores.map((s, i) => (
          <View key={s.type} style={{ padding: spacing[4], gap: 6, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
            <Text weight="medium">
              {RESULT_SCORE_LABELS[s.type]}{" "}
              <Text size="sm" tone="textMuted">
                ({RESULT_SCORE_CODES[s.type]} / {placementCode(s.type)})
              </Text>
            </Text>
            <View style={{ flexDirection: "row", gap: spacing[6] }}>
              <Value label="Yerleştirme puanı" value={show(s.placementScore, formatScore)} strong />
              <Value label="Yerleştirme sırası" value={show(s.placementRank, formatRank)} strong />
            </View>
            {(s.score !== null || s.rank !== null) && (
              <Text size="xs" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
                Ham puan {show(s.score, formatScore)} · sıra {show(s.rank, formatRank)}
              </Text>
            )}
            {s.bonusScore !== null && (
              <Text size="xs" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
                Ek puanlı {show(s.bonusScore, formatScore)} · sıra {show(s.bonusRank, formatRank)}
              </Text>
            )}
          </View>
        ))}
      </Card>
      <Text size="xs" tone="textSubtle">
        Tercihte yerleştirme puanın (OBP eklenmiş) ve onun başarı sırası kullanılır.
      </Text>

      <Card style={{ flexDirection: "row", gap: spacing[8] }}>
        <Value label="OBP" value={show(result.obp, decimal)} strong />
        <Value label="Diploma notu" value={show(result.diplomaGrade, decimal)} />
      </Card>

      {sessions.length > 0 && (
        <Card flush>
          {sessions.map(({ session, tests, net }) => (
            <View key={session}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing[4], paddingVertical: spacing[2], backgroundColor: colors.surfaceMuted }}>
                <Text weight="semibold">{session}</Text>
                <Text weight="semibold" style={{ fontVariant: ["tabular-nums"] }}>
                  {formatNet(net)} net
                </Text>
              </View>
              {tests.map((t) => (
                <View key={t.name} style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: colors.border }}>
                  <Text size="sm" style={{ flex: 1 }} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Text size="sm" tone="success" style={{ width: 32, textAlign: "right", fontVariant: ["tabular-nums"] }}>
                    {t.correct}
                  </Text>
                  <Text size="sm" tone="danger" style={{ width: 32, textAlign: "right", fontVariant: ["tabular-nums"] }}>
                    {t.wrong}
                  </Text>
                  <Text size="sm" weight="medium" style={{ width: 52, textAlign: "right", fontVariant: ["tabular-nums"] }}>
                    {formatNet(calculateNet(t, "TYT"))}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function Value({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <Text size="xs" tone="textMuted">
        {label}
      </Text>
      <Text size={strong ? "xl" : "lg"} weight={strong ? "bold" : "semibold"} style={{ fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
    </View>
  );
}
