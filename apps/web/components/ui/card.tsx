import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ interactive, className, ...props }: CardProps) {
  // cn sınıfları birleştirmez (tailwind-merge yok); "p-0" verilince varsayılan iç boşluk hiç eklenmez.
  const flush = /(^|\s)p-0(\s|$)/.test(className ?? "");
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface shadow-card",
        !flush && "p-5",
        interactive &&
          "transition-[box-shadow,transform] duration-fast ease-calm hover:-translate-y-px hover:shadow-raised",
        className,
      )}
      {...props}
    />
  );
}
