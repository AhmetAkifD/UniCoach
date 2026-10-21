"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CircleAlert, Loader2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { ApiError, examNet, formatNet, type ExamDetail, type ExamQuestion } from "@unicoach/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { useDialog } from "@/components/ui/use-dialog";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDate, formatMinutes } from "@/lib/exam-format";
import { QuestionImage, usePdf } from "./question-image";

type Filter = "all" | "wrong" | "blank" | "correct";
type Outcome = "correct" | "wrong" | "blank";

const outcomeOf = (q: ExamQuestion): Outcome => (!q.answer ? "blank" : q.answer === q.correctAnswer ? "correct" : "wrong");

const OUTCOME_LABEL: Record<Outcome, string> = { correct: "Doğru", wrong: "Yanlış", blank: "Boş" };
const OUTCOME_TONE = { correct: "success", wrong: "danger", blank: "neutral" } as const;

/** Sonuç: net, doğru/yanlış/boş, test bazında döküm ve soruların gözden geçirilmesi. */
export function ExamResult({ exam }: { exam: ExamDetail }) {
  const router = useRouter();
  const { doc, error: pdfError, retry } = usePdf(exam.bookId);
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useDialog();

  // Düzenleyiciden dönüldüyse kaynaktaki düzeltmeler sonuca işlenir (doğru cevap değiştiyse net yeniden hesaplanır).
  const returning = useSearchParams().get("devam") === "1";
  useEffect(() => {
    if (!returning) return;
    void browserApi.exams
      .sync(exam.id)
      .catch(() => undefined)
      .then(() => window.location.replace(`/sinavlar/${exam.id}`));
  }, [returning, exam.id]);

  const sections = useMemo(() => {
    const names = [...new Set(exam.questions.map((q) => q.section))];
    return names.map((name) => {
      const list = exam.questions.filter((q) => q.section === name);
      const correct = list.filter((q) => outcomeOf(q) === "correct").length;
      const wrong = list.filter((q) => outcomeOf(q) === "wrong").length;
      return { name, count: list.length, correct, wrong, blank: list.length - correct - wrong, net: examNet(correct, wrong, exam.track) };
    });
  }, [exam]);

  const counts = { all: exam.questions.length, wrong: exam.wrong ?? 0, blank: exam.blank ?? 0, correct: exam.correct ?? 0 };
  const shown = exam.questions.filter((q) => filter === "all" || outcomeOf(q) === filter);
  // Duraklatılarak geçen süre harcanan süreye sayılmaz.
  const used = Date.parse(exam.finishedAt!) - Date.parse(exam.startedAt) - exam.pausedSec * 1000;

  function retake() {
    setError(null);
    startTransition(async () => {
      try {
        const next = await browserApi.exams.create({
          bookId: exam.bookId,
          sections: sections.map((s) => s.name),
          durationMin: exam.durationSec === null ? null : Math.round(exam.durationSec / 60),
        });
        router.push(`/sinavlar/${next.id}`);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Sınav başlatılamadı.");
      }
    });
  }

  async function remove() {
    if (!(await confirm({ title: "Sınavı sil", message: "Bu sınav ve sonucu silinsin mi?", confirmLabel: "Sil", danger: true }))) return;
    startTransition(async () => {
      await browserApi.exams.remove(exam.id);
      router.push("/sinavlar");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {dialog}
      <Link href="/sinavlar" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Geçmiş Sınavlar
      </Link>

      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{exam.title}</h1>
          <p className="text-sm text-text-muted">
            {exam.bookTitle} · {formatDate(exam.startedAt)} · {formatMinutes(used)}
            {exam.durationSec !== null && ` / ${formatMinutes((exam.durationSec + exam.extraSec) * 1000)}`}
            {exam.extraSec > 0 && ` (${formatMinutes(exam.extraSec * 1000)} ek süre)`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={retake} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
            Tekrar çöz
          </Button>
          <Button variant="ghost" onClick={() => void remove()} disabled={pending}>
            <Trash2 className="size-4" aria-hidden /> Sil
          </Button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-3 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <section aria-label="Sonuç" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Net" value={formatNet(exam.net ?? 0)} hint={`${exam.questionCount} sorudan`} />
        <StatCard label="Doğru" value={<span className="text-success">{exam.correct}</span>} />
        <StatCard
          label="Yanlış"
          value={<span className="text-danger">{exam.wrong}</span>}
          hint={exam.track === "LGS" ? "3 yanlış 1 doğruyu götürür" : "4 yanlış 1 doğruyu götürür"}
        />
        <StatCard label="Boş" value={exam.blank} />
      </section>

      {sections.length > 1 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-text-muted">
              <tr className="border-b border-border">
                <th className="px-5 py-3 font-medium">Test</th>
                <th className="px-3 py-3 text-right font-medium">Doğru</th>
                <th className="px-3 py-3 text-right font-medium">Yanlış</th>
                <th className="px-3 py-3 text-right font-medium">Boş</th>
                <th className="px-5 py-3 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {sections.map((s) => (
                <tr key={s.name} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-medium">{s.name}</td>
                  <td className="px-3 py-3 text-right text-success">{s.correct}</td>
                  <td className="px-3 py-3 text-right text-danger">{s.wrong}</td>
                  <td className="px-3 py-3 text-right text-text-muted">{s.blank}</td>
                  <td className="px-5 py-3 text-right font-semibold">{formatNet(s.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <section className="flex flex-col gap-4" aria-labelledby="review-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="review-title" className="text-xl font-semibold tracking-tight">
            Soruları gözden geçir
          </h2>
          <nav aria-label="Sonuç filtresi" className="flex flex-wrap gap-2">
            {(["all", "wrong", "blank", "correct"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-current={filter === f ? "true" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors duration-fast",
                  filter === f
                    ? "border-primary bg-primary-soft text-primary-soft-text"
                    : "border-border bg-surface text-text-muted hover:border-border-strong hover:text-text",
                )}
              >
                {{ all: "Tümü", wrong: "Yanlışlar", blank: "Boşlar", correct: "Doğrular" }[f]}
                <span className="text-xs tabular-nums opacity-80">{counts[f]}</span>
              </button>
            ))}
          </nav>
        </div>

        {pdfError && (
          <Card className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="font-medium">Sorular görüntülenemedi.</p>
            <Button variant="secondary" onClick={retry}>
              Tekrar dene
            </Button>
          </Card>
        )}
        {!shown.length && <p className="text-sm text-text-muted">Bu filtrede soru yok.</p>}

        <div className="grid gap-4 xl:grid-cols-2">
          {shown.map((q) => {
            const outcome = outcomeOf(q);
            return (
              <Card key={q.id} className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums">{q.position + 1}. soru</span>
                    {sections.length > 1 && <span className="text-sm text-text-muted">{q.section}</span>}
                    <Badge tone={OUTCOME_TONE[outcome]}>{OUTCOME_LABEL[outcome]}</Badge>
                  </div>
                  {q.bookQuestionId && (
                    <Link
                      href={`/soru-bankasi/${exam.bookId}/sorular?soru=${q.bookQuestionId}&sinav=${exam.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-primary"
                      title="Kutu ya da cevap yanlışsa Soru Bankası'nda düzelt"
                    >
                      <Pencil className="size-3.5" aria-hidden /> Kaynağında düzenle
                    </Link>
                  )}
                </div>
                <QuestionImage doc={doc} q={q} lazy />
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="text-text-muted">
                    Senin cevabın:{" "}
                    <strong className={cn(outcome === "correct" ? "text-success" : outcome === "wrong" ? "text-danger" : "text-text")}>
                      {q.answer ?? "Boş"}
                    </strong>
                  </span>
                  <span className="text-text-muted">
                    Doğru cevap: <strong className="text-success">{q.correctAnswer}</strong>
                  </span>
                </p>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
