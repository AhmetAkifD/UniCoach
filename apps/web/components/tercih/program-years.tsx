import { formatRank, formatScore, programYears, type ProgramSummary } from "@unicoach/shared";
import { cn } from "@/lib/cn";

/**
 * Programın yıllara göre taban puanı ve başarı sırası (en yeni önce). Karşılaştırmada kullanılan yıl
 * (öğrencinin sonuç yılına en yakın olan) vurgulanır.
 */
export function ProgramYears({ program, highlightYear }: { program: ProgramSummary; highlightYear: number | null }) {
  return (
    <table className="text-sm tabular-nums">
      <thead className="sr-only">
        <tr>
          <th>Yıl</th>
          <th>Taban puan</th>
          <th>Başarı sırası</th>
        </tr>
      </thead>
      <tbody>
        {programYears(program).map((y) => {
          const on = y.year === highlightYear;
          return (
            <tr key={y.year} className={cn(on ? "bg-primary-soft text-primary-soft-text" : "text-text-muted")}>
              <td className={cn("rounded-l-sm py-0.5 pl-2 pr-3", on && "font-semibold")}>{y.year}</td>
              <td className="py-0.5 pr-3 text-right">{y.minScore ? formatScore(y.minScore) : "–"}</td>
              <td className={cn("rounded-r-sm py-0.5 pr-2 text-right", on ? "font-bold" : "font-medium text-text")}>
                {y.rank ? formatRank(y.rank) : "–"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
