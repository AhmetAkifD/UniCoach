import { z } from "zod";
import { SUBJECT_IDS } from "./library";

/**
 * Soru Bankası: öğrencinin yüklediği soru kitabı PDF'leri (soru deposu).
 * Ders (sabit liste) + isteğe bağlı serbest konu etiketi. Soru çözme ve doğru/yanlış hesabı burada değil,
 * ileride "Çalışma alanı" modülünde yapılır. PDF'ler yalnızca yükleyen öğrenciye görünür.
 */

/** Bir PDF en fazla 300 MB olabilir. */
export const BOOK_MAX_BYTES = 300 * 1024 * 1024;

const title = z
  .string({ error: "Bir ad yaz." })
  .trim()
  .min(1, { error: "Ad boş olamaz." })
  .max(120, { error: "Ad en fazla 120 karakter olabilir." });

const topic = z
  .string()
  .trim()
  .max(60, { error: "Konu en fazla 60 karakter olabilir." })
  .transform((v) => v || null)
  .nullable();

/**
 * Soru bulma yöntemi: otomatik (metin varsa metinden, yoksa OCR), yalnızca metin katmanı ya da yalnızca OCR.
 * Cevap anahtarının yeri yayınevine göre değişir: son sayfalar (ÖSYM), her sayfanın altı ya da hiç.
 * Öğrenci her PDF için seçer.
 */
export const DETECT_METHODS = ["auto", "text", "ocr"] as const;
export type DetectMethod = (typeof DETECT_METHODS)[number];
export const DETECT_METHOD_LABELS: Record<DetectMethod, string> = {
  auto: "Otomatik",
  text: "PDF'teki metinden",
  ocr: "Metin tanıma (taranmış)",
};

export const ANSWER_KEY_METHODS = ["auto", "lastPages", "pageBottom", "none"] as const;
export type AnswerKeyMethod = (typeof ANSWER_KEY_METHODS)[number];
export const ANSWER_KEY_METHOD_LABELS: Record<AnswerKeyMethod, string> = {
  auto: "Otomatik",
  lastPages: "Ayrı cevap anahtarı sayfası (ÖSYM)",
  pageBottom: "Her sayfanın altında",
  none: "Yok, elle gireceğim",
};

/** POST /api/books — önce kayıt açılır, dosya ardından PUT /api/books/:id/file ile gönderilir. */
export const createBookSchema = z.object({
  subject: z.enum(SUBJECT_IDS, { error: "Bir ders seç." }),
  title,
  topic: topic.optional(),
  sizeBytes: z
    .number()
    .int()
    .min(1, { error: "Dosya boş." })
    .max(BOOK_MAX_BYTES, { error: "PDF en fazla 300 MB olabilir." }),
});

/** PATCH /api/books/:id */
export const updateBookSchema = z
  .object({
    title: title.optional(),
    subject: z.enum(SUBJECT_IDS, { error: "Bir ders seç." }).optional(),
    topic: topic.optional(),
    detectMethod: z.enum(DETECT_METHODS).optional(),
    keyMethod: z.enum(ANSWER_KEY_METHODS).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { error: "Değişiklik yok." });

/** PUT /api/books/:id/progress — görüntüleyici kalınan sayfayı ve toplam sayfa sayısını bildirir. */
export const bookProgressSchema = z.object({
  page: z.number().int().min(1).max(100_000),
  pageCount: z.number().int().min(1).max(100_000).optional(),
});

export type CreateBookInput = z.input<typeof createBookSchema>;
export type UpdateBookInput = z.input<typeof updateBookSchema>;
export type BookProgressInput = z.infer<typeof bookProgressSchema>;

export interface BookSummary {
  id: string;
  subject: string;
  title: string;
  topic: string | null;
  sizeBytes: number;
  /** PDF ilk kez açılınca öğrenilir. */
  pageCount: number | null;
  /** Kalınan sayfa (1'den başlar). */
  lastPage: number;
  /** PDF'ten çıkarılmış soru sayısı. */
  questionCount: number;
  detectMethod: DetectMethod;
  keyMethod: AnswerKeyMethod;
  createdAt: string;
  updatedAt: string;
}

const topicCollator = new Intl.Collator("tr-TR", { sensitivity: "base", numeric: true });

/** Önceden kullanılan konu etiketleri, alfabetik (yükleme ve düzenlemede öneri olarak). */
export function bookTopics(books: Pick<BookSummary, "topic">[]): string[] {
  return [...new Set(books.flatMap((b) => (b.topic ? [b.topic] : [])))].sort(topicCollator.compare);
}

/** Dersin PDF'leri konu etiketine göre ayrılır; konusuzlar en sonda. Hiç konu yoksa tek grup döner. */
export function groupByTopic<T extends Pick<BookSummary, "topic">>(books: T[]): [string | null, T[]][] {
  const topics = new Map<string | null, T[]>();
  for (const book of books) topics.set(book.topic, [...(topics.get(book.topic) ?? []), book]);
  return [...topics.entries()].sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : topicCollator.compare(a, b)));
}

/** Bayt → "148,6 MB" (1024 tabanı). */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toLocaleString("tr-TR", { maximumFractionDigits: digits, minimumFractionDigits: digits })} ${units[unit]}`;
}

/**
 * PDF'ten çıkarılan sorular. Sorunun metni değil, sayfadaki yeri saklanır; soru gösterilirken o bölge
 * PDF'ten resim olarak çizilir (formül ve şekiller bozulmaz). Koordinatlar PDF noktası (1:1 ölçekte
 * sayfanın sol üstünden), şık metinleri yalnızca öneridir (metin katmanı ya da OCR'dan gelir, öğrenci düzeltir).
 */
export const CHOICE_LETTERS = ["A", "B", "C", "D", "E"] as const;
export type ChoiceLetter = (typeof CHOICE_LETTERS)[number];
/** Bir PDF'ten en fazla bu kadar soru çıkarılabilir. */
export const BOOK_QUESTIONS_MAX = 3000;

export const bookQuestionSchema = z.object({
  /** Kayıtlı sorunun kimliği; yeni soruda yok. Kimlik korunur ki sınavlardaki bağlantılar kopmasın. */
  id: z.string().min(1).optional(),
  /** Test/bölüm adı, ör. "Temel Matematik Testi" ya da "Test 3"; numaralar bölüm içinde tekildir. */
  section: z.string().trim().min(1, { error: "Test adı boş olamaz." }).max(60, { error: "Test adı en fazla 60 karakter olabilir." }),
  number: z.number().int().min(1).max(999),
  page: z.number().int().min(1).max(100_000),
  x: z.number().min(0).max(10_000),
  y: z.number().min(0).max(10_000),
  w: z.number().min(1).max(10_000),
  h: z.number().min(1).max(10_000),
  /** YKS'de 5, LGS'de 4 şık */
  choiceCount: z.number().int().min(2).max(5),
  answer: z.enum(CHOICE_LETTERS).nullable(),
  choices: z.array(z.string().max(500)).max(5),
});

/** PUT /api/books/:id/questions — PDF'in tüm soruları tek seferde kaydedilir (düzenleyici hepsini gönderir). */
export const saveBookQuestionsSchema = z
  .object({ questions: z.array(bookQuestionSchema).max(BOOK_QUESTIONS_MAX) })
  .superRefine(({ questions }, ctx) => {
    const seen = new Set<string>();
    for (const [i, q] of questions.entries()) {
      const key = `${q.section.toLocaleLowerCase("tr-TR")}#${q.number}`;
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", path: ["questions", i], message: `"${q.section}" testinde ${q.number}. soru iki kez var.` });
      }
      seen.add(key);
    }
  });

export type BookQuestionInput = z.infer<typeof bookQuestionSchema>;
export type SaveBookQuestionsInput = z.infer<typeof saveBookQuestionsSchema>;

export interface BookQuestion extends Omit<BookQuestionInput, "id"> {
  id: string;
}
