"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, CircleAlert, ListOrdered, Search, Trash2, TriangleAlert } from "lucide-react";
import {
  ApiError,
  PREFERENCE_MAX,
  preferenceWarnings,
  comparisonYear,
  rankComparison,
  RESULT_SCORE_CODES,
  UNIVERSITY_TYPE_LABELS,
  type PreferenceItem,
  type YksScore,
} from "@unicoach/shared";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { ProgramYears } from "./program-years";

/**
 * Tercih listesi: öncelik sırasıyla programlar. Puana ya da koşullara uymayan programlar listede kalır,
 * yalnızca altlarında uyarı görünür.
 */
export function PreferenceList({
  initialItems,
  scores,
  resultYear,
}: {
  initialItems: PreferenceItem[];
  /** En yeni sonucun puanları; sonuç yoksa null */
  scores: YksScore[] | null;
  /** Karşılaştırmada programın bu yıla en yakın yılı kullanılır. */
  resultYear: number | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(next: PreferenceItem[] | null, call: () => Promise<PreferenceItem[]>) {
    const previous = items;
    if (next) setItems(next);
    setBusy(true);
    setError(null);
    try {
      setItems(await call());
    } catch (err) {
      setItems(previous);
      setError(err instanceof ApiError ? err.message : "Liste kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    const renumbered = next.map((item, i) => ({ ...item, position: i + 1 }));
    void run(renumbered, () => browserApi.preferences.reorder(renumbered.map((i) => i.program.code)));
  }

  function remove(code: number) {
    const next = items.filter((i) => i.program.code !== code).map((item, i) => ({ ...item, position: i + 1 }));
    void run(next, () => browserApi.preferences.remove(code));
  }

  const warned = items.filter((i) => preferenceWarnings(i.program, scores, resultYear).length).length;

  if (!items.length) {
    return (
      <Card className="flex flex-col items-center gap-3 py-14 text-center">
        <ListOrdered className="size-10 text-text-subtle" strokeWidth={1.75} aria-hidden />
        <p className="text-lg font-semibold">Listen boş</p>
        <p className="max-w-md text-sm text-text-muted">
          Programları keşfet sayfasında istediğin programın yanındaki "Listeme ekle"ye bas. En fazla {PREFERENCE_MAX} tercih
          yapabilirsin.
        </p>
        <Link href="/tercih/programlar" className={buttonClasses({ className: "mt-2" })}>
          <Search className="size-5" aria-hidden /> Programları keşfet
        </Link>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-2xl font-bold tabular-nums">
            {items.length}
            <span className="text-base font-medium text-text-muted"> / {PREFERENCE_MAX} tercih</span>
          </span>
          {warned > 0 && (
            <Badge tone="warning">
              <TriangleAlert className="size-3.5" aria-hidden /> {warned} tercihte uyarı var
            </Badge>
          )}
        </div>
        {items.length < PREFERENCE_MAX && (
          <Link href="/tercih/programlar" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <Search className="size-4" aria-hidden /> Program ekle
          </Link>
        )}
      </div>

      {!scores && (
        <p className="rounded-md bg-info-soft px-3.5 py-3 text-sm text-info">
          Sonucun kayıtlı olmadığı için programlar puanınla karşılaştırılamıyor.{" "}
          <Link href="/tercih" className="font-medium underline">
            Sonucunu ekle
          </Link>
        </p>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-3 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {items.map((item, index) => {
          const p = item.program;
          const warnings = preferenceWarnings(p, scores, resultYear);
          const myRank = scores?.find((s) => s.type === p.scoreType)?.placementRank;
          const cmp = rankComparison(myRank, p, resultYear);
          const refYear = myRank ? (comparisonYear(p, resultYear)?.year ?? null) : null;
          return (
            <li key={p.code}>
              <Card className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-lg font-bold tabular-nums text-primary-soft-text"
                  aria-label={`${item.position}. tercih`}
                >
                  {item.position}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold leading-snug">{p.name}</span>
                    <span className="text-sm text-text-muted">{p.universityName}</span>
                    <span className="text-xs text-text-subtle">
                      {[p.faculty, p.cityName, UNIVERSITY_TYPE_LABELS[p.universityType], p.scholarship, RESULT_SCORE_CODES[p.scoreType], `Kod ${p.code}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm tabular-nums">
                    <span>
                      <span className="text-text-muted">Kontenjan </span>
                      {p.quota ?? "–"}
                    </span>
                    {cmp && (
                      <Badge tone={cmp.tone}>
                        {cmp.label}
                        {cmp.year && ` (${cmp.year})`}
                      </Badge>
                    )}
                  </div>
                  <ProgramYears program={p} highlightYear={refYear} />
                  {warnings.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                      {warnings.map((w) => (
                        <li
                          key={w.text}
                          className={cn(
                            "flex items-start gap-2 rounded-md px-3 py-2 text-sm",
                            w.tone === "danger" ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning",
                          )}
                        >
                          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                          {w.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex shrink-0 gap-1 sm:flex-col">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Yukarı taşı"
                    disabled={busy || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Aşağı taşı"
                    disabled={busy || index === items.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Listeden çıkar" disabled={busy} onClick={() => remove(p.code)}>
                    <Trash2 className="size-4 text-danger" aria-hidden />
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
