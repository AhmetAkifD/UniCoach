import Link from "next/link";
import type { SubjectExam } from "@unicoach/shared";
import { cn } from "@/lib/cn";

export interface FilterOption {
  /** null = "Tümü" */
  value: string | null;
  label: string;
  count: number;
  href: string;
}

/** Konu Anlatımı ve Soru Bankası filtreleri: 1. satır sınav, 2. satır ders. Seçim URL'de tutulur (?sinav=…&ders=…). */
export function LibraryFilters({
  exams,
  dersler,
  exam,
  ders,
}: {
  exams: FilterOption[];
  dersler: FilterOption[];
  exam: SubjectExam | null;
  ders: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ChipRow label="Sınav" options={exams} selected={exam?.toLowerCase() ?? null} />
      <ChipRow label="Ders" options={dersler} selected={ders} />
    </div>
  );
}

function ChipRow({ label, options, selected }: { label: string; options: FilterOption[]; selected: string | null }) {
  return (
    <nav aria-label={`${label} filtresi`} className="flex items-start gap-2">
      <span className="w-12 shrink-0 pt-1.5 text-sm text-text-muted">{label}</span>
      {/* Çipler alt satıra geçince etiketin altına değil, kendi sütunlarına sarılır. */}
      <div className="flex flex-1 flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Link
            key={option.value ?? "tumu"}
            href={option.href}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors duration-fast",
              active
                ? "border-primary bg-primary-soft text-primary-soft-text"
                : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text",
            )}
          >
            {option.label}
            <span className={cn("text-xs tabular-nums", active ? "opacity-80" : "text-text-subtle")}>
              {option.count}
            </span>
          </Link>
        );
      })}
      </div>
    </nav>
  );
}
