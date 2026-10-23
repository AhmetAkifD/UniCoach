import { z } from "zod";
import type { ExamTrack } from "./library";
import { calculateNet } from "./net";
import { CHOICE_LETTERS, type ChoiceLetter } from "./question-bank";

/**
 * Geçmiş Sınavlar: öğrencinin Soru Bankası'nda çıkardığı testlerden kurduğu süreli deneme.
 * Sınav oluşturulurken sorular (yer + doğru cevap) kopyalanır; kaynak sonradan düzenlense de sonuç bozulmaz.
 * Kaynağa dönüp düzeltmek için soru, kaynak soruya (`bookQuestionId`) bağlı kalır.
 */

/** Bir sınavda en fazla bu kadar soru olabilir. */
export const EXAM_MAX_QUESTIONS = 300;
/** Süre sınırı (dakika). */
export const EXAM_MAX_MINUTES = 600;
/** Önerilen süre: soru başına dakika (TYT 165 dk / 120 soru, LGS 155 dk / 90 soru). */
export const MINUTES_PER_QUESTION: Record<ExamTrack, number> = { YKS: 1.375, LGS: 1.72 };

/** Önerilen süre (dakika, yukarı yuvarlanır). */
export function suggestedMinutes(questionCount: number, track: ExamTrack): number {
  return Math.max(1, Math.ceil(questionCount * MINUTES_PER_QUESTION[track]));
}

/** Net: YKS'de 4, LGS'de 3 yanlış bir doğruyu götürür. */
export function examNet(correct: number, wrong: number, track: ExamTrack): number {
  return calculateNet({ correct, wrong }, track === "LGS" ? "LGS" : "TYT");
}

/** POST /api/exams */
export const createExamSchema = z.object({
  bookId: z.string().min(1, { error: "Bir PDF seç." }),
  sections: z.array(z.string().min(1)).min(1, { error: "En az bir test seç." }).max(100),
  /** null: süresiz */
  durationMin: z
    .number()
    .int()
    .min(1, { error: "Süre en az 1 dakika olmalı." })
    .max(EXAM_MAX_MINUTES, { error: `Süre en fazla ${EXAM_MAX_MINUTES} dakika olabilir.` })
    .nullable(),
});

/** POST /api/exams/:id/extend — süre ekleme (dakika) */
export const extendExamSchema = z.object({
  minutes: z.number().int().min(1, { error: "En az 1 dakika ekleyebilirsin." }).max(180, { error: "Bir seferde en fazla 180 dakika eklenebilir." }),
});

/** PUT /api/exams/:id/answers/:questionId — null: boş bırak */
export const examAnswerSchema = z.object({ answer: z.enum(CHOICE_LETTERS).nullable() });

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type ExamAnswerInput = z.infer<typeof examAnswerSchema>;
export type ExtendExamInput = z.infer<typeof extendExamSchema>;

export interface ExamSummary {
  id: string;
  bookId: string;
  bookTitle: string;
  /** Seçilen testlerin adları */
  title: string;
  track: ExamTrack;
  questionCount: number;
  /** null: süresiz */
  durationSec: number | null;
  startedAt: string;
  /** Süre dolunca ya da öğrenci bitirince dolar. */
  finishedAt: string | null;
  /** Sonradan eklenen süre (saniye) */
  extraSec: number;
  /** Süreli sınavın bitiş anı (eklenen süre ve duraklatmalar dahil) */
  deadline: string | null;
  /** Duraklatıldıysa duraklatma anı; kalan süre `deadline - pausedAt` olarak donar. */
  pausedAt: string | null;
  /** Duraklatılarak geçen toplam süre (saniye); harcanan süreden düşülür. */
  pausedSec: number;
  answeredCount: number;
  correct: number | null;
  wrong: number | null;
  blank: number | null;
  net: number | null;
}

export interface ExamQuestion {
  id: string;
  position: number;
  /** Kaynak soru (Soru Bankası); kaynak silindiyse null */
  bookQuestionId: string | null;
  section: string;
  number: number;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  choiceCount: number;
  answer: ChoiceLetter | null;
  /** Yalnızca sınav bittikten sonra gönderilir. */
  correctAnswer: ChoiceLetter | null;
}

export interface ExamDetail extends ExamSummary {
  questions: ExamQuestion[];
  /** Sunucu saati: geri sayım istemci saatinden bağımsız olsun diye. */
  now: string;
}

// --- Biçimlendirme (web ve mobil) ---

/** Geri sayım: 1:05:09 ya da 05:09 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Süre metni: "1 sa 5 dk", "42 dk", "40 sn" */
export function formatMinutes(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (ms < 60000) return `${Math.max(0, Math.round(ms / 1000))} sn`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h} sa${m ? ` ${m} dk` : ""}` : `${m} dk`;
}

const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** "21 Ekim 14:05" */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

// --- Sonuç ---

export type ExamOutcome = "correct" | "wrong" | "blank";
export const EXAM_OUTCOME_LABELS: Record<ExamOutcome, string> = { correct: "Doğru", wrong: "Yanlış", blank: "Boş" };

export const examOutcome = (q: Pick<ExamQuestion, "answer" | "correctAnswer">): ExamOutcome =>
  !q.answer ? "blank" : q.answer === q.correctAnswer ? "correct" : "wrong";

/** Test bazında döküm (sonuç tablosu). */
export function examSectionResults(exam: Pick<ExamDetail, "questions" | "track">) {
  const names = [...new Set(exam.questions.map((q) => q.section))];
  return names.map((name) => {
    const list = exam.questions.filter((q) => q.section === name);
    const correct = list.filter((q) => examOutcome(q) === "correct").length;
    const wrong = list.filter((q) => examOutcome(q) === "wrong").length;
    return { name, count: list.length, correct, wrong, blank: list.length - correct - wrong, net: examNet(correct, wrong, exam.track) };
  });
}

/** Harcanan süre (ms); duraklatılarak geçen süre sayılmaz. */
export const examUsedMs = (exam: Pick<ExamSummary, "startedAt" | "finishedAt" | "pausedSec">) =>
  Date.parse(exam.finishedAt!) - Date.parse(exam.startedAt) - exam.pausedSec * 1000;

/** Sınavın şu an kalan süresi (ms); süresizse null. `offsetMs`: sunucu saati − cihaz saati. */
export function examRemainingMs(clock: { deadline: string | null; pausedAt: string | null }, offsetMs = 0): number | null {
  if (!clock.deadline) return null;
  return Date.parse(clock.deadline) - (clock.pausedAt ? Date.parse(clock.pausedAt) : Date.now() + offsetMs);
}

/** Yarıda bırakılan sınav ilk boş sorudan başlar. */
export function firstBlankIndex(questions: Pick<ExamQuestion, "answer">[]) {
  const i = questions.findIndex((q) => !q.answer);
  return i < 0 ? 0 : i;
}
