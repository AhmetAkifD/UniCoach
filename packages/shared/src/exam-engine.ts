import { EXAM_MAX_QUESTIONS, examNet } from "./exam-session";
import type { ExamTrack } from "./library";
import type { SyncBookQuestion, SyncExam, SyncExamQuestion } from "./sync";

/**
 * Sınavın kuralları, saf işlevler olarak (telefonda çevrimdışı sınav; sunucudaki ExamsService'in aynı kuralları):
 * süre = başlangıç + süre + ek süre + duraklatmalar; duraklatılmışken süre işlemez ve cevap alınmaz; süre dolunca
 * (15 sn esneklikle) sınav kapanır; bitince doğru/yanlış/boş ve net hesaplanır; devam ederken sorular kaynaktan
 * yeniden kopyalanır. Sınav hangi cihazda çözülüyorsa durum orada hesaplanır, bütünüyle sunucuya gönderilir.
 */

export interface ExamState {
  exam: SyncExam;
  questions: SyncExamQuestion[];
}

/** Kural ihlali (sunucudaki 400/409 yanıtlarının karşılığı) */
export class ExamRuleError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

/** Ağ gecikmesi yüzünden son saniyede gelen cevaplar kaybolmasın diye süre bu kadar esnetilir (sunucuyla aynı). */
export const EXAM_GRACE_MS = 15_000;

const iso = (ms: number) => new Date(ms).toISOString();

/** Süreli sınavın bitiş anı (ms) */
export function examDeadlineMs(exam: SyncExam): number | null {
  if (exam.durationSec === null) return null;
  return Date.parse(exam.startedAt) + (exam.durationSec + exam.extraSec) * 1000 + exam.pausedMs;
}

/** Seçilen testlerin cevabı girilmiş soruları PDF sırasıyla kopyalanır (sunucudaki `create` gibi). */
export function createExamState(input: {
  id: string;
  bookId: string;
  track: ExamTrack;
  sections: string[];
  durationMin: number | null;
  bookQuestions: SyncBookQuestion[];
  newId: () => string;
  now: number;
}): ExamState {
  const chosen = new Set(input.sections);
  const questions = input.bookQuestions.filter((q) => chosen.has(q.section) && q.answer).sort((a, b) => a.position - b.position);
  if (!questions.length) throw new ExamRuleError(400, "Seçtiğin testlerde cevabı girilmiş soru yok.");
  if (questions.length > EXAM_MAX_QUESTIONS) throw new ExamRuleError(400, `Bir sınavda en fazla ${EXAM_MAX_QUESTIONS} soru olabilir.`);
  const sections = [...new Set(questions.map((q) => q.section))];
  return {
    exam: {
      id: input.id,
      bookId: input.bookId,
      title: sections.join(", ").slice(0, 200),
      track: input.track,
      durationSec: input.durationMin === null ? null : input.durationMin * 60,
      extraSec: 0,
      pausedAt: null,
      pausedMs: 0,
      startedAt: iso(input.now),
      finishedAt: null,
      correct: null,
      wrong: null,
      blank: null,
      net: null,
      syncVersion: 0,
    },
    questions: questions.map((q, position) => ({
      id: input.newId(),
      examId: input.id,
      position,
      bookQuestionId: q.id,
      section: q.section,
      number: q.number,
      page: q.page,
      x: q.x,
      y: q.y,
      w: q.w,
      h: q.h,
      choiceCount: q.choiceCount,
      correctAnswer: q.answer!,
      answer: null,
      answeredAt: null,
      syncVersion: 0,
    })),
  };
}

/** Doğru, yanlış, boş ve net */
function score(state: ExamState, finishedAt: number): ExamState {
  const correct = state.questions.filter((q) => q.answer && q.answer === q.correctAnswer).length;
  const wrong = state.questions.filter((q) => q.answer && q.answer !== q.correctAnswer).length;
  const blank = state.questions.length - correct - wrong;
  return { ...state, exam: { ...state.exam, finishedAt: iso(finishedAt), correct, wrong, blank, net: examNet(correct, wrong, state.exam.track) } };
}

/** Kapatır. Bitiş anı süreyi aşmaz; duraklatılmışken bitirilirse süre duraklatma anında durmuş sayılır. */
function close(state: ExamState, now: number): ExamState {
  const end = state.exam.pausedAt ? Date.parse(state.exam.pausedAt) : now;
  const finishedAt = Math.min(end, examDeadlineMs(state.exam) ?? Infinity);
  return score({ ...state, exam: { ...state.exam, pausedAt: null } }, finishedAt);
}

/** Süresi dolmuşsa kapatır (duraklatılmış sınavın süresi işlemez). */
export function finishIfExpired(state: ExamState, now: number): ExamState {
  const { exam } = state;
  if (exam.finishedAt || exam.durationSec === null || exam.pausedAt) return state;
  return now > examDeadlineMs(exam)! + EXAM_GRACE_MS ? close(state, now) : state;
}

export function answerQuestion(state: ExamState, questionId: string, answer: string | null, now: number): ExamState {
  const current = finishIfExpired(state, now);
  if (current.exam.finishedAt) throw new ExamRuleError(409, "Sınav bitti; cevap değiştirilemez.");
  if (current.exam.pausedAt) throw new ExamRuleError(409, "Sınav duraklatıldı; devam ettirip cevapla.");
  const question = current.questions.find((q) => q.id === questionId);
  if (!question) throw new ExamRuleError(404, "Soru bulunamadı.");
  if (answer && "ABCDE".indexOf(answer) >= question.choiceCount) throw new ExamRuleError(400, "Bu soruda o şık yok.");
  return {
    ...current,
    questions: current.questions.map((q) => (q.id === questionId ? { ...q, answer, answeredAt: iso(now) } : q)),
  };
}

export const finishExam = (state: ExamState, now: number): ExamState => (state.exam.finishedAt ? state : close(state, now));

export function pauseExam(state: ExamState, now: number): ExamState {
  const current = finishIfExpired(state, now);
  const { exam } = current;
  if (exam.finishedAt || exam.durationSec === null || exam.pausedAt) return current;
  return { ...current, exam: { ...exam, pausedAt: iso(now) } };
}

/**
 * Sorular kaynak sorudan yeniden kopyalanır (kutu, test, numara, doğru cevap). Kaynağı silinen ya da cevabı kaldırılan
 * sorular olduğu gibi kalır; öğrencinin cevabı korunur (artık o şık yoksa boşalır).
 */
export function syncExamQuestions(state: ExamState, sources: Map<string, SyncBookQuestion>): ExamState {
  return {
    ...state,
    questions: state.questions.map((q) => {
      const s = q.bookQuestionId ? sources.get(q.bookQuestionId) : undefined;
      if (!s?.answer) return q;
      return {
        ...q,
        section: s.section,
        number: s.number,
        page: s.page,
        x: s.x,
        y: s.y,
        w: s.w,
        h: s.h,
        choiceCount: s.choiceCount,
        correctAnswer: s.answer,
        answer: q.answer && "ABCDE".indexOf(q.answer) < s.choiceCount ? q.answer : null,
      };
    }),
  };
}

/** Süreyi yeniden başlatır; sorular kaynaktan okunur. */
export function resumeExam(state: ExamState, sources: Map<string, SyncBookQuestion>, now: number): ExamState {
  const current = state.exam.finishedAt ? state : syncExamQuestions(state, sources);
  const { exam } = current;
  if (exam.finishedAt || !exam.pausedAt) return finishIfExpired(current, now);
  return { ...current, exam: { ...exam, pausedAt: null, pausedMs: exam.pausedMs + (now - Date.parse(exam.pausedAt)) } };
}

/** Ek süre (dakika); duraklatılmışken de eklenebilir. */
export function extendExam(state: ExamState, minutes: number, now: number): ExamState {
  const current = finishIfExpired(state, now);
  if (current.exam.finishedAt) throw new ExamRuleError(409, "Sınav bitti; süre eklenemez.");
  if (current.exam.durationSec === null) throw new ExamRuleError(400, "Süresiz sınava süre eklenmez.");
  return { ...current, exam: { ...current.exam, extraSec: current.exam.extraSec + minutes * 60 } };
}

/** Kaynaktaki düzeltmeleri işler; sınav bittiyse sonuç yeniden hesaplanır. */
export function resyncExam(state: ExamState, sources: Map<string, SyncBookQuestion>): ExamState {
  const synced = syncExamQuestions(state, sources);
  return synced.exam.finishedAt ? score(synced, Date.parse(synced.exam.finishedAt)) : synced;
}
