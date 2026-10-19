import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ interactive, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface p-5 shadow-card",
        interactive &&
          "transition-[box-shadow,transform] duration-fast ease-calm hover:-translate-y-px hover:shadow-raised",
        className,
      )}
      {...props}
    />
  );
}
