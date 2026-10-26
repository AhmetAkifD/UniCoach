"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, CircleAlert } from "lucide-react";
import {
  ApiError,
  buildResultInput as build,
  calculateNet,
  formatNet,
  placementCode,
  RESULT_RANK_FIELDS,
  RESULT_SCORE_CODES,
  RESULT_SCORE_LABELS,
  RESULT_SCORE_TYPES,
  RESULT_SESSIONS,
  resultFormHasExtras,
  resultFormTests,
  toResultFormState as toState,
  YKS_FIRST_YEAR,
  type ResultFormErrors as Errors,
  type ResultScoreField,
  type ResultScoreType,
  type YksResult,
} from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDialog } from "@/components/ui/use-dialog";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";

type ScoreField = ResultScoreField;
const RANK_FIELDS = RESULT_RANK_FIELDS;

/** Satır adı ve yanında belgedeki satır adı: "Sayısal (Y-SAY)" */
function RowLabel({ label, code }: { label: string; code: string }) {
  return (
    <span className="pt-2.5 text-sm font-medium">
      {label === code ? label : <>{label} <span className="font-normal text-text-muted">({code})</span></>}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  inputMode = "decimal",
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  inputMode?: "decimal" | "numeric";
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <input
        aria-label={label}
        aria-invalid={error ? true : undefined}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 w-full min-w-0 rounded-md border bg-surface px-3 text-right text-base text-text tabular-nums placeholder:text-text-subtle",
          "transition-colors duration-fast focus-visible:border-primary",
          error ? "border-danger" : "border-border-strong",
        )}
      />
      {error?.trim() && <span className="text-right text-xs text-danger">{error}</span>}
    </div>
  );
}

/**
 * Sonucu elle girme ve düzenleme. Zorunlu olan yalnızca yerleştirme puanı ve başarı sırasıdır;
 * belgede olan diğer bilgiler (ham puan, ek puanlı, OBP, diploma notu, netler) "Diğer bilgiler"de isteğe bağlıdır.
 */
export function ResultForm({
  result,
  savedYears,
  onDone,
}: {
  /** Verilirse düzenleme: yıl değişmez. */
  result?: YksResult;
  savedYears: number[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const { confirm, dialog } = useDialog();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(result?.year ?? currentYear));
  const [state, setState] = useState(() => toState(result));
  const [errors, setErrors] = useState<Errors>({});
  const [open, setOpen] = useState(() => resultFormHasExtras(toState(result)));
  const [pending, startTransition] = useTransition();

  // Belgeden gelen ama listede olmayan test adları da düzenlenebilsin.
  const testList = useMemo(() => resultFormTests(result), [result]);
  const initialPayload = useMemo(() => JSON.stringify(build(toState(result), testList).payload), [result, testList]);

  const setScore = (type: ResultScoreType, field: ScoreField, value: string) =>
    setState((s) => ({ ...s, scores: { ...s.scores, [type]: { ...s.scores[type], [field]: value } } }));
  const setTest = (name: string, field: "correct" | "wrong", value: string) =>
    setState((s) => ({
      ...s,
      tests: { ...s.tests, [name]: { ...(s.tests[name] ?? { correct: "", wrong: "" }), [field]: value.replace(/\D/g, "").slice(0, 2) } },
    }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const { errors: found, payload } = build(state, testList);
    setErrors(found);
    if (Object.keys(found).length) {
      if (Object.keys(found).some((k) => k === "obp" || k === "diplomaGrade" || k.startsWith("test.") || /\.(score|rank|bonus)/.test(k))) {
        setOpen(true);
      }
      return;
    }
    const y = Number(year);
    if (
      !result &&
      savedYears.includes(y) &&
      !(await confirm({
        title: `${y} sonucu zaten kayıtlı`,
        message: "Kayıtlı sonucun girdiğin değerlerle değiştirilecek.",
        confirmLabel: "Değiştir",
      }))
    ) {
      return;
    }
    // Belgeden okunan sonuç değiştirilmeden kaydedilirse kaynağı korunur.
    const source = result && JSON.stringify(payload) === initialPayload ? result.source : "manual";
    startTransition(async () => {
      try {
        await browserApi.results.save(y, { source, ...payload });
        router.refresh();
        onDone?.();
        if (!result) {
          setState(toState());
          setErrors({});
        }
      } catch (err) {
        setErrors({
          form: err instanceof ApiError ? (err.errors?.scores ?? err.errors?.tests ?? err.message) : "Sonuç kaydedilemedi.",
        });
      }
    });
  }

  const years = Array.from({ length: currentYear - YKS_FIRST_YEAR + 1 }, (_, i) => currentYear - i);

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
      {dialog}
      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold">Yerleştirme puanların</h3>
            <p className="text-sm text-text-muted">
              Zorunlu olan yalnızca bunlar. Girmediğin puan türlerini boş bırak.
            </p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-muted">Sınav yılı</span>
            <select
              value={year}
              disabled={Boolean(result)}
              onChange={(e) => setYear(e.target.value)}
              className="h-10 rounded-md border border-border-strong bg-surface px-3 text-base text-text tabular-nums disabled:opacity-60"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_minmax(0,1fr)] items-start gap-x-3 gap-y-2 sm:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)]">
          <span />
          <span className="text-right text-xs font-medium text-text-muted">Yerleştirme puanı</span>
          <span className="text-right text-xs font-medium text-text-muted">Başarı sırası</span>
          {RESULT_SCORE_TYPES.map((type) => (
            <div key={type} className="contents">
              <RowLabel label={RESULT_SCORE_LABELS[type]} code={placementCode(type)} />
              <Field
                label={`${RESULT_SCORE_LABELS[type]} yerleştirme puanı`}
                value={state.scores[type].placementScore}
                onChange={(v) => setScore(type, "placementScore", v)}
                error={errors[`${type}.placementScore`]}
              />
              <Field
                label={`${RESULT_SCORE_LABELS[type]} yerleştirme başarı sırası`}
                value={state.scores[type].placementRank}
                onChange={(v) => setScore(type, "placementRank", v)}
                error={errors[`${type}.placementRank`]}
                inputMode="numeric"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-text-subtle">
          Yerleştirme puanı OBP eklenmiş puandır; sonuç belgende "Yerleştirme" sütunundaki Y- ile başlayan satırlardadır (Y-TYT, Y-SAY…). Puanı virgülle yazabilirsin
          (388,27039), sıradaki noktalar isteğe bağlı (224.527).
        </p>
      </Card>

      <Card className="flex flex-col p-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center justify-between gap-3 rounded-lg p-5 text-left"
        >
          <span className="flex flex-col gap-1">
            <span className="font-semibold">Diğer bilgiler</span>
            <span className="text-sm text-text-muted">İsteğe bağlı: ham puanlar, ek puanlı yerleştirme, OBP ve netler.</span>
          </span>
          <ChevronDown className={cn("size-5 shrink-0 text-text-muted transition-transform", open && "rotate-180")} aria-hidden />
        </button>
        {open && (
          <div className="flex flex-col gap-6 px-5 pb-5">
            <div className="overflow-x-auto">
              <div className="grid min-w-[36rem] grid-cols-[9rem_repeat(4,minmax(0,1fr))] items-start gap-x-3 gap-y-2">
                <span />
                <span className="text-right text-xs font-medium text-text-muted">Puan</span>
                <span className="text-right text-xs font-medium text-text-muted">Başarı sırası</span>
                <span className="text-right text-xs font-medium text-text-muted">Ek puanlı puan</span>
                <span className="text-right text-xs font-medium text-text-muted">Ek puanlı sıra</span>
                {RESULT_SCORE_TYPES.map((type) => (
                  <div key={type} className="contents">
                    <RowLabel label={RESULT_SCORE_LABELS[type]} code={RESULT_SCORE_CODES[type]} />
                    {(["score", "rank", "bonusScore", "bonusRank"] as const).map((f) => (
                      <Field
                        key={f}
                        label={`${RESULT_SCORE_LABELS[type]} ${{ score: "puanı", rank: "başarı sırası", bonusScore: "ek puanlı puanı", bonusRank: "ek puanlı başarı sırası" }[f]}`}
                        value={state.scores[type][f]}
                        onChange={(v) => setScore(type, f, v)}
                        error={errors[`${type}.${f}`]}
                        inputMode={RANK_FIELDS.has(f) ? "numeric" : "decimal"}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-text-subtle">
                Ham puan OBP'siz puandır; belgede soldaki "Sınav puanları" sütununda (TYT, SAY…) yazar. Ek puanlı yerleştirme yalnızca mesleki eğitim alanından gelenler içindir.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">OBP</span>
                <Field label="OBP" value={state.obp} onChange={(v) => setState((s) => ({ ...s, obp: v }))} error={errors.obp} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Diploma notu</span>
                <Field
                  label="Diploma notu"
                  value={state.diplomaGrade}
                  onChange={(v) => setState((s) => ({ ...s, diplomaGrade: v }))}
                  error={errors.diplomaGrade}
                />
              </label>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {RESULT_SESSIONS.map((session) => {
                const list = testList.filter((t) => t.session === session);
                return (
                  <div key={session} className="flex flex-col gap-2">
                    <h4 className="text-sm font-semibold">{session} doğru ve yanlış sayıların</h4>
                    <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_3.5rem] items-start gap-x-2 gap-y-1.5">
                      <span />
                      <span className="text-right text-xs font-medium text-text-muted">Doğru</span>
                      <span className="text-right text-xs font-medium text-text-muted">Yanlış</span>
                      <span className="text-right text-xs font-medium text-text-muted">Net</span>
                      {list.map((t) => {
                        const input = state.tests[t.name] ?? { correct: "", wrong: "" };
                        const correct = Number(input.correct || 0);
                        const wrong = Number(input.wrong || 0);
                        const error = errors[`test.${t.name}`];
                        return (
                          <div key={t.name} className="contents">
                            <span className="flex flex-col pt-2 text-sm">
                              {t.name}
                              {error && <span className="text-xs text-danger">{error}</span>}
                            </span>
                            <Field
                              label={`${t.name} doğru`}
                              value={input.correct}
                              onChange={(v) => setTest(t.name, "correct", v)}
                              inputMode="numeric"
                              error={error ? " " : undefined}
                            />
                            <Field
                              label={`${t.name} yanlış`}
                              value={input.wrong}
                              onChange={(v) => setTest(t.name, "wrong", v)}
                              inputMode="numeric"
                              error={error ? " " : undefined}
                            />
                            <span className="pt-2 text-right text-sm font-medium tabular-nums text-text-muted">
                              {correct + wrong ? formatNet(calculateNet({ correct, wrong }, "TYT")) : "–"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {errors.form && (
        <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-3 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errors.form}
        </div>
      )}
      {Object.keys(errors).some((k) => k !== "form") && (
        <p role="alert" className="text-sm text-danger">
          İşaretli alanları düzelt.
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Vazgeç
          </Button>
        )}
        <Button type="submit" loading={pending}>
          {result ? "Değişiklikleri kaydet" : "Sonucu kaydet"}
        </Button>
      </div>
    </form>
  );
}
