"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import type { YksResult } from "@unicoach/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/exam-format";
import { DeleteResultButton } from "./delete-result-button";
import { ResultForm } from "./result-form";
import { ResultSummary } from "./result-summary";

/** Kayıtlı bir yılın sonucu; "Düzenle" ile aynı yerde forma döner. */
export function SavedResult({ result, savedYears }: { result: YksResult; savedYears: number[] }) {
  const [editing, setEditing] = useState(false);
  return (
    <section className="flex flex-col gap-4" aria-labelledby={`result-${result.year}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id={`result-${result.year}`} className="text-xl font-semibold tracking-tight">
            {result.year} YKS sonucun
          </h2>
          <Badge tone={result.source === "document" ? "success" : "neutral"}>
            {result.source === "document" ? "Belgeden okundu" : "Elle girildi"}
          </Badge>
          <span className="text-xs text-text-muted">Güncellendi: {formatDate(result.updatedAt)}</span>
        </div>
        {!editing && (
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-4" aria-hidden /> Düzenle
            </Button>
            <DeleteResultButton year={result.year} />
          </div>
        )}
      </div>
      {editing ? (
        <ResultForm result={result} savedYears={savedYears} onDone={() => setEditing(false)} />
      ) : (
        <ResultSummary result={result} />
      )}
    </section>
  );
}
