import { ApiError, type ApiClient } from "@unicoach/shared";
import { getMeta } from "./db";
import { createSyncEngine } from "./sync-engine";
import type { SyncEngine } from "./types";
import * as views from "./views";

export type { Connection, SyncEngine, SyncState } from "./types";

/**
 * Telefonda API'nin önüne yerel kopya konur (çevrimdışı çalışma, 1. aşama):
 * - Okumalar yerel veritabanından gelir; ekranlar aynı çağrıları (`api.sources.list()` …) kullanmaya devam eder.
 * - Yazmalar şimdilik sunucuya gider; başarılı her yazmadan sonra yenilikler çekilir ki sonraki okuma güncel olsun.
 * Sunucuya ulaşılamazken okumalar çalışır, yazmalar hata verir (çevrimdışı yazma 2. aşamada).
 */
export function createLocalLayer(remote: ApiClient): { api: ApiClient; engine: SyncEngine } {
  const engine = createSyncEngine(remote);

  // Bu cihazda hiç eşitleme yapılmadıysa ilk okuma, ilk çekmeyi bekler (ekranlar boş görünmesin).
  let initial: Promise<unknown> | null = null;
  async function ready() {
    if (await getMeta("cursor")) return;
    if (engine.getState().connection === "offline") return;
    initial ??= engine.pull().finally(() => {
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

  /** Yazan çağrılar: başarılı olunca yenilikler çekilir (yerel kopya hemen güncellenir). */
  function writes<T extends object>(ns: T): T {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(ns)) {
      out[key] =
        typeof value === "function"
          ? (...args: unknown[]) => {
              const result = (value as (...a: unknown[]) => unknown)(...args);
              if (!(result instanceof Promise)) return result;
              return result.then(async (v) => {
                await engine.pull();
                return v;
              });
            }
          : value;
    }
    return out as T;
  }

  const api: ApiClient = {
    ...remote,
    sources: {
      ...writes(remote.sources),
      list: () => list(views.listSources),
      get: (id) => local(() => views.getSource(id), () => remote.sources.get(id), "Kaynak bulunamadı."),
    },
    books: {
      ...writes(remote.books),
      list: () => list(views.listBooks),
      get: (id) => local(() => views.getBook(id), () => remote.books.get(id), "PDF bulunamadı."),
      questions: (id) => list(() => views.bookQuestions(id)),
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
    notebooks: {
      ...writes(remote.notebooks),
      list: () => list(views.listNotebooks),
      get: (id) => local(() => views.getNotebook(id), () => remote.notebooks.get(id), "Defter bulunamadı."),
      page: (id, pageId) => local(() => views.getNotePage(id, pageId), () => remote.notebooks.page(id, pageId), "Sayfa bulunamadı."),
    },
  };
  return { api, engine };
}
