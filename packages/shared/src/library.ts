import { z } from "zod";

/**
 * Konu Anlatımı: öğrencinin kendi YouTube kütüphanesi.
 * Ders (sabit liste) → kaynak grubu (eklenen her video/oynatma listesi) → videolar (YouTube sırasıyla).
 * Resmî müfredat veya konu bölümü yoktur; kaynaklar yalnızca ekleyen öğrenciye görünür.
 */

/** Öğrencinin hazırlandığı sınav. Kayıtta seçilir, profilden değiştirilir. */
export const EXAM_TRACKS = ["YKS", "LGS"] as const;
export type ExamTrack = (typeof EXAM_TRACKS)[number];

export const EXAM_TRACK_LABELS: Record<ExamTrack, string> = {
  YKS: "YKS",
  LGS: "LGS",
};

/** Sınav oturumu — Konu Anlatımı'ndaki ilk filtre satırı. YDT yalnızca YKS Dil'e hazırlananlar içindir. */
export const SUBJECT_EXAMS = ["TYT", "AYT", "YDT", "LGS"] as const;
export type SubjectExam = (typeof SUBJECT_EXAMS)[number];

export interface Subject {
  id: string;
  /** Tam ad, ör. "AYT Fizik" */
  label: string;
  track: ExamTrack;
  exam: SubjectExam;
  /** Sınavdan bağımsız ders anahtarı ve adı (ikinci filtre satırı): "tyt-fizik" ve "ayt-fizik" → "fizik" */
  ders: string;
  dersLabel: string;
  /** @unicoach/design → subjectColors anahtarı */
  color: string;
}

/** "tyt-matematik" + "TYT Matematik" → sınav, ders anahtarı ve ders adı türetilir. */
function subject(id: string, label: string, track: ExamTrack, color: string, dersLabel?: string): Subject {
  const [prefix, ders] = id.split("-") as [string, string];
  return {
    id,
    label,
    track,
    exam: prefix.toUpperCase() as SubjectExam,
    ders,
    dersLabel: dersLabel ?? label.slice(prefix.length + 1),
    color,
  };
}

/** Sabit ders listesi (yalnızca ders adları). YKS'de TYT ve AYT dersleri ayrıdır. */
export const SUBJECTS: Subject[] = [
  subject("tyt-turkce", "TYT Türkçe", "YKS", "turkce"),
  subject("tyt-matematik", "TYT Matematik", "YKS", "matematik"),
  subject("tyt-geometri", "TYT Geometri", "YKS", "geometri"),
  subject("tyt-fizik", "TYT Fizik", "YKS", "fizik"),
  subject("tyt-kimya", "TYT Kimya", "YKS", "kimya"),
  subject("tyt-biyoloji", "TYT Biyoloji", "YKS", "biyoloji"),
  subject("tyt-tarih", "TYT Tarih", "YKS", "tarih"),
  subject("tyt-cografya", "TYT Coğrafya", "YKS", "cografya"),
  subject("tyt-felsefe", "TYT Felsefe", "YKS", "felsefe"),
  subject("tyt-din", "TYT Din Kültürü", "YKS", "din"),
  subject("ayt-matematik", "AYT Matematik", "YKS", "matematik"),
  subject("ayt-geometri", "AYT Geometri", "YKS", "geometri"),
  subject("ayt-fizik", "AYT Fizik", "YKS", "fizik"),
  subject("ayt-kimya", "AYT Kimya", "YKS", "kimya"),
  subject("ayt-biyoloji", "AYT Biyoloji", "YKS", "biyoloji"),
  subject("ayt-edebiyat", "AYT Türk Dili ve Edebiyatı", "YKS", "edebiyat", "Edebiyat"),
  subject("ayt-tarih", "AYT Tarih", "YKS", "tarih"),
  subject("ayt-cografya", "AYT Coğrafya", "YKS", "cografya"),
  subject("ayt-felsefe", "AYT Felsefe Grubu", "YKS", "felsefe", "Felsefe"),
  subject("ayt-din", "AYT Din Kültürü", "YKS", "din"),
  subject("ydt-ingilizce", "YDT İngilizce", "YKS", "ingilizce"),
  subject("lgs-turkce", "LGS Türkçe", "LGS", "turkce"),
  subject("lgs-matematik", "LGS Matematik", "LGS", "matematik"),
  subject("lgs-fen", "LGS Fen Bilimleri", "LGS", "fen", "Fen Bilimleri"),
  subject("lgs-inkilap", "LGS İnkılap Tarihi", "LGS", "inkilap", "İnkılap Tarihi"),
  subject("lgs-din", "LGS Din Kültürü", "LGS", "din"),
  subject("lgs-ingilizce", "LGS İngilizce", "LGS", "ingilizce"),
];

export const SUBJECT_IDS = SUBJECTS.map((s) => s.id) as [string, ...string[]];

export function findSubject(id: string): Subject | undefined {
  return SUBJECTS.find((s) => s.id === id);
}

/** YouTube'un gömülü oynatıcısı getPlaylist() ile en fazla bu kadar video döndürür. */
export const PLAYLIST_MAX_ITEMS = 200;
/** Videonun bu oranı izlenince "izlendi" sayılır (bitiş ekranını beklemeyenler için). */
export const WATCHED_THRESHOLD = 0.9;

export const SOURCE_KINDS = ["VIDEO", "PLAYLIST"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

const VIDEO_ID = /^[\w-]{11}$/;
const LIST_ID = /^[\w-]{10,64}$/;

export type ParsedYouTubeUrl = { kind: "VIDEO"; videoId: string } | { kind: "PLAYLIST"; listId: string };

/**
 * Yapıştırılan YouTube bağlantısını çözer. Liste parametresi varsa oynatma listesi kabul edilir;
 * YouTube'un otomatik "mix" listeleri (RD…) sonsuz olduğu için tek video sayılır.
 */
export function parseYouTubeUrl(input: string): ParsedYouTubeUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim().replace(/^(?!https?:\/\/)/, "https://"));
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let videoId: string | null = null;
  if (host === "youtu.be") {
    videoId = url.pathname.slice(1).split("/")[0] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, first, second] = url.pathname.split("/");
    if (first === "watch") videoId = url.searchParams.get("v");
    else if (first === "shorts" || first === "embed" || first === "live") videoId = second ?? null;
    else if (first !== "playlist") return null;
  } else {
    return null;
  }

  const listId = url.searchParams.get("list");
  if (listId && LIST_ID.test(listId) && !listId.startsWith("RD")) return { kind: "PLAYLIST", listId };
  if (videoId && VIDEO_ID.test(videoId)) return { kind: "VIDEO", videoId };
  return null;
}

/** POST /api/sources — oynatma listesinde video ID'leri tarayıcıda getPlaylist() ile alınıp gönderilir. */
export const createSourceSchema = z
  .object({
    subject: z.enum(SUBJECT_IDS, { error: "Bir ders seç." }),
    kind: z.enum(SOURCE_KINDS),
    youtubeId: z.string().trim(),
    videoIds: z.array(z.string().regex(VIDEO_ID)).max(PLAYLIST_MAX_ITEMS).optional(),
  })
  .superRefine((v, ctx) => {
    const idOk = v.kind === "VIDEO" ? VIDEO_ID.test(v.youtubeId) : LIST_ID.test(v.youtubeId);
    if (!idOk) ctx.addIssue({ code: "custom", path: ["youtubeId"], message: "Geçerli bir YouTube bağlantısı yapıştır." });
    if (v.kind === "PLAYLIST" && !v.videoIds?.length) {
      ctx.addIssue({ code: "custom", path: ["youtubeId"], message: "Oynatma listesindeki videolar alınamadı." });
    }
  });

/** PATCH /api/sources/:id */
export const updateSourceSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, { error: "Grup adı boş olamaz." })
      .max(120, { error: "Grup adı en fazla 120 karakter olabilir." })
      .optional(),
    subject: z.enum(SUBJECT_IDS, { error: "Bir ders seç." }).optional(),
  })
  .refine((v) => v.title !== undefined || v.subject !== undefined, { error: "Değişiklik yok." });

/** PUT /api/sources/:id/items/:itemId/progress */
export const progressSchema = z.object({
  positionSec: z.number().int().min(0).max(24 * 3600),
  durationSec: z.number().int().min(1).max(24 * 3600).optional(),
  watched: z.boolean().optional(),
});

/** PATCH /api/auth/me */
export const updateProfileSchema = z.object({
  examTrack: z.enum(EXAM_TRACKS, { error: "YKS veya LGS seç." }),
});

export type CreateSourceInput = z.infer<typeof createSourceSchema>;
export type UpdateSourceInput = z.infer<typeof updateSourceSchema>;
export type ProgressInput = z.infer<typeof progressSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface SourceSummary {
  id: string;
  subject: string;
  kind: SourceKind;
  youtubeId: string;
  title: string;
  author: string | null;
  thumbnailUrl: string | null;
  itemCount: number;
  watchedCount: number;
  /** Liste 200 videoda kesilmiş olabilir. */
  truncated: boolean;
  createdAt: string;
}

export interface SourceItem {
  id: string;
  position: number;
  videoId: string;
  title: string;
  durationSec: number | null;
  positionSec: number;
  watchedAt: string | null;
}

export interface SourceDetail extends SourceSummary {
  items: SourceItem[];
}
