"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface MultiSelectOption {
  value: number;
  label: string;
}

/** Aranabilir çoklu seçim: açılır listede yazarak süzülür, seçilenler altında çip olarak görünür. */
export function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Tümü",
}: {
  label: string;
  options: MultiSelectOption[];
  value: number[];
  onChange: (value: number[]) => void;
  placeholder?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    const list = q ? options.filter((o) => o.label.toLocaleLowerCase("tr-TR").includes(q)) : options;
    return list.slice(0, 100);
  }, [options, query]);
  const selected = options.filter((o) => value.includes(o.value));
  const toggle = (v: number) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div ref={rootRef} className="relative flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-medium text-text-muted">
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label`}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 text-left text-sm"
      >
        <span className={cn("truncate", !selected.length && "text-text-subtle")}>
          {selected.length ? `${selected.length} seçili` : placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-text-muted" aria-hidden />
      </button>
      {open && (
        <div className="absolute top-full z-20 mt-1 flex w-full min-w-64 flex-col rounded-md border border-border bg-surface shadow-raised">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            placeholder="Ara…"
            aria-label={`${label} ara`}
            className="h-10 border-b border-border bg-transparent px-3 text-sm outline-none"
          />
          <ul role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto py-1">
            {filtered.map((o) => {
              const on = value.includes(o.value);
              return (
                <li key={o.value} role="option" aria-selected={on}>
                  <button
                    type="button"
                    onClick={() => toggle(o.value)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-muted"
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                        on ? "border-primary bg-primary text-on-primary" : "border-border-strong",
                      )}
                    >
                      {on && <Check className="size-3" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">{o.label}</span>
                  </button>
                </li>
              );
            })}
            {!filtered.length && <li className="px-3 py-2 text-sm text-text-muted">Sonuç yok</li>}
          </ul>
        </div>
      )}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-soft-text"
              aria-label={`${o.label} seçimini kaldır`}
            >
              <span className="truncate">{o.label}</span>
              <X className="size-3 shrink-0" aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
