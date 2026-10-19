import type { ReactNode } from "react";
import { Card } from "./card";

export interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
}

export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm font-medium text-text-muted">
        {label}
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      <div className="text-4xl font-bold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="text-sm text-text-muted">{hint}</div>}
    </Card>
  );
}
