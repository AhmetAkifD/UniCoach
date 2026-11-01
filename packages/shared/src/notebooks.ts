import { z } from "zod";

/**
 * Çalışma alanı: öğrencinin not defterleri. Defter sayfalardan oluşur; sayfa içeriği kalem/marker çizgileri ve
 * klavyeyle yazılmış metin kutularıdır. Koordinatlar ekran boyutundan bağımsız, sabit bir sayfa düzlemindedir
 * (`NOTE_PAGE_WIDTH` × `NOTE_PAGE_HEIGHT`, A4 oranı); çizerken ekran genişliğine ölçeklenir.
 */

export const NOTE_PAGE_WIDTH = 1000;
export const NOTE_PAGE_HEIGHT = 1414;
/** Bir defterde en fazla sayfa */
export const NOTEBOOK_MAX_PAGES = 200;

export const NOTE_TOOLS = ["pen", "marker"] as const;
export type NoteTool = (typeof NOTE_TOOLS)[number];

/** Kalem ve marker renkleri (mürekkep; sayfa her temada beyaz kâğıttır, renkler de temadan bağımsızdır). */
export const NOTE_PEN_COLORS = [
  { value: "#1f2937", label: "Siyah" },
  { value: "#2563eb", label: "Mavi" },
  { value: "#dc2626", label: "Kırmızı" },
  { value: "#16a34a", label: "Yeşil" },
] as const;
export const NOTE_MARKER_COLORS = [
  { value: "#facc15", label: "Sarı" },
  { value: "#4ade80", label: "Yeşil" },
  { value: "#f472b6", label: "Pembe" },
  { value: "#60a5fa", label: "Mavi" },
] as const;
/** Kalem kalınlıkları (sayfa birimi) */
export const NOTE_PEN_WIDTHS = [2, 4, 8] as const;
export const NOTE_MARKER_WIDTH = 24;
export const NOTE_TEXT_SIZES = [20, 28, 40] as const;

const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const coord = z.number().min(-50).max(Math.max(NOTE_PAGE_WIDTH, NOTE_PAGE_HEIGHT) + 50);

export const noteStrokeSchema = z.object({
  id: z.string().min(1).max(40),
  tool: z.enum(NOTE_TOOLS),
  color,
  width: z.number().min(0.5).max(80),
  /** Düz dizi: x1, y1, x2, y2… */
  points: z.array(coord).min(2).max(8000),
});

export const noteTextSchema = z.object({
  id: z.string().min(1).max(40),
  x: coord,
  y: coord,
  /** Kutunun genişliği (sayfa birimi) */
  w: z.number().min(40).max(NOTE_PAGE_WIDTH),
  text: z.string().max(4000),
  color,
  size: z.number().min(8).max(120),
});

export const notePageContentSchema = z.object({
  strokes: z.array(noteStrokeSchema).max(5000),
  texts: z.array(noteTextSchema).max(500),
});

export type NoteStroke = z.infer<typeof noteStrokeSchema>;
export type NoteText = z.infer<typeof noteTextSchema>;
export type NotePageContent = z.infer<typeof notePageContentSchema>;

export const EMPTY_NOTE_PAGE: NotePageContent = { strokes: [], texts: [] };

const title = z.string().trim().min(1, { error: "Deftere bir ad ver." }).max(80, { error: "Ad en fazla 80 karakter olabilir." });

/** POST /api/notebooks, PATCH /api/notebooks/:id */
export const notebookInputSchema = z.object({ title });
/** POST /api/notebooks/:id/pages — boşsa en sona eklenir */
export const addNotePageSchema = z.object({ afterPageId: z.string().min(1).nullable() });
/**
 * Sayfadaki değişiklik: eklenen ya da değişen çizgi/metin kutuları (kimliğiyle) ve silinenlerin kimlikleri.
 * Kayıtlar bu farkla yapılır, sunucu farkı kendi elindeki sayfaya uygular: iki cihazda aynı sayfaya yazılsa da
 * ikisinin çizdikleri korunur, yalnızca gerçekten silinenler silinir (kullanıcı kararı: notlar birleştirilir).
 */
export const notePageDiffSchema = z.object({
  strokes: z.array(noteStrokeSchema).max(5000),
  texts: z.array(noteTextSchema).max(500),
  deleted: z.array(z.string().min(1).max(40)).max(5500),
});
export type NotePageDiff = z.infer<typeof notePageDiffSchema>;

export const EMPTY_NOTE_DIFF: NotePageDiff = { strokes: [], texts: [], deleted: [] };

/** `base`ten `next`e fark: yeni ya da değişmiş öğeler ve `base`te olup `next`te olmayanlar. */
export function notePageDiff(base: NotePageContent, next: NotePageContent): NotePageDiff {
  const changed = <T extends { id: string }>(before: T[], after: T[]) => {
    const old = new Map(before.map((item) => [item.id, JSON.stringify(item)]));
    return after.filter((item) => old.get(item.id) !== JSON.stringify(item));
  };
  const kept = new Set([...next.strokes, ...next.texts].map((item) => item.id));
  return {
    strokes: changed(base.strokes, next.strokes),
    texts: changed(base.texts, next.texts),
    deleted: [...base.strokes, ...base.texts].filter((item) => !kept.has(item.id)).map((item) => item.id),
  };
}

export const isEmptyNoteDiff = (diff: NotePageDiff) => !diff.strokes.length && !diff.texts.length && !diff.deleted.length;

/** Farkı sayfaya uygular: silinenler çıkar, var olan öğe yerinde güncellenir, yenisi sona eklenir (çizim sırası korunur). */
export function applyNotePageDiff(content: NotePageContent, diff: NotePageDiff): NotePageContent {
  const deleted = new Set(diff.deleted);
  const upsert = <T extends { id: string }>(list: T[], changes: T[]) => {
    const byId = new Map(changes.map((item) => [item.id, item]));
    const out = list.filter((item) => !deleted.has(item.id)).map((item) => byId.get(item.id) ?? item);
    const present = new Set(out.map((item) => item.id));
    return [...out, ...changes.filter((item) => !present.has(item.id) && !deleted.has(item.id))];
  };
  return { strokes: upsert(content.strokes, diff.strokes), texts: upsert(content.texts, diff.texts) };
}

/** Art arda iki fark tek farka (önce `a`, sonra `b`): gönderilmeyi bekleyen kayıtlar birleşir. */
export function mergeNoteDiffs(a: NotePageDiff, b: NotePageDiff): NotePageDiff {
  const removed = new Set(b.deleted);
  const upsert = <T extends { id: string }>(first: T[], second: T[]) => {
    const byId = new Map(first.filter((item) => !removed.has(item.id)).map((item) => [item.id, item]));
    for (const item of second) byId.set(item.id, item);
    return [...byId.values()];
  };
  const added = new Set([...b.strokes, ...b.texts].map((item) => item.id));
  return {
    strokes: upsert(a.strokes, b.strokes),
    texts: upsert(a.texts, b.texts),
    deleted: [...new Set([...a.deleted.filter((id) => !added.has(id)), ...b.deleted])],
  };
}

/**
 * PUT /api/notebooks/:id/pages/:pageId — ya bütün sayfa (`content`, üzerine yazar) ya da fark (`diff`, sunucudaki
 * sayfayla birleşir). Web ve mobil fark gönderir.
 */
export const saveNotePageSchema = z
  .object({ content: notePageContentSchema.optional(), diff: notePageDiffSchema.optional() })
  .refine((v) => (v.content ? 1 : 0) + (v.diff ? 1 : 0) === 1, { error: "Sayfa ya da fark gönderilmeli." });

export type NotebookInput = z.infer<typeof notebookInputSchema>;
export type AddNotePageInput = z.infer<typeof addNotePageSchema>;
export type SaveNotePageInput = z.infer<typeof saveNotePageSchema>;

export interface NotebookSummary {
  id: string;
  title: string;
  pageCount: number;
  updatedAt: string;
}

export interface NotePageRef {
  id: string;
  /** 1'den başlar */
  position: number;
  updatedAt: string;
}

export interface NotebookDetail extends NotebookSummary {
  pages: NotePageRef[];
}

export interface NotePage extends NotePageRef {
  content: NotePageContent;
}
