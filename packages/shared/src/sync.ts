import { z } from "zod";
import { progressSchema } from "./library";
import { notebookInputSchema, notePageDiffSchema, type NotePageContent } from "./notebooks";
import type { ProgramSummary } from "./programs";
import { bookProgressSchema, saveBookQuestionsSchema, updateBookSchema } from "./question-bank";
import type { YksScore, YksTest } from "./yks-result";

/**
 * Cihazlar arası eşitleme (mobil çevrimdışı çalışma). Merkez evdeki sunucudur; telefon verinin bir kopyasını kendi
 * veritabanında tutar ve sunucuya ulaşınca eşitler.
 *
 * Sunucuda eşitlenen her satırın `syncVersion`'ı vardır: veritabanı her ekleme ve değişiklikte satıra genel bir
 * sayaçtan yeni numara verir (tetikleyici; API'nin hangi yolu kullandığından bağımsız). Silinen satırlar
 * `SyncTombstone`'a yazılır. Telefon "en son X'e kadar gördüm" der (`cursor`), sunucu sonrasını verir.
 *
 * Satırlar veritabanındaki sütunların aynısıdır (tarihler ISO metni); ekranların beklediği biçime (ör.
 * `SourceSummary`) telefonda çevrilir.
 */

/** Eşitlenen tablolar (telefondaki tablo adları da bunlar). */
export const SYNC_TABLES = [
  "sources",
  "sourceItems",
  "books",
  "bookQuestions",
  "exams",
  "examQuestions",
  "yksResults",
  "preferences",
  "notebooks",
  "notebookPages",
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

/** Telefonda üst satır silinince alt satırlar da silinir (sunucudaki cascade'in karşılığı). */
export const SYNC_CHILDREN: Partial<Record<SyncTable, { table: SyncTable; key: string }[]>> = {
  sources: [{ table: "sourceItems", key: "sourceId" }],
  books: [
    { table: "bookQuestions", key: "bookId" },
    { table: "exams", key: "bookId" },
  ],
  exams: [{ table: "examQuestions", key: "examId" }],
  notebooks: [{ table: "notebookPages", key: "notebookId" }],
};

/** Alt satırların üst satır alanı (telefonda indekslenir) */
export const SYNC_PARENT_KEY: Partial<Record<SyncTable, string>> = {
  sourceItems: "sourceId",
  bookQuestions: "bookId",
  exams: "bookId",
  examQuestions: "examId",
  notebookPages: "notebookId",
};

interface Versioned {
  id: string;
  syncVersion: number;
}

export interface SyncSource extends Versioned {
  subject: string;
  kind: "VIDEO" | "PLAYLIST";
  youtubeId: string;
  title: string;
  author: string | null;
  thumbnailUrl: string | null;
  truncated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyncSourceItem extends Versioned {
  sourceId: string;
  position: number;
  videoId: string;
  title: string;
  durationSec: number | null;
  positionSec: number;
  watchedAt: string | null;
  updatedAt: string;
}

export interface SyncBook extends Versioned {
  subject: string;
  title: string;
  topic: string | null;
  sizeBytes: number;
  pageCount: number | null;
  lastPage: number;
  detectMethod: string;
  keyMethod: string;
  uploadedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncBookQuestion extends Versioned {
  bookId: string;
  section: string;
  number: number;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  choiceCount: number;
  answer: string | null;
  choices: string[];
  position: number;
}

export interface SyncExam extends Versioned {
  bookId: string;
  title: string;
  track: "YKS" | "LGS";
  durationSec: number | null;
  extraSec: number;
  pausedAt: string | null;
  pausedMs: number;
  startedAt: string;
  finishedAt: string | null;
  correct: number | null;
  wrong: number | null;
  blank: number | null;
  net: number | null;
}

export interface SyncExamQuestion extends Versioned {
  examId: string;
  position: number;
  bookQuestionId: string | null;
  section: string;
  number: number;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  choiceCount: number;
  correctAnswer: string;
  answer: string | null;
  answeredAt: string | null;
}

export interface SyncYksResult extends Versioned {
  year: number;
  source: string;
  diplomaGrade: number | null;
  obp: number | null;
  scores: YksScore[];
  tests: YksTest[];
  createdAt: string;
  updatedAt: string;
}

export interface SyncPreference extends Versioned {
  programCode: number;
  position: number;
  /** İndirilmiş veride varsa programın güncel hâli, yoksa eklendiği andaki hâli */
  program: ProgramSummary;
  addedAt: string;
}

export interface SyncNotebook extends Versioned {
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncNotebookPage extends Versioned {
  notebookId: string;
  position: number;
  content: NotePageContent;
  updatedAt: string;
}

export interface SyncRows {
  sources: SyncSource[];
  sourceItems: SyncSourceItem[];
  books: SyncBook[];
  bookQuestions: SyncBookQuestion[];
  exams: SyncExam[];
  examQuestions: SyncExamQuestion[];
  yksResults: SyncYksResult[];
  preferences: SyncPreference[];
  notebooks: SyncNotebook[];
  notebookPages: SyncNotebookPage[];
}

export type SyncRow = SyncRows[SyncTable][number];

/** GET /api/sync/pull?since=<cursor> */
export interface SyncPullResponse {
  /** Bir sonraki istekte `since` olarak gönderilir. */
  cursor: number;
  rows: SyncRows;
  /** `since`ten sonra silinenler */
  deleted: { table: SyncTable; id: string }[];
  serverTime: string;
}

// --- Telefondan sunucuya: çevrimdışı yapılan değişiklikler ---

const rowId = z.string().min(1).max(40);
/** Değişikliğin telefondaki anı; aynı satırda son yapılan kazanır (video ilerlemesi, kalınan sayfa). */
const at = z.iso.datetime();

/**
 * Telefonda yapılan değişiklikler önce yerel veritabanına ve gönderilecekler kuyruğuna yazılır, sunucuya ulaşınca
 * sırayla gönderilir. Her işlem tekrar gönderilse de aynı sonucu verir (yanıt kaybolursa kuyruk yeniden gönderir).
 * Yeni defter ve sayfaların kimliğini telefon üretir.
 */
export const syncOpSchema = z.discriminatedUnion("type", [
  progressSchema.extend({ type: z.literal("sourceProgress"), sourceId: rowId, itemId: rowId, at }),
  bookProgressSchema.extend({ type: z.literal("bookProgress"), bookId: rowId, at }),
  /** PDF'in adı, dersi, konusu, soru bulma yöntemleri */
  z.object({ type: z.literal("bookUpdate"), bookId: rowId, patch: updateBookSchema }),
  /** Çıkarılan soruların tamamı (düzenleyicinin "Kaydet"i; yeni soruların kimliğini telefon üretir) */
  z.object({ type: z.literal("bookQuestions"), bookId: rowId, input: saveBookQuestionsSchema }),
  z.object({ type: z.literal("notebookCreate"), id: rowId, pageId: rowId, title: notebookInputSchema.shape.title }),
  z.object({ type: z.literal("notebookRename"), id: rowId, title: notebookInputSchema.shape.title }),
  z.object({ type: z.literal("notebookDelete"), id: rowId }),
  z.object({ type: z.literal("pageAdd"), notebookId: rowId, id: rowId, afterPageId: rowId.nullable() }),
  z.object({ type: z.literal("pageDelete"), notebookId: rowId, pageId: rowId }),
  z.object({ type: z.literal("pageEdit"), notebookId: rowId, pageId: rowId, diff: notePageDiffSchema }),
]);
export type SyncOp = z.infer<typeof syncOpSchema>;

/** Bir istekte en fazla bu kadar işlem gönderilir (fazlası sonraki istekte). */
export const SYNC_PUSH_MAX = 100;

/** POST /api/sync/push */
export const syncPushSchema = z.object({ ops: z.array(syncOpSchema).min(1).max(SYNC_PUSH_MAX) });
export type SyncPushInput = z.infer<typeof syncPushSchema>;

export interface SyncPushResponse {
  applied: number;
  /** Uygulanamayan işlemler (ör. başka cihazda silinmiş deftere yazı); telefon bunları kuyruktan atar. */
  rejected: { index: number; reason: string }[];
}
