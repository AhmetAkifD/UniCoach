import {
  ApiError,
  isEmptyNoteDiff,
  NOTEBOOK_MAX_PAGES,
  notePageDiff,
  type ApiClient,
  type NotebookDetail,
  type NotePageRef,
  type SyncOp,
} from "@unicoach/shared";
import { getMeta, getRow, transaction } from "./db";
import { record } from "./ops";
import { createSyncEngine } from "./sync-engine";
import type { SyncEngine } from "./types";
import * as views from "./views";

export type { Connection, SyncEngine, SyncState } from "./types";

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
        const book = await views.getBook(bookId);
        if (!book) throw new ApiError(404, "PDF bulunamadı.");
        return book;
      },
    },
    exams: {
      ...writes(remote.exams),
      list: () => list(views.listExams),
      // Süre sunucuda tutulduğu için bağlantı varken sınav sunucudan okunur (süresi dolan sınav orada kapanır).
      get: async (id) => {
        if (engine.getState().connection !== "offline") {
          try {
            return await remote.exams.get(id);
          } catch (err) {
            if (err instanceof ApiError) throw err;
          }
        }
        return local(() => views.getExam(id), () => remote.exams.get(id), "Sınav bulunamadı.");
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
