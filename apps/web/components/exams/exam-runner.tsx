"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, CircleAlert, Clock, Flag, Loader2, Pause, Pencil, Play, Plus } from "lucide-react";
import { ApiError, CHOICE_LETTERS, type ChoiceLetter, type ExamDetail } from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDialog } from "@/components/ui/use-dialog";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/exam-format";
import { QuestionImage, usePdf } from "./question-image";

/**
 * Ekran yeterince geniş ve yüksekse sınav ekranı kaydırmasız çalışır: soru görseli kalan yüksekliğe sığacak
 * kadar küçülür. Daha kısa ekranlarda (ör. telefon, yatay küçük pencere) sayfa normal kaydırılır.
 */
const FIT_QUERY = "(min-width: 1024px) and (min-height: 640px)";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** Süre bu kadar azalınca sayaç uyarı rengine geçer. */
const WARN_MS = 5 * 60_000;

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/** Sınav ekranı: soru görseli, A–E cevap düğmeleri, soru haritası ve geri sayım. Her cevap hemen kaydedilir. */
export function ExamRunner({ exam }: { exam: ExamDetail }) {
  const router = useRouter();
  const { doc, error: pdfError, retry } = usePdf(exam.bookId);
  const [answers, setAnswers] = useState<Record<string, ChoiceLetter | null>>(() =>
    Object.fromEntries(exam.questions.map((q) => [q.id, q.answer])),
  );
  // Yarıda bırakılan sınav ilk boş sorudan başlar. Bakılan soru bu sekmede hatırlanır: kaynağında düzenleyip
  // dönünce ya da sayfa yenilenince aynı soruya dönülür (sunucu çiziminden sonra okunur, hydration bozulmasın).
  const indexKey = `uc-exam-${exam.id}-soru`;
  const [index, setIndex] = useState(() => {
    const i = exam.questions.findIndex((q) => !q.answer);
    return i < 0 ? 0 : i;
  });
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(indexKey);
      const saved = Number(raw);
      if (raw !== null && Number.isInteger(saved) && saved >= 0 && saved < exam.questions.length) setIndex(saved);
    } catch {
      // Depolama kapalı: ilk boş soru
    }
  }, [indexKey, exam.questions.length]);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const { confirm, prompt, dialog } = useDialog();
  const fit = useMediaQuery(FIT_QUERY);
  const q = exam.questions[index]!;
  const answered = useMemo(() => Object.values(answers).filter(Boolean).length, [answers]);

  // --- Geri sayım (sunucu saatine göre). Duraklatılmışken kalan süre donar. ---
  const offset = useRef(Date.parse(exam.now) - Date.now());
  const [clock, setClock] = useState({ deadline: exam.deadline, pausedAt: exam.pausedAt });
  const deadline = clock.deadline ? Date.parse(clock.deadline) : null;
  const paused = !!clock.pausedAt;
  const left = () =>
    deadline === null ? null : deadline - (clock.pausedAt ? Date.parse(clock.pausedAt) : Date.now() + offset.current);
  const [remaining, setRemaining] = useState(left);
  const [timerBusy, setTimerBusy] = useState(false);
  /** Otomatik duraklatma bu akışlarda yapılmaz: bitirme, düzenleyiciye geçiş. */
  const skipAutoPause = useRef(false);
  /** Sunucunun döndürdüğü sınav durumuyla sayacı günceller. */
  const applyClock = (next: ExamDetail) => {
    offset.current = Date.parse(next.now) - Date.now();
    setClock({ deadline: next.deadline, pausedAt: next.pausedAt });
  };
  const finish = useCallback(async () => {
    setFinishing(true);
    skipAutoPause.current = true;
    try {
      await browserApi.exams.finish(exam.id);
    } catch {
      // Süre dolunca sunucu sınavı zaten kapatır; sayfa yenilenince sonuç görünür.
    }
    router.refresh();
  }, [exam.id, router]);
  useEffect(() => {
    if (deadline === null) return;
    if (clock.pausedAt) {
      setRemaining(deadline - Date.parse(clock.pausedAt));
      return;
    }
    const tick = () => {
      const ms = deadline - Date.now() - offset.current;
      setRemaining(ms);
      if (ms <= 0) {
        clearInterval(timer);
        void finish();
      }
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [deadline, clock.pausedAt, finish]);

  async function togglePause() {
    setTimerBusy(true);
    setError(null);
    try {
      applyClock(paused ? await browserApi.exams.resume(exam.id) : await browserApi.exams.pause(exam.id));
    } catch {
      setError(paused ? "Sınav devam ettirilemedi." : "Sınav duraklatılamadı.");
    } finally {
      setTimerBusy(false);
    }
  }

  async function addTime() {
    const value = await prompt({
      title: "Süre ekle",
      message: "Kaç dakika eklensin? (1–180)",
      defaultValue: "10",
      placeholder: "Dakika",
      confirmLabel: "Ekle",
    });
    const minutes = Number(value?.replace(/\D/g, ""));
    if (!value) return;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) return setError("1 ile 180 dakika arasında bir süre gir.");
    try {
      applyClock(await browserApi.exams.extend(exam.id, { minutes }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Süre eklenemedi.");
    }
  }

  /**
   * Kaynağında düzenle: süre durdurulur, soru Soru Bankası düzenleyicisinde açılır. Dönüşte (?devam=1)
   * sınav devam ettirilir ve düzeltme sınava yansır.
   */
  async function editSource() {
    if (!q.bookQuestionId) return;
    setTimerBusy(true);
    try {
      skipAutoPause.current = true;
      if (deadline !== null && !paused) await browserApi.exams.pause(exam.id);
      router.push(`/soru-bankasi/${exam.bookId}/sorular?soru=${q.bookQuestionId}&sinav=${exam.id}`);
    } catch {
      setTimerBusy(false);
      setError("Sınav duraklatılamadı; düzenlemeye geçilmedi.");
    }
  }

  // Düzenleyiciden dönüldüyse: devam ettir (sorular kaynaktan yeniden okunur) ve sayfayı yenile.
  const searchParams = useSearchParams();
  const returning = searchParams.get("devam") === "1";

  // Sınavdan çıkınca (başka sayfaya geçiş, sekmeyi kapatma, yenileme) süre durdurulur; dönünce
  // "Sınav duraklatıldı" ekranından devam edilir. Bitirirken, düzenleyiciye geçerken ve düzenleyiciden
  // dönerken durdurulmaz (bunlar kendi akışlarında yönetilir).
  const timed = deadline !== null;
  // Yenilemede sayfa, önceki sayfanın gönderdiği duraklatma isteğinden önce çizilebilir; durum kısa süre sonra
  // sunucudan bir kez daha okunur ki ekran duraklatılmış hâli göstersin.
  useEffect(() => {
    if (!timed || returning) return;
    const timer = setTimeout(() => {
      browserApi.exams
        .get(exam.id)
        .then(applyClock)
        .catch(() => undefined);
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id]);

  const pauseState = useRef({ timed, paused, returning });
  const alive = useRef(false);
  pauseState.current = { timed, paused, returning };
  useEffect(() => {
    const pauseOnExit = () => {
      const { timed, paused, returning } = pauseState.current;
      if (!timed || paused || returning || skipAutoPause.current) return;
      skipAutoPause.current = true;
      void fetch(`/api/exams/${encodeURIComponent(exam.id)}/pause`, { method: "POST", keepalive: true }).catch(() => undefined);
    };
    window.addEventListener("pagehide", pauseOnExit);
    alive.current = true;
    return () => {
      window.removeEventListener("pagehide", pauseOnExit);
      // Geliştirmede React efekti bir kez kapatıp yeniden açar; gerçekten ayrılındıysa bir sonraki adımda durdur.
      alive.current = false;
      setTimeout(() => !alive.current && pauseOnExit(), 0);
    };
  }, [exam.id]);
  useEffect(() => {
    if (!returning) return;
    void browserApi.exams
      .resume(exam.id)
      .catch(() => undefined)
      .then(() => window.location.replace(`/sinavlar/${exam.id}`));
  }, [returning, exam.id]);

  const choose = useCallback(
    (letter: ChoiceLetter | null) => {
      const previous = answers[q.id] ?? null;
      setAnswers((a) => ({ ...a, [q.id]: letter }));
      setError(null);
      browserApi.exams.answer(exam.id, q.id, { answer: letter }).catch((err) => {
        setAnswers((a) => ({ ...a, [q.id]: previous }));
        if (err instanceof ApiError && err.status === 409) return router.refresh();
        setError("Cevap kaydedilemedi. Bağlantını kontrol edip tekrar işaretle.");
      });
    },
    [answers, q.id, exam.id, router],
  );

  /** Soruya geç; seçim bu sekmede hatırlanır (yalnızca öğrenci geçince yazılır, geri yükleme üzerine yazmaz). */
  const go = useCallback(
    (i: number) => {
      const next = Math.min(Math.max(0, i), exam.questions.length - 1);
      setIndex(next);
      try {
        sessionStorage.setItem(indexKey, String(next));
      } catch {
        // Depolama kapalıysa hatırlanmaz.
      }
    },
    [exam.questions.length, indexKey],
  );

  // Kısayollar: A–E cevap (aynı harf tekrar basılınca boşaltır), Boşluk boş bırakır, ← → soru değiştir.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey || finishing || paused || document.querySelector("dialog[open]")) return;
      const letterIndex = CHOICE_LETTERS.indexOf(e.key.toUpperCase() as ChoiceLetter);
      if (letterIndex >= 0 && letterIndex < q.choiceCount) {
        const letter = CHOICE_LETTERS[letterIndex]!;
        choose(answers[q.id] === letter ? null : letter);
      } else if (e.key === " ") {
        if (answers[q.id]) choose(null);
      } else if (e.key === "ArrowRight") go(index + 1);
      else if (e.key === "ArrowLeft") go(index - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answers, q, index, choose, go, finishing, paused]);

  async function confirmFinish() {
    const blank = exam.questions.length - answered;
    const ok = await confirm({
      title: "Sınavı bitir",
      message: `${blank ? `${blank} soru boş. ` : ""}Bitirdikten sonra cevaplar değiştirilemez.`,
      confirmLabel: "Bitir",
    });
    if (ok) void finish();
  }

  // Aynı testten birden fazla varsa soru etiketinde test adı da gösterilir.
  const multiSection = new Set(exam.questions.map((x) => x.section)).size > 1;
  const low = remaining !== null && remaining < WARN_MS;

  if (returning) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-text-muted" role="status">
        <Loader2 className="size-5 animate-spin" aria-hidden /> Sınava dönülüyor…
      </div>
    );
  }

  return (
    // Kaydırmasız düzende yükseklik: ekran − site başlığı (4rem) − sayfa boşlukları (md: 2 × 2.5rem).
    <div className={cn("flex flex-col gap-5", fit && "h-[calc(100dvh-9rem-2px)] min-h-0")}>
      {dialog}
      <div className="sticky top-16 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur md:mx-0 md:rounded-lg md:border md:bg-surface/90">
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-semibold">{exam.title}</h1>
          <span className="text-sm text-text-muted tabular-nums">
            {answered}/{exam.questions.length} cevaplandı
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {remaining !== null ? (
            <span
              role="timer"
              aria-label="Kalan süre"
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full px-4 font-semibold tabular-nums",
                paused
                  ? "bg-warning-soft text-warning"
                  : low
                    ? "bg-danger-soft text-danger"
                    : "bg-primary-soft text-primary-soft-text",
              )}
            >
              {paused ? <Pause className="size-4" aria-hidden /> : <Clock className="size-4" aria-hidden />}
              {formatClock(remaining)}
            </span>
          ) : (
            <span className="inline-flex h-10 items-center gap-2 rounded-full bg-surface-muted px-4 text-sm text-text-muted">
              <Clock className="size-4" aria-hidden /> Süresiz
            </span>
          )}
          {deadline !== null && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void togglePause()}
                disabled={timerBusy || finishing}
                aria-label={paused ? "Süreyi başlat" : "Süreyi durdur"}
                title={paused ? "Süreyi başlat" : "Süreyi durdur"}
              >
                {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
                <span className="hidden sm:inline">{paused ? "Devam" : "Duraklat"}</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void addTime()} disabled={finishing} title="Süre ekle">
                <Plus className="size-4" aria-hidden /> <span className="hidden sm:inline">Süre</span>
              </Button>
            </>
          )}
          <Button onClick={() => void confirmFinish()} loading={finishing}>
            <Flag className="size-4" aria-hidden /> Bitir
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-3 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <div className={cn("grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]", fit && "min-h-0 flex-1 items-stretch")}>
        <Card className={cn("flex flex-col gap-5 p-4 md:p-6", fit && "min-h-0")}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tabular-nums">
              {index + 1}. soru
              {multiSection && <span className="ml-2 text-sm font-normal text-text-muted">{q.section}</span>}
            </h2>
            <div className="flex items-center gap-3">
              {q.bookQuestionId && (
                <button
                  type="button"
                  onClick={() => void editSource()}
                  disabled={timerBusy}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-primary disabled:opacity-50"
                  title="Kutu ya da cevap yanlışsa düzelt; bu sırada süre durur"
                >
                  <Pencil className="size-3.5" aria-hidden /> Kaynağında düzenle
                </button>
              )}
              <span className="text-sm text-text-muted tabular-nums">
                {index + 1} / {exam.questions.length}
              </span>
            </div>
          </div>

          <div className={cn(fit && "min-h-0 flex-1")}>
          {paused ? (
            <div className="flex flex-col items-center gap-3 rounded-md bg-surface-muted py-16 text-center">
              <Pause className="size-8 text-warning" aria-hidden />
              <p className="font-semibold">Sınav duraklatıldı</p>
              <p className="text-sm text-text-muted">Süre işlemiyor. Devam edince soru yeniden görünür.</p>
              <Button onClick={() => void togglePause()} loading={timerBusy}>
                <Play className="size-4" aria-hidden /> Devam et
              </Button>
            </div>
          ) : pdfError ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CircleAlert className="size-8 text-danger" aria-hidden />
              <p className="font-medium">Soru görüntülenemedi.</p>
              <Button variant="secondary" onClick={retry}>
                Tekrar dene
              </Button>
            </div>
          ) : !doc ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Sorular hazırlanıyor…
            </div>
          ) : (
            <QuestionImage key={q.id} doc={doc} q={q} fit={fit} zoomable />
          )}
          </div>

          <div className={cn("flex flex-wrap items-center gap-2", paused && "pointer-events-none opacity-40")} role="radiogroup" aria-label="Cevabın">
            {CHOICE_LETTERS.slice(0, q.choiceCount).map((letter) => {
              const active = answers[q.id] === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => choose(active ? null : letter)}
                  className={cn(
                    "inline-flex size-12 items-center justify-center rounded-full border text-lg font-semibold transition-colors duration-fast",
                    active
                      ? "border-primary bg-primary text-on-primary"
                      : "border-border-strong text-text hover:border-primary hover:bg-primary-soft",
                  )}
                >
                  {letter}
                </button>
              );
            })}
            {/* Boş da bir seçenek: işaretli cevabı kaldırır; cevap yokken seçili görünür. */}
            <button
              type="button"
              role="radio"
              aria-checked={!answers[q.id]}
              onClick={() => answers[q.id] && choose(null)}
              title="Boş bırak (Boşluk)"
              className={cn(
                "inline-flex h-12 items-center justify-center rounded-full border px-5 text-base font-semibold transition-colors duration-fast",
                !answers[q.id]
                  ? "border-text-muted bg-surface-muted text-text"
                  : "border-border-strong text-text-muted hover:border-text-muted hover:text-text",
              )}
            >
              Boş
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => go(index - 1)} disabled={index === 0}>
              <ChevronLeft className="size-5" aria-hidden /> Önceki
            </Button>
            <span className="hidden text-xs text-text-subtle sm:block">A–E ile işaretle, Boşluk boş bırakır, ← → ile geç</span>
            <Button variant="ghost" onClick={() => go(index + 1)} disabled={index === exam.questions.length - 1}>
              Sonraki <ChevronRight className="size-5" aria-hidden />
            </Button>
          </div>
        </Card>

        <Card className={cn("flex flex-col gap-4 p-4", fit ? "min-h-0 overflow-y-auto" : "lg:sticky lg:top-36")}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Sorular</h2>
            <span className="text-sm text-text-muted tabular-nums">{exam.questions.length - answered} boş</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5">
            {exam.questions.map((x, i) => (
              <button
                key={x.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`${i + 1}. soru${answers[x.id] ? `, cevap ${answers[x.id]}` : ", boş"}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "inline-flex aspect-square items-center justify-center rounded-md text-xs font-medium tabular-nums transition-colors duration-fast",
                  answers[x.id] ? "bg-primary text-on-primary" : "bg-surface-muted text-text-muted hover:text-text",
                  i === index && "ring-2 ring-primary ring-offset-2 ring-offset-surface",
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="flex gap-4 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-primary" aria-hidden /> Cevaplandı
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-surface-muted" aria-hidden /> Boş
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}
