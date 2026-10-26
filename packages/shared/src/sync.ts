import type { ProgramSummary } from "./programs";
import type { NotePageContent } from "./notebooks";
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
