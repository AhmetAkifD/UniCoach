import {
  calculateNet,
  formatNet,
  formatRank,
  formatScore,
  RESULT_SCORE_LABELS,
  RESULT_SESSIONS,
  type YksScore,
  type YksTest,
} from "@unicoach/shared";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

interface ResultData {
  diplomaGrade: number | null;
  obp: number | null;
  scores: YksScore[];
  tests: YksTest[];
}

const show = (value: number | null, format: (v: number) => string) => (value === null ? "–" : format(value));

/** Sonucun puan, sıra, OBP ve net tabloları. Önizlemede ve kayıtlı sonuçlarda aynı görünür. */
export function ResultSummary({ result }: { result: ResultData }) {
  const hasBonus = result.scores.some((s) => s.bonusScore !== null);
  const sessions = RESULT_SESSIONS.map((session) => {
    const tests = result.tests.filter((t) => t.session === session && t.correct + t.wrong > 0);
    const net = tests.reduce((n, t) => n + calculateNet(t, "TYT"), 0);
    return { session, tests, net };
  }).filter((s) => s.tests.length);
  const skipped = result.tests.some((t) => t.correct + t.wrong === 0);

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-text-muted">
            <tr className="border-b border-border">
              <th className="px-5 py-3 font-medium">Puan türü</th>
              <th className="px-3 py-3 text-right font-medium">Puan</th>
              <th className="px-3 py-3 text-right font-medium">Başarı sırası</th>
              <th className="px-3 py-3 text-right font-medium text-text">Yerleştirme puanı</th>
              <th className={cn("py-3 pl-3 text-right font-medium text-text", hasBonus ? "pr-3" : "pr-5")}>
                Yerleştirme sırası
              </th>
              {hasBonus && (
                <>
                  <th className="px-3 py-3 text-right font-medium">Ek puanlı</th>
                  <th className="px-5 py-3 text-right font-medium">Ek puanlı sıra</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {result.scores.map((s) => (
              <tr key={s.type} className="border-b border-border last:border-0">
                <td className="px-5 py-3 font-medium">{RESULT_SCORE_LABELS[s.type]}</td>
                <td className="px-3 py-3 text-right text-text-muted">{show(s.score, formatScore)}</td>
                <td className="px-3 py-3 text-right text-text-muted">{show(s.rank, formatRank)}</td>
                <td className="px-3 py-3 text-right font-semibold">{show(s.placementScore, formatScore)}</td>
                <td className={cn("py-3 pl-3 text-right font-semibold", hasBonus ? "pr-3" : "pr-5")}>
                  {show(s.placementRank, formatRank)}
                </td>
                {hasBonus && (
                  <>
                    <td className="px-3 py-3 text-right">{show(s.bonusScore, formatScore)}</td>
                    <td className="px-5 py-3 text-right">{show(s.bonusRank, formatRank)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="-mt-1 text-xs text-text-subtle">
        Tercihte yerleştirme puanın (OBP eklenmiş) ve onun başarı sırası kullanılır.
      </p>

      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <Card className="flex flex-col gap-3 self-start">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-text-muted">OBP</span>
            <span className="text-3xl font-bold tabular-nums tracking-tight">
              {show(result.obp, (v) => v.toLocaleString("tr-TR", { maximumFractionDigits: 3 }))}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-text-muted">Diploma notu</span>
            <span className="text-lg font-semibold tabular-nums">
              {show(result.diplomaGrade, (v) => v.toLocaleString("tr-TR", { maximumFractionDigits: 3 }))}
            </span>
          </div>
        </Card>

        {sessions.length > 0 && (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-text-muted">
                <tr className="border-b border-border">
                  <th className="px-5 py-3 font-medium">Test</th>
                  <th className="px-3 py-3 text-right font-medium">Doğru</th>
                  <th className="px-3 py-3 text-right font-medium">Yanlış</th>
                  <th className="px-5 py-3 text-right font-medium">Net</th>
                </tr>
              </thead>
              {sessions.map(({ session, tests, net }) => (
                <tbody key={session} className="tabular-nums">
                  <tr className="border-b border-border bg-surface-muted">
                    <th colSpan={3} className="px-5 py-2 text-left font-semibold">
                      {session}
                    </th>
                    <td className="px-5 py-2 text-right font-semibold">{formatNet(net)}</td>
                  </tr>
                  {tests.map((t) => (
                    <tr key={t.name} className="border-b border-border">
                      <td className="px-5 py-2.5">{t.name}</td>
                      <td className="px-3 py-2.5 text-right text-success">{t.correct}</td>
                      <td className="px-3 py-2.5 text-right text-danger">{t.wrong}</td>
                      <td className="px-5 py-2.5 text-right font-medium">{formatNet(calculateNet(t, "TYT"))}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
            {skipped && <p className="px-5 py-3 text-xs text-text-subtle">Girmediğin testler gösterilmiyor.</p>}
          </Card>
        )}
      </div>
    </div>
  );
}
