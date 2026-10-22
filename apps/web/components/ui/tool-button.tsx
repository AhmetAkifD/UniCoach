import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Araç çubuğunda ilişkili düğmeleri ince bir çizgiyle ayırır. */
export function ToolGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 border-l border-border px-1.5 first:border-l-0 first:pl-0 last:pr-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Yalnızca ikonlu araç düğmesi; etiketi ipucu ve ekran okuyucu adı olur. `active` seçili aracı gösterir. */
export function ToolButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md text-text-muted transition-colors duration-fast",
        "hover:bg-surface-muted hover:text-text disabled:pointer-events-none disabled:opacity-40",
        active && "bg-primary-soft text-primary-soft-text",
      )}
    >
      {children}
    </button>
  );
}
