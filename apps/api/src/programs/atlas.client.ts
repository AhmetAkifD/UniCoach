import { BadGatewayException } from "@nestjs/common";
import {
  ATLAS_SCORE_TYPE,
  RESULT_SCORE_TYPES,
  type ProgramHistory,
  type ProgramLevel,
  type ProgramSearchInput,
  type ProgramSummary,
  type ResultScoreType,
  type UniversityType,
} from "@unicoach/shared";

/**
 * YÖK Atlas tercih kılavuzu API'si (yokatlas.yok.gov.tr sitesinin kendi arayüzünün kullandığı uçlar).
 * Resmî, belgelenmiş bir API değildir; alan adları değişirse yalnızca bu dosya güncellenir.
 */
const BASE_URL = process.env.YOK_ATLAS_URL ?? "https://yokatlas.yok.gov.tr/api";
const TIMEOUT_MS = 60_000;

/** Kılavuzdaki bir program satırı (kullandığımız alanlar) */
export interface AtlasRow {
  yil: number;
  kilavuzKodu: number;
  universiteId: number;
  universiteAdi: string;
  universiteTuru: string;
  ilKodu?: number | null;
  ilAdi?: string | null;
  fymkAdi?: string | null;
  birimAdi: string;
  birimGrupId?: number | null;
  birimGrupAdi?: string | null;
  birimTuruId: number;
  /** Özel yetenek gibi puansız programlarda boş */
  puanTuru?: string | null;
  ogrenimDiliAdi?: string | null;
  ogrenimTuruId?: number | null;
  ogrenimTuruAdi?: string | null;
  bursOraniId?: number | null;
  bursOraniAdi?: string | null;
  ogrenimSuresi?: number | null;
  kontenjan?: number | null;
  minPuan?: number | string | null;
  basariSirasi?: number | string | null;
  gk1?: number | null;
  minPuan1?: number | string | null;
  basariSirasi1?: number | string | null;
  gk2?: number | null;
  minPuan2?: number | string | null;
  basariSirasi2?: number | string | null;
  gk3?: number | null;
  minPuan3?: number | string | null;
  basariSirasi3?: number | string | null;
  minBasariSirasi?: string | null;
  ucret?: number | null;
  kosul?: string | null;
  kosulList?: Record<string, string>[];
}

export interface AtlasPage {
  content: AtlasRow[];
  totalElements: number;
  yil: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new BadGatewayException("YÖK Atlas'a ulaşılamadı. İnternet bağlantısını kontrol et ya da indirilmiş veriyi kullan.");
  }
  if (!res.ok) throw new BadGatewayException(`YÖK Atlas yanıt vermedi (${res.status}).`);
  return (await res.json()) as T;
}

/** Sitenin filtre gövdesi; boş filtre tüm programları getirir. */
export function atlasSearch(input: Partial<ProgramSearchInput> & { page: number; size: number }) {
  return request<AtlasPage>("/tercih-kilavuz/search", {
    method: "POST",
    body: JSON.stringify({
      filters: {
        puanTuru: input.scoreType ? ATLAS_SCORE_TYPE[input.scoreType] : null,
        universiteId: input.universityIds ?? [],
        birimGrupId: input.groupIds ?? [],
        ilKodu: input.cityCodes ?? [],
        birimTuruId: input.level ? LEVEL_IDS[input.level] : null,
        universiteTuru: input.universityType ? UNIVERSITY_TYPE_TEXT[input.universityType] : null,
        bursOraniId: input.scholarshipId ?? null,
        ogrenimTuruId: input.educationTypeId ?? null,
        kilavuzKodu: null,
        minBasariSirasi: input.minRank ?? null,
        maxBasariSirasi: input.maxRank ?? null,
      },
      page: input.page,
      size: input.size,
      sortBy: "basariSirasi",
      direction: "ASC",
    }),
  });
}

export const atlasUniversities = () =>
  request<{ universiteId: number; universiteAdi: string }[]>("/tercih-kilavuz/universiteler");
export const atlasGroups = () =>
  request<{ birimGrupId: number; birimGrupAdi: string; puanTuru: string }[]>("/tercih-kilavuz/universite-programlar");
export const atlasCities = () => request<{ ilKodu: number; ilAdi: string }[]>("/tercih-kilavuz/universite-iller");

/** "1": yılın sonuçları açıklandı, taban puanlar o yıla aittir; değilse bir önceki yıla. */
export const atlasResultsAnnounced = () =>
  request<string | number | boolean>("/parameters/sonuc-aciklandi").then((v) => String(v) === "1" || v === true);

const LEVEL_IDS: Record<ProgramLevel, number> = { LISANS: 46, ONLISANS: 47 };
const UNIVERSITY_TYPE_TEXT: Record<UniversityType, string> = {
  DEVLET: "DEVLET",
  VAKIF: "VAKIF",
  KKTC: "KKTC",
  YURTDISI: "YURTDIŞI",
};

export function scoreTypeOf(text: string | null | undefined): ResultScoreType | null {
  return RESULT_SCORE_TYPES.find((t) => ATLAS_SCORE_TYPE[t] === text?.trim()) ?? null;
}

function universityTypeOf(text: string): UniversityType {
  const found = (Object.keys(UNIVERSITY_TYPE_TEXT) as UniversityType[]).find((k) => UNIVERSITY_TYPE_TEXT[k] === text);
  return found ?? "DEVLET";
}

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Satırı ortak tipe çevirir. `announced` false ise kılavuz yeni yılındır ama sonuçlar henüz açıklanmamıştır:
 * `minPuan` bir önceki yılın tabanıdır, `minPuan1` iki önceki yılın (sitenin kendi etiketlemesiyle aynı).
 */
export function toProgram(row: AtlasRow, announced: boolean): ProgramSummary | null {
  const scoreType = scoreTypeOf(row.puanTuru);
  if (!scoreType) return null;
  const year = row.yil - (announced ? 0 : 1);
  const history: ProgramHistory[] = ([1, 2, 3] as const).map((k) => ({
    year: year - k,
    quota: row[`gk${k}`] ?? null,
    minScore: num(row[`minPuan${k}`]),
    rank: num(row[`basariSirasi${k}`]),
  }));
  return {
    code: row.kilavuzKodu,
    year,
    universityId: row.universiteId,
    universityName: row.universiteAdi,
    universityType: universityTypeOf(row.universiteTuru),
    cityName: row.ilAdi ?? null,
    faculty: row.fymkAdi ?? null,
    name: row.birimAdi,
    groupId: row.birimGrupId ?? null,
    groupName: row.birimGrupAdi ?? row.birimAdi,
    level: row.birimTuruId === LEVEL_IDS.ONLISANS ? "ONLISANS" : "LISANS",
    scoreType,
    language: row.ogrenimDiliAdi ?? null,
    educationType: row.ogrenimTuruAdi ?? null,
    scholarship: row.bursOraniAdi ?? null,
    durationYears: row.ogrenimSuresi ?? null,
    quota: row.kontenjan ?? null,
    minScore: num(row.minPuan),
    rank: num(row.basariSirasi),
    history,
    minRankRequired: num(row.minBasariSirasi),
    fee: row.ucret ?? null,
  };
}
