import { z } from "zod";
import { RESULT_SCORE_CODES, RESULT_SCORE_TYPES, type ResultScoreType, type YksResult } from "./yks-result";

/**
 * YKS Tercih: üniversite programları (taban puan, başarı sırası, kontenjan). Kaynak YÖK Atlas'ın tercih kılavuzu
 * API'sidir. Veri iki yoldan okunur: API'nin kendi veritabanına indirdiği kopya ("local") ya da her aramada
 * YÖK Atlas'a sorulan güncel veri ("live"). İki yol aynı filtreleri alır, aynı yanıtı döndürür.
 */

export const PROGRAM_SOURCES = ["local", "live"] as const;
export type ProgramSource = (typeof PROGRAM_SOURCES)[number];

export const PROGRAM_LEVELS = ["LISANS", "ONLISANS"] as const;
export type ProgramLevel = (typeof PROGRAM_LEVELS)[number];
export const PROGRAM_LEVEL_LABELS: Record<ProgramLevel, string> = { LISANS: "Lisans", ONLISANS: "Önlisans" };

export const UNIVERSITY_TYPES = ["DEVLET", "VAKIF", "KKTC", "YURTDISI"] as const;
export type UniversityType = (typeof UNIVERSITY_TYPES)[number];
export const UNIVERSITY_TYPE_LABELS: Record<UniversityType, string> = {
  DEVLET: "Devlet",
  VAKIF: "Vakıf",
  KKTC: "KKTC",
  YURTDISI: "Yurt dışı",
};

/** YÖK Atlas burs kimlikleri; 0: devlet üniversitesi (ücretsiz) */
export const SCHOLARSHIPS = [
  { id: 0, label: "Ücretsiz (devlet)" },
  { id: 158, label: "Burslu" },
  { id: 156, label: "%50 İndirimli" },
  { id: 155, label: "%25 İndirimli" },
  { id: 154, label: "Ücretli" },
] as const;

/** YÖK Atlas öğretim türü kimlikleri */
export const EDUCATION_TYPES = [
  { id: 86, label: "Örgün Öğretim" },
  { id: 182, label: "Uzaktan Öğretim" },
  { id: 203, label: "Açık Öğretim" },
] as const;

export const PROGRAM_PAGE_MAX = 100;

const ids = z.array(z.number().int().nonnegative()).max(200);

/** POST /api/programs/search */
export const programSearchSchema = z
  .object({
    source: z.enum(PROGRAM_SOURCES),
    scoreType: z.enum(RESULT_SCORE_TYPES).nullable(),
    universityIds: ids,
    groupIds: ids,
    cityCodes: ids,
    level: z.enum(PROGRAM_LEVELS).nullable(),
    universityType: z.enum(UNIVERSITY_TYPES).nullable(),
    scholarshipId: z.number().int().nonnegative().nullable(),
    educationTypeId: z.number().int().nonnegative().nullable(),
    minRank: z.number().int().min(1).nullable(),
    maxRank: z.number().int().min(1).nullable(),
    page: z.number().int().min(0).max(10_000),
    size: z.number().int().min(1).max(PROGRAM_PAGE_MAX),
  })
  .refine((f) => f.minRank === null || f.maxRank === null || f.minRank <= f.maxRank, {
    error: "En iyi sıra, en kötü sıradan büyük olamaz.",
    path: ["minRank"],
  });

export type ProgramSearchInput = z.infer<typeof programSearchSchema>;

/** Önceki yılın taban puanı/başarı sırası; yerleşen olmadıysa null */
export interface ProgramHistory {
  year: number;
  quota: number | null;
  minScore: number | null;
  rank: number | null;
}

export interface ProgramSummary {
  /** ÖSYM program kodu (kılavuz kodu) */
  code: number;
  /** Taban puan ve sıranın yılı */
  year: number;
  universityId: number;
  universityName: string;
  universityType: UniversityType;
  /** Yurt dışı programlarda boş */
  cityName: string | null;
  faculty: string | null;
  name: string;
  groupId: number | null;
  groupName: string;
  level: ProgramLevel;
  scoreType: ResultScoreType;
  language: string | null;
  educationType: string | null;
  scholarship: string | null;
  durationYears: number | null;
  quota: number | null;
  minScore: number | null;
  rank: number | null;
  history: ProgramHistory[];
  /** Tercih edebilmek için gereken en düşük başarı sırası (ör. tıpta 50.000) */
  minRankRequired: number | null;
  /** Vakıf üniversitelerinde yıllık ücret (TL) */
  fee: number | null;
}

export interface ProgramPage {
  source: ProgramSource;
  items: ProgramSummary[];
  total: number;
  page: number;
  size: number;
}

/** İndirilmiş verinin durumu; hiç indirilmediyse null */
export interface ProgramSnapshot {
  /** Taban puanların yılı */
  year: number;
  count: number;
  syncedAt: string;
}

export interface ProgramFilterOptions {
  universities: { id: number; name: string }[];
  groups: { id: number; name: string; scoreType: ResultScoreType }[];
  cities: { code: number; name: string }[];
  snapshot: ProgramSnapshot | null;
  /** İndirme sürüyorsa true */
  syncing: boolean;
}

/** YÖK Atlas puan türü yazımı ("SÖZ") ↔ bizim kimlik ("SOZ") */
export const ATLAS_SCORE_TYPE: Record<ResultScoreType, string> = { TYT: "TYT", SAY: "SAY", SOZ: "SÖZ", EA: "EA", DIL: "DİL" };

// --- Program arama ekranı (web ve mobil) ---

/** Arama filtreleri (kaynak ve sayfa hariç) */
export type ProgramFilters = Omit<ProgramSearchInput, "source" | "page" | "size">;

export const EMPTY_PROGRAM_FILTERS: ProgramFilters = {
  scoreType: null,
  universityIds: [],
  groupIds: [],
  cityCodes: [],
  level: null,
  universityType: null,
  scholarshipId: null,
  educationTypeId: null,
  minRank: null,
  maxRank: null,
};

/** Öğrencinin puan türü başına yerleştirme sırası (en yeni sonucundan); karşılaştırmada kullanılır. */
export function placementRanks(result: Pick<YksResult, "scores"> | null | undefined): Partial<Record<ResultScoreType, number>> {
  const ranks: Partial<Record<ResultScoreType, number>> = {};
  for (const s of result?.scores ?? []) if (s.placementRank) ranks[s.type] = s.placementRank;
  return ranks;
}

/** Aramanın ilk puan türü: TYT dışında sırası olan ilk tür. */
export const defaultProgramScoreType = (ranks: Partial<Record<ResultScoreType, number>>): ResultScoreType | null =>
  RESULT_SCORE_TYPES.filter((t) => t !== "TYT").find((t) => ranks[t]) ?? null;

/** "Sırama yakın olanlar": sıranın %70'i ile %150'si arası */
export const nearRankRange = (rank: number) => ({ minRank: Math.max(1, Math.round(rank * 0.7)), maxRank: Math.round(rank * 1.5) });

/** Program kartındaki ayrıntı satırı: fakülte · şehir · tür · burs · (örgün değilse öğretim türü) · puan türü · kod */
export function programMetaLine(p: ProgramSummary, withEducationType = true): string {
  return [
    p.faculty,
    p.cityName,
    UNIVERSITY_TYPE_LABELS[p.universityType],
    p.scholarship,
    withEducationType && p.educationType !== "Örgün Öğretim" ? p.educationType : null,
    RESULT_SCORE_CODES[p.scoreType],
    `Kod ${p.code}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Program grupları seçeneği: puan türü seçiliyse yalnızca o türünkiler; değilse adın yanında tür kodu. */
export function programGroupOptions(groups: ProgramFilterOptions["groups"], scoreType: ResultScoreType | null) {
  return groups
    .filter((g) => !scoreType || g.scoreType === scoreType)
    .map((g) => ({ value: g.id, label: scoreType ? g.name : `${g.name} (${RESULT_SCORE_CODES[g.scoreType]})` }))
    .filter((g, i, list) => list.findIndex((x) => x.value === g.value) === i);
}
