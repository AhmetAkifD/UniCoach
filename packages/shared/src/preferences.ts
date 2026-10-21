import { z } from "zod";
import type { ProgramHistory, ProgramSummary } from "./programs";
import { formatRank, placementCode, RESULT_SCORE_LABELS, type YksScore } from "./yks-result";

/**
 * YKS Tercih listesi: öğrencinin seçtiği programlar, öncelik sırasıyla. Öğrenci istediği programı ekleyebilir;
 * puanına ya da koşullara uymayan programlar engellenmez, yalnızca uyarı gösterilir.
 * Program eklendiği andaki hâliyle de saklanır; indirilmiş veri yenilense ya da program kılavuzdan kalksa da liste bozulmaz.
 */

/** ÖSYM'nin YKS'de izin verdiği en fazla tercih sayısı */
export const PREFERENCE_MAX = 24;

/** POST /api/preferences — program, kodundan önce indirilmiş veride, yoksa canlı YÖK Atlas'ta aranır. */
export const addPreferenceSchema = z.object({ code: z.number().int().positive() });

/** PUT /api/preferences/order — listedeki tüm kodlar, yeni sırasıyla */
export const reorderPreferencesSchema = z.object({
  codes: z
    .array(z.number().int().positive())
    .max(PREFERENCE_MAX)
    .refine((codes) => new Set(codes).size === codes.length, { error: "Bir program iki kez yer alamaz." }),
});

export type AddPreferenceInput = z.infer<typeof addPreferenceSchema>;
export type ReorderPreferencesInput = z.infer<typeof reorderPreferencesSchema>;

export interface PreferenceItem {
  /** 1'den başlar */
  position: number;
  program: ProgramSummary;
  addedAt: string;
}

export type WarningTone = "warning" | "danger";

export interface PreferenceWarning {
  tone: WarningTone;
  text: string;
}

/** Programın bütün yılları (en yeni önce): kılavuz yılı ve önceki üç yıl */
export function programYears(program: Pick<ProgramSummary, "year" | "quota" | "minScore" | "rank" | "history">): ProgramHistory[] {
  return [{ year: program.year, quota: program.quota, minScore: program.minScore, rank: program.rank }, ...program.history].sort(
    (a, b) => b.year - a.year,
  );
}

/**
 * Karşılaştırmada kullanılacak yıl: öğrencinin sonuç yılına en yakın, taban sırası olan yıl (eşitlikte yenisi).
 * Sonuç yılı bilinmiyorsa en yeni yıl.
 */
export function comparisonYear(
  program: Pick<ProgramSummary, "year" | "quota" | "minScore" | "rank" | "history">,
  resultYear: number | null,
): ProgramHistory | null {
  const years = programYears(program).filter((y) => y.rank !== null);
  if (!years.length) return null;
  if (resultYear === null) return years[0]!;
  return years.reduce((best, y) => (Math.abs(y.year - resultYear) < Math.abs(best.year - resultYear) ? y : best));
}

export interface RankComparison {
  tone: "success" | WarningTone;
  label: string;
  /** Karşılaştırılan yıl; sıra şartında null */
  year: number | null;
}

/** Öğrencinin sırasını, sonuç yılına en yakın yılın taban sırasıyla karşılaştırır (ipucu). */
export function rankComparison(
  studentRank: number | null | undefined,
  program: ProgramSummary,
  resultYear: number | null,
): RankComparison | null {
  if (!studentRank) return null;
  if (program.minRankRequired && studentRank > program.minRankRequired) {
    return { tone: "danger", label: "Sıra şartını sağlamıyor", year: null };
  }
  const ref = comparisonYear(program, resultYear);
  if (!ref?.rank) return null;
  const ratio = studentRank / ref.rank;
  if (ratio <= 0.9) return { tone: "success", label: "Sıran yetiyor", year: ref.year };
  if (ratio <= 1.1) return { tone: "warning", label: "Sınırda", year: ref.year };
  return { tone: "danger", label: "Sıran gerisinde", year: ref.year };
}

/** Programın öğrenciye uymayan yanları; boşsa uyarı yok. Hiçbiri eklemeyi engellemez. */
export function preferenceWarnings(
  program: ProgramSummary,
  scores: YksScore[] | null,
  resultYear: number | null,
): PreferenceWarning[] {
  const warnings: PreferenceWarning[] = [];
  const name = program.name.toLocaleUpperCase("tr-TR");
  if (name.includes("KKTC UYRUKLU")) {
    warnings.push({ tone: "danger", text: "Bu kontenjan yalnızca KKTC uyruklu adaylar içindir." });
  }
  if (name.includes("M.T.O.K.")) {
    warnings.push({
      tone: "warning",
      text: "Bu kontenjan mesleki ve teknik Anadolu lisesi mezunları içindir (M.T.O.K.); alan şartını kılavuzdan kontrol et.",
    });
  }
  if (!scores) return warnings;

  const score = scores.find((s) => s.type === program.scoreType);
  const code = placementCode(program.scoreType);
  if (!score?.placementRank || score.placementScore === null) {
    warnings.push({
      tone: "danger",
      text: `Bu program ${RESULT_SCORE_LABELS[program.scoreType]} (${code}) puanıyla öğrenci alıyor; bu puan türünde yerleştirme puanın yok.`,
    });
    return warnings;
  }
  if (program.minRankRequired && score.placementRank > program.minRankRequired) {
    warnings.push({
      tone: "danger",
      text: `Bu programı tercih edebilmek için ${code} başarı sıran en fazla ${formatRank(program.minRankRequired)} olmalı; seninki ${formatRank(score.placementRank)}.`,
    });
  }
  const ref = comparisonYear(program, resultYear);
  const cmp = rankComparison(score.placementRank, { ...program, minRankRequired: null }, resultYear);
  if (ref?.rank && (cmp?.tone === "danger" || cmp?.tone === "warning")) {
    const mine = `${resultYear ?? ""} ${code} sıran (${formatRank(score.placementRank)})`.trim();
    const theirs = `programın ${ref.year} taban sırası${cmp.tone === "danger" ? "nın" : "na"} (${formatRank(ref.rank)})`;
    warnings.push({
      tone: "warning",
      text: cmp.tone === "danger" ? `${mine} ${theirs} gerisinde.` : `${mine} ${theirs} çok yakın; sınırda.`,
    });
  }
  return warnings;
}
