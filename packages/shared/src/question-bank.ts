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
  .object({ title: title.optional(), subject: z.enum(SUBJECT_IDS, { error: "Bir ders seç." }).optional(), topic: topic.optional() })
  .refine((v) => v.title !== undefined || v.subject !== undefined || v.topic !== undefined, { error: "Değişiklik yok." });

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
  createdAt: string;
  updatedAt: string;
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
