import { cn } from "@/lib/cn";

export interface ProgressBarProps {
  /** 0-100 */
  value: number;
  label?: string;
  /** Dolgu rengi; varsayılan birincil renk. Ders rengi için ör. "#6366F1". */
  color?: string;
  showValue?: boolean;
  className?: string;
}

export function ProgressBar({ value, label, color, showValue = true, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-base ease-calm"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      {showValue && <span className="w-10 text-right text-sm font-medium tabular-nums text-text-muted">%{pct}</span>}
    </div>
  );
}
