"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  options: SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
  disabled?: boolean;
}

/** Birkaç seçenekten birini seçtiren düğme grubu (ör. YKS / LGS). Ekran okuyucuda radyo grubu olarak okunur. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  disabled,
}: SegmentedControlProps<T>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-medium text-text-muted">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "grid gap-1 rounded-md border bg-surface-muted p-1",
          error ? "border-danger" : "border-border",
        )}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex min-h-9 flex-col items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium transition-colors duration-fast",
                selected ? "bg-surface text-text shadow-card" : "text-text-muted hover:text-text",
              )}
            >
              {option.label}
              {option.hint && <span className="text-xs font-normal text-text-subtle">{option.hint}</span>}
            </button>
          );
        })}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
