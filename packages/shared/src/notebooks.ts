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
/** PUT /api/notebooks/:id/pages/:pageId */
export const saveNotePageSchema = z.object({ content: notePageContentSchema });

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
