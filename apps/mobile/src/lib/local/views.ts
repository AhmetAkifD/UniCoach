import type {
  AnswerKeyMethod,
  BookQuestion,
  BookSummary,
  ChoiceLetter,
  DetectMethod,
  ExamDetail,
  ExamQuestion,
  ExamSummary,
  NotebookDetail,
  NotebookSummary,
  NotePage,
  PreferenceItem,
  ResultSource,
  SourceDetail,
  SourceItem,
  SourceSummary,
  SyncBook,
  SyncExam,
  SyncExamQuestion,
  SyncSource,
  SyncSourceItem,
  YksResult,
} from "@unicoach/shared";
import { countByParent, fieldsByParent, readAll, readByParent, readOne } from "./db";

/**
 * Yerel satırlardan ekranların beklediği yanıtlar: API'deki servislerin döndürdüğü biçimin aynısı (sıralama dahil),
 * böylece ekranlar verinin sunucudan mı telefondan mı geldiğini bilmez.
 */

const desc = (a: string, b: string) => b.localeCompare(a);

// --- Konu Anlatımı ---

function sourceSummary(s: SyncSource, items: SyncSourceItem[]): SourceSummary {
  let lastStudied: string | null = null;
  for (const i of items) {
    if ((i.watchedAt || i.positionSec > 0) && (!lastStudied || i.updatedAt > lastStudied)) lastStudied = i.updatedAt;
  }
  return {
    id: s.id,
    subject: s.subject,
    kind: s.kind,
    youtubeId: s.youtubeId,
    title: s.title,
    author: s.author,
    thumbnailUrl: s.thumbnailUrl,
    itemCount: items.length,
    watchedCount: items.filter((i) => i.watchedAt).length,
    truncated: s.truncated,
    createdAt: s.createdAt,
    lastStudiedAt: lastStudied,
  };
}

const sourceItem = (i: SyncSourceItem): SourceItem => ({
  id: i.id,
  position: i.position,
  videoId: i.videoId,
  title: i.title,
  durationSec: i.durationSec,
  positionSec: i.positionSec,
  watchedAt: i.watchedAt,
});

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
  return map;
}

export async function listSources(): Promise<SourceSummary[]> {
  const [sources, items] = await Promise.all([readAll("sources"), readAll("sourceItems")]);
  const bySource = groupBy(items, (i) => i.sourceId);
  return sources.sort((a, b) => desc(a.createdAt, b.createdAt)).map((s) => sourceSummary(s, bySource.get(s.id) ?? []));
}

export async function getSourceItem(id: string): Promise<SourceItem | null> {
  const item = await readOne("sourceItems", id);
  return item ? sourceItem(item) : null;
}

export async function getSource(id: string): Promise<SourceDetail | null> {
  const source = await readOne("sources", id);
  if (!source) return null;
  const items = (await readByParent("sourceItems", id)).sort((a, b) => a.position - b.position);
  return { ...sourceSummary(source, items), items: items.map(sourceItem) };
}

// --- Soru Bankası ---

const bookSummary = (b: SyncBook, questionCount: number): BookSummary => ({
  id: b.id,
  subject: b.subject,
  title: b.title,
  topic: b.topic,
  sizeBytes: b.sizeBytes,
  pageCount: b.pageCount,
  lastPage: b.lastPage,
  questionCount,
  detectMethod: b.detectMethod as DetectMethod,
  keyMethod: b.keyMethod as AnswerKeyMethod,
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
});

export async function listBooks(): Promise<BookSummary[]> {
  const [books, counts] = await Promise.all([readAll("books"), countByParent("bookQuestions")]);
  return books.sort((a, b) => desc(a.createdAt, b.createdAt)).map((b) => bookSummary(b, counts.get(b.id) ?? 0));
}

export async function getBook(id: string): Promise<BookSummary | null> {
  const book = await readOne("books", id);
  return book ? bookSummary(book, (await countByParent("bookQuestions")).get(id) ?? 0) : null;
}

/** Kaynak sorular, satır olarak (sınav kurarken ve kaynaktan yeniden kopyalarken) */
export const bookQuestionRows = (bookId: string) => readByParent("bookQuestions", bookId);

export async function bookQuestions(id: string): Promise<BookQuestion[]> {
  return (await readByParent("bookQuestions", id))
    .sort((a, b) => a.position - b.position)
    .map((q) => ({
      id: q.id,
      section: q.section,
      number: q.number,
      page: q.page,
      x: q.x,
      y: q.y,
      w: q.w,
      h: q.h,
      choiceCount: q.choiceCount,
      answer: (q.answer as ChoiceLetter | null) ?? null,
      choices: q.choices,
    }));
}

// --- Geçmiş Sınavlar ---

function examSummary(e: SyncExam, questions: SyncExamQuestion[], bookTitle: string): ExamSummary {
  const deadline = e.durationSec === null ? null : new Date(Date.parse(e.startedAt) + (e.durationSec + e.extraSec) * 1000 + e.pausedMs);
  return {
    id: e.id,
    bookId: e.bookId,
    bookTitle,
    title: e.title,
    track: e.track,
    questionCount: questions.length,
    durationSec: e.durationSec,
    startedAt: e.startedAt,
    finishedAt: e.finishedAt,
    extraSec: e.extraSec,
    deadline: deadline?.toISOString() ?? null,
    pausedAt: e.pausedAt,
    pausedSec: Math.round(e.pausedMs / 1000),
    answeredCount: questions.filter((q) => q.answer).length,
    correct: e.correct,
    wrong: e.wrong,
    blank: e.blank,
    net: e.net,
  };
}

export async function listExams(): Promise<ExamSummary[]> {
  const [exams, questions, books] = await Promise.all([readAll("exams"), readAll("examQuestions"), readAll("books")]);
  const byExam = groupBy(questions, (q) => q.examId);
  const titles = new Map(books.map((b) => [b.id, b.title]));
  return exams
    .sort((a, b) => desc(a.startedAt, b.startedAt))
    .map((e) => examSummary(e, byExam.get(e.id) ?? [], titles.get(e.bookId) ?? ""));
}

export async function getExam(id: string): Promise<ExamDetail | null> {
  const exam = await readOne("exams", id);
  if (!exam) return null;
  const [questions, book] = await Promise.all([readByParent("examQuestions", id), readOne("books", exam.bookId)]);
  const reveal = !!exam.finishedAt;
  return {
    ...examSummary(exam, questions, book?.title ?? ""),
    questions: questions
      .sort((a, b) => a.position - b.position)
      .map(
        (q): ExamQuestion => ({
          id: q.id,
          position: q.position,
          bookQuestionId: q.bookQuestionId,
          section: q.section,
          number: q.number,
          page: q.page,
          x: q.x,
          y: q.y,
          w: q.w,
          h: q.h,
          choiceCount: q.choiceCount,
          answer: (q.answer as ChoiceLetter | null) ?? null,
          // Doğru cevap yalnızca sınav bitince gösterilir (API'deki gibi).
          correctAnswer: reveal ? (q.correctAnswer as ChoiceLetter) : null,
        }),
      ),
    now: new Date().toISOString(),
  };
}

// --- YKS Tercih ---

export async function listResults(): Promise<YksResult[]> {
  return (await readAll("yksResults"))
    .sort((a, b) => b.year - a.year)
    .map((r) => ({
      id: r.id,
      year: r.year,
      source: r.source as ResultSource,
      diplomaGrade: r.diplomaGrade,
      obp: r.obp,
      scores: r.scores,
      tests: r.tests,
      updatedAt: r.updatedAt,
    }));
}

export async function listPreferences(): Promise<PreferenceItem[]> {
  return (await readAll("preferences"))
    .sort((a, b) => a.position - b.position)
    .map((r, i) => ({ position: i + 1, program: r.program, addedAt: r.addedAt }));
}

// --- Not defterleri ---

export async function listNotebooks(): Promise<NotebookSummary[]> {
  const [notebooks, counts] = await Promise.all([readAll("notebooks"), countByParent("notebookPages")]);
  return notebooks
    .sort((a, b) => desc(a.updatedAt, b.updatedAt))
    .map((n) => ({ id: n.id, title: n.title, pageCount: counts.get(n.id) ?? 0, updatedAt: n.updatedAt }));
}

export async function getNotebook(id: string): Promise<NotebookDetail | null> {
  const notebook = await readOne("notebooks", id);
  if (!notebook) return null;
  // Sayfa içerikleri çözülmez; yalnızca sırası ve tarihi.
  const pages = (await fieldsByParent("notebookPages", id, ["position", "updatedAt"]))
    .map((p) => ({ id: p.id as string, position: p.position as number, updatedAt: p.updatedAt as string }))
    .sort((a, b) => a.position - b.position);
  return { id: notebook.id, title: notebook.title, pageCount: pages.length, updatedAt: notebook.updatedAt, pages };
}

export async function getNotePage(notebookId: string, pageId: string): Promise<NotePage | null> {
  const page = await readOne("notebookPages", pageId);
  if (!page || page.notebookId !== notebookId) return null;
  return { id: page.id, position: page.position, updatedAt: page.updatedAt, content: page.content };
}
