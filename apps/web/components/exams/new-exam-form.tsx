"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Loader2, Play } from "lucide-react";
import {
  ApiError,
  EXAM_MAX_MINUTES,
  findSubject,
  suggestedMinutes,
  type BookQuestion,
  type BookSummary,
  type ExamTrack,
} from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { subjectColor } from "@/lib/subject-color";

/** Yeni sınav: PDF → testler → süre. Yalnızca cevabı girilmiş sorular sınava girer. */
export function NewExamForm({
  books,
  initialBookId,
  examTrack,
}: {
  books: BookSummary[];
  initialBookId?: string;
  examTrack: ExamTrack | null;
}) {
  const router = useRouter();
  const [bookId, setBookId] = useState(
    books.some((b) => b.id === initialBookId) ? initialBookId! : (books[0]?.id ?? ""),
  );
  const [questions, setQuestions] = useState<BookQuestion[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [minutes, setMinutes] = useState("");
  const [untimed, setUntimed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const book = books.find((b) => b.id === bookId);
  const track: ExamTrack = (book && findSubject(book.subject)?.track) ?? examTrack ?? "YKS";

  // PDF değişince testleri yükle; hepsi seçili gelir.
  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    setQuestions(null);
    browserApi.books
      .questions(bookId)
      .then((qs) => {
        if (cancelled) return;
        setQuestions(qs);
        setSelected(new Set(qs.filter((q) => q.answer).map((q) => q.section)));
      })
      .catch(() => !cancelled && setError("Testler yüklenemedi."));
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  const sections = useMemo(() => {
    const names = [...new Set((questions ?? []).map((q) => q.section))];
    return names.map((name) => {
      const list = questions!.filter((q) => q.section === name);
      return { name, total: list.length, answered: list.filter((q) => q.answer).length };
    });
  }, [questions]);
  const count = sections.filter((s) => selected.has(s.name)).reduce((n, s) => n + s.answered, 0);
  const suggestion = count ? suggestedMinutes(count, track) : 0;
  const minutesValue = minutes === "" ? suggestion : Number(minutes);

  function toggle(name: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!count) return setError("En az bir test seç.");
    if (!untimed && (!Number.isInteger(minutesValue) || minutesValue < 1 || minutesValue > EXAM_MAX_MINUTES)) {
      return setError(`Süre 1–${EXAM_MAX_MINUTES} dakika arasında olmalı.`);
    }
    startTransition(async () => {
      try {
        const exam = await browserApi.exams.create({
          bookId,
          sections: sections.filter((s) => selected.has(s.name) && s.answered).map((s) => s.name),
          durationMin: untimed ? null : minutesValue,
        });
        router.push(`/sinavlar/${exam.id}`);
      } catch (err) {
        setError(err instanceof ApiError ? (err.errors?.durationMin ?? err.errors?.sections ?? err.message) : "Sınav başlatılamadı.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-6">
        <Card className="flex flex-col gap-4">
          <h2 className="font-semibold">1. PDF</h2>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="PDF">
            {books.map((b) => {
              const active = b.id === bookId;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setBookId(b.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-md border p-3 text-left transition-colors duration-fast",
                    active ? "border-primary bg-primary-soft" : "border-border hover:border-border-strong",
                  )}
                >
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: subjectColor(b.subject) }} aria-hidden />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{b.title}</span>
                    <span className="text-sm text-text-muted">
                      {findSubject(b.subject)?.label ?? b.subject} · {b.questionCount} soru
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">2. Testler</h2>
            {sections.length > 1 && (
              <button
                type="button"
                className="text-sm font-medium text-primary hover:underline"
                onClick={() =>
                  setSelected(
                    selected.size === sections.filter((s) => s.answered).length
                      ? new Set()
                      : new Set(sections.filter((s) => s.answered).map((s) => s.name)),
                  )
                }
              >
                {selected.size === sections.filter((s) => s.answered).length ? "Hiçbirini seçme" : "Tümünü seç"}
              </button>
            )}
          </div>
          {!questions ? (
            <p className="flex items-center gap-2 text-sm text-text-muted" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Testler yükleniyor…
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {sections.map((s) => (
                <li key={s.name}>
                  <label className={cn("flex items-center gap-3 py-2.5", !s.answered && "opacity-50")}>
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selected.has(s.name)}
                      disabled={!s.answered}
                      onChange={() => toggle(s.name)}
                    />
                    <span className="flex-1 font-medium">{s.name}</span>
                    <span className="text-sm text-text-muted tabular-nums">
                      {s.answered === s.total ? `${s.total} soru` : `${s.answered}/${s.total} soru cevaplı`}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {sections.some((s) => s.answered < s.total) && (
            <p className="text-xs text-text-subtle">Cevabı girilmemiş sorular sınava alınmaz.</p>
          )}
        </Card>
      </div>

      <Card className="flex flex-col gap-4 lg:sticky lg:top-20">
        <h2 className="font-semibold">3. Süre</h2>
        <div className="flex items-center gap-2">
          <input
            aria-label="Süre (dakika)"
            inputMode="numeric"
            disabled={untimed}
            value={untimed ? "" : minutes === "" ? String(suggestion || "") : minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/\D/g, "").slice(0, 3))}
            className="h-11 w-24 rounded-md border border-border-strong bg-surface px-3.5 text-base text-text tabular-nums disabled:opacity-50"
          />
          <span className="text-text-muted">dakika</span>
        </div>
        <p className="text-xs text-text-subtle">
          Önerilen {suggestion || "–"} dk: {track === "LGS" ? "LGS" : "TYT"} süresine göre soru başına{" "}
          {track === "LGS" ? "~1,7" : "~1,4"} dakika.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={untimed} onChange={(e) => setUntimed(e.target.checked)} />
          Süresiz çöz
        </label>

        <div className="flex flex-col gap-1 border-t border-border pt-4 text-sm">
          <span className="text-text-muted">Sınavda</span>
          <span className="text-2xl font-bold tabular-nums">{count} soru</span>
          <span className="text-text-muted">{track === "LGS" ? "3 yanlış 1 doğruyu götürür" : "4 yanlış 1 doğruyu götürür"}</span>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-3 text-sm text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </div>
        )}
        <Button type="submit" loading={pending} disabled={!count}>
          <Play className="size-4" aria-hidden /> Sınavı başlat
        </Button>
      </Card>
    </form>
  );
}
