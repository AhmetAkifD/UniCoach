import {
  answerQuestion,
  ApiError,
  createExamSchema,
  createExamState,
  EXAM_GRACE_MS,
  ExamRuleError,
  extendExam,
  findSubject,
  finishExam,
  finishIfExpired,
  isEmptyNoteDiff,
  pauseExam,
  resumeExam,
  resyncExam,
  type ExamDetail,
  type ExamState,
  type SyncBookQuestion,
  saveBookQuestionsSchema,
  updateBookSchema,
  NOTEBOOK_MAX_PAGES,
  notePageDiff,
  type ApiClient,
  type BookSummary,
  type NotebookDetail,
  type NotePageRef,
  type SyncOp,
} from "@unicoach/shared";
import { getChildren, getMeta, getRow, transaction } from "./db";
import { record } from "./ops";
import { createSyncEngine } from "./sync-engine";
import type { SyncEngine } from "./types";
import * as views from "./views";

export type { Connection, SyncEngine, SyncState } from "./types";

/** Sunucudaki doğrulamanın aynısı; hata alanlarıyla `ApiError` (formlar alan hatasını gösterir). */
type SafeParse<T> = { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
function validate<T>(schema: { safeParse(input: unknown): SafeParse<T> }, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) errors[String(issue.path[0] ?? "")] ??= issue.message;
  throw new ApiError(400, result.error.issues[0]?.message ?? "Geçersiz bilgi.", errors);
}

/** Telefonda üretilen kimlik (sunucudaki cuid'lerle karışmaz: zaman + rastgele). */
const newId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

/**
 * Telefonda API'nin önüne yerel kopya konur:
 * - Okumalar yerel veritabanından gelir; ekranlar aynı çağrıları (`api.sources.list()` …) kullanmaya devam eder.
 * - Not defteri, video ilerlemesi ve kalınan PDF sayfası önce yerel kopyaya ve gönderilecekler kuyruğuna yazılır,
 *   sunucuya ulaşınca gönderilir (çevrimdışı da çalışır).
 * - Diğer yazmalar sunucuya gider (bağlantı gerekir); başarılı olunca eşitlenir ki sonraki okuma güncel olsun.
 */
export function createLocalLayer(remote: ApiClient): { api: ApiClient; engine: SyncEngine } {
  const engine = createSyncEngine(remote);

  // Bu cihazda hiç eşitleme yapılmadıysa ilk okuma, ilk eşitlemeyi bekler (ekranlar boş görünmesin).
  let initial: Promise<unknown> | null = null;
  async function ready() {
    if (await getMeta("cursor")) return;
    if (engine.getState().connection === "offline") return;
    initial ??= engine.sync().finally(() => {
      initial = null;
    });
    await initial;
  }

  /** Yerelde yoksa (henüz eşitlenmemiş olabilir) bağlantı varken sunucuya sorulur. */
  async function local<T>(read: () => Promise<T | null>, fallback: () => Promise<T>, notFound: string): Promise<T> {
    await ready();
    const value = await read();
    if (value !== null) return value;
    if (engine.getState().connection !== "offline") return fallback();
    throw new ApiError(404, notFound);
  }

  async function list<T>(read: () => Promise<T>): Promise<T> {
    await ready();
    return read();
  }

  /** Değişikliği yerel kopyaya ve kuyruğa yazar, kısa süre sonra gönderir. */
  async function change(op: SyncOp) {
    await transaction((tx) => record(tx, op, new Date().toISOString()));
    void engine.refreshPending();
    engine.schedule();
  }

  /** Sunucuya giden yazmalar: başarılı olunca eşitlenir (yerel kopya hemen güncellenir). */
  function writes<T extends object>(ns: T): T {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(ns)) {
      out[key] =
        typeof value === "function"
          ? (...args: unknown[]) => {
              const result = (value as (...a: unknown[]) => unknown)(...args);
              if (!(result instanceof Promise)) return result;
              return result.then(async (v) => {
                await engine.sync();
                return v;
              });
            }
          : value;
    }
    return out as T;
  }

  const book = async (id: string): Promise<BookSummary> => {
    const found = await views.getBook(id);
    if (!found) throw new ApiError(404, "PDF bulunamadı.");
    return found;
  };

  // --- Sınavlar ---

  /** Kural ihlali ekrana sunucudaki gibi `ApiError` olarak gelir. */
  function rules<T>(run: () => T): T {
    try {
      return run();
    } catch (err) {
      if (err instanceof ExamRuleError) throw new ApiError(err.status, err.message);
      throw err;
    }
  }

  const examState = (id: string) =>
    transaction(async (tx): Promise<ExamState | null> => {
      const exam = await getRow(tx, "exams", id);
      if (!exam) return null;
      const questions = (await getChildren(tx, "examQuestions", id)).sort((a, b) => a.position - b.position);
      return { exam, questions };
    });

  const bookSources = async (bookId: string) =>
    new Map((await views.bookQuestionRows(bookId)).map((q) => [q.id, q] as const));

  /** Durum değiştiyse bütünüyle kuyruğa yazılır (aynı sınavın bekleyen durumu yenisiyle değişir). */
  async function saveExam(before: ExamState | null, next: ExamState): Promise<ExamDetail> {
    if (!before || JSON.stringify(before) !== JSON.stringify(next)) {
      const op = { type: "examState", exam: next.exam, questions: next.questions } as Extract<SyncOp, { type: "examState" }>;
      await change(op);
    }
    const detail = await views.getExam(next.exam.id);
    if (!detail) throw new ApiError(404, "Sınav bulunamadı.");
    return detail;
  }

  async function examAction(id: string, step: (state: ExamState, sources: Map<string, SyncBookQuestion>) => ExamState): Promise<ExamDetail> {
    const state = await examState(id);
    if (!state) {
      // Bu cihaza henüz gelmemiş sınav (ör. web'de az önce kuruldu): bağlantı varsa sunucudan okunur.
      if (engine.getState().connection !== "offline") return remote.exams.get(id);
      throw new ApiError(404, "Sınav bulunamadı.");
    }
    const sources = await bookSources(state.exam.bookId);
    return saveExam(state, rules(() => step(state, sources)));
  }

  const notebook = async (id: string): Promise<NotebookDetail> => {
    const detail = await views.getNotebook(id);
    if (!detail) throw new ApiError(404, "Defter bulunamadı.");
    return detail;
  };

  const api: ApiClient = {
    ...remote,
    sources: {
      ...writes(remote.sources),
      list: () => list(views.listSources),
      get: (id) => local(() => views.getSource(id), () => remote.sources.get(id), "Kaynak bulunamadı."),
      saveProgress: async (sourceId, itemId, input) => {
        await change({ type: "sourceProgress", sourceId, itemId, ...input, at: new Date().toISOString() });
        const item = await views.getSourceItem(itemId);
        if (!item) throw new ApiError(404, "Video bulunamadı.");
        return item;
      },
    },
    books: {
      ...writes(remote.books),
      list: () => list(views.listBooks),
      get: (id) => local(() => views.getBook(id), () => remote.books.get(id), "PDF bulunamadı."),
      questions: (id) => list(() => views.bookQuestions(id)),
      saveProgress: async (bookId, input) => {
        await change({ type: "bookProgress", bookId, ...input, at: new Date().toISOString() });
        return book(bookId);
      },
      update: async (bookId, input) => {
        await change({ type: "bookUpdate", bookId, patch: validate(updateBookSchema, input) });
        return book(bookId);
      },
      // Çevrimdışı da kaydedilir; yeni soruların kimliği burada üretilir (sunucu korur, sınavlar ona bağlanır).
      saveQuestions: async (bookId, input) => {
        await book(bookId);
        const parsed = validate(saveBookQuestionsSchema, input);
        const questions = parsed.questions.map((q) => ({ ...q, id: q.id ?? newId() }));
        await change({ type: "bookQuestions", bookId, input: { questions } });
        return views.bookQuestions(bookId);
      },
    },
    // Sınavlar telefonda çözülür (çevrimdışı da): kurallar ortak paketteki exam-engine'de, durum bütünüyle gönderilir.
    exams: {
      ...remote.exams,
      list: async () => {
        await ready();
        // Süresi dolmuş sınavlar listelenirken kapanır (sunucudaki liste gibi).
        const now = Date.now();
        for (const e of await views.listExams()) {
          if (!e.finishedAt && !e.pausedAt && e.deadline && now > Date.parse(e.deadline) + EXAM_GRACE_MS) {
            await examAction(e.id, (s) => finishIfExpired(s, now));
          }
        }
        return views.listExams();
      },
      today: async () => {
        await ready();
        return views.examToday();
      },
      get: async (id) => {
        await ready();
        return examAction(id, (s) => finishIfExpired(s, Date.now()));
      },
      create: async (input) => {
        const { bookId, sections, durationMin } = validate(createExamSchema, input);
        const source = await book(bookId);
        const bookQuestions = [...(await bookSources(bookId)).values()];
        const track = findSubject(source.subject)?.track ?? "YKS";
        const state = rules(() => createExamState({ id: newId(), bookId, track, sections, durationMin, bookQuestions, newId, now: Date.now() }));
        return saveExam(null, state);
      },
      answer: async (id, questionId, { answer }) => {
        const detail = await examAction(id, (s) => answerQuestion(s, questionId, answer, Date.now()));
        const question = detail.questions.find((q) => q.id === questionId);
        if (!question) throw new ApiError(404, "Soru bulunamadı.");
        return question;
      },
      finish: (id) => examAction(id, (s) => finishExam(s, Date.now())),
      pause: (id) => examAction(id, (s) => pauseExam(s, Date.now())),
      resume: (id) => examAction(id, (s, sources) => resumeExam(s, sources, Date.now())),
      extend: (id, { minutes }) => examAction(id, (s) => extendExam(s, minutes, Date.now())),
      sync: (id) => examAction(id, (s, sources) => resyncExam(s, sources)),
      remove: async (id) => {
        await change({ type: "examDelete", id });
      },
    },
    results: { ...writes(remote.results), list: () => list(views.listResults) },
    preferences: { ...writes(remote.preferences), list: () => list(views.listPreferences) },
    // Not defterleri tamamen yerelde: çevrimdışı da oluşturulur, yazılır, sayfa eklenir ve silinir.
    notebooks: {
      ...remote.notebooks,
      list: () => list(views.listNotebooks),
      get: (id) => local(() => views.getNotebook(id), () => remote.notebooks.get(id), "Defter bulunamadı."),
      page: (id, pageId) => local(() => views.getNotePage(id, pageId), () => remote.notebooks.page(id, pageId), "Sayfa bulunamadı."),
      create: async ({ title }) => {
        const id = newId();
        await change({ type: "notebookCreate", id, pageId: newId(), title: title.trim() });
        return notebook(id);
      },
      update: async (id, { title }) => {
        await change({ type: "notebookRename", id, title: title.trim() });
        return notebook(id);
      },
      remove: async (id) => {
        await change({ type: "notebookDelete", id });
      },
      addPage: async (id, { afterPageId }) => {
        if ((await notebook(id)).pages.length >= NOTEBOOK_MAX_PAGES) {
          throw new ApiError(400, `Bir defterde en fazla ${NOTEBOOK_MAX_PAGES} sayfa olabilir.`);
        }
        await change({ type: "pageAdd", notebookId: id, id: newId(), afterPageId });
        return notebook(id);
      },
      removePage: async (id, pageId) => {
        if ((await notebook(id)).pages.length < 2) throw new ApiError(400, "Defterde en az bir sayfa kalmalı.");
        await change({ type: "pageDelete", notebookId: id, pageId });
        return notebook(id);
      },
      // Ekran bütün sayfayı gönderir; yerel kopyadakiyle farkı kuyruğa yazılır (sunucuda birleştirilir).
      savePage: async (id, pageId, input) => {
        const current = await transaction((tx) => getRow(tx, "notebookPages", pageId));
        if (!current || current.notebookId !== id) throw new ApiError(404, "Sayfa bulunamadı.");
        const diff = input.diff ?? (input.content ? notePageDiff(current.content, input.content) : null);
        if (diff && !isEmptyNoteDiff(diff)) await change({ type: "pageEdit", notebookId: id, pageId, diff });
        const page = (await views.getNotePage(id, pageId)) ?? current;
        const ref: NotePageRef = { id: page.id, position: page.position, updatedAt: page.updatedAt };
        return ref;
      },
    },
  };
  return { api, engine };
}
