/** Desteklenen sınav oturumları. */
export const EXAM_TYPES = ["TYT", "AYT", "LGS"] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

/** Sınav ailesi: tercih modülü yalnızca YKS içindir. */
export type ExamFamily = "YKS" | "LGS";

export interface ExamMeta {
  type: ExamType;
  family: ExamFamily;
  label: string;
  /** Bir sorudaki şık sayısı (YKS: A-E, LGS: A-D). */
  optionCount: 4 | 5;
  /** Kaç yanlış bir doğruyu götürür. */
  wrongPerCorrect: number;
  questionCount: number;
  durationMinutes: number;
}

export const EXAMS: Record<ExamType, ExamMeta> = {
  TYT: {
    type: "TYT",
    family: "YKS",
    label: "Temel Yeterlilik Testi",
    optionCount: 5,
    wrongPerCorrect: 4,
    questionCount: 120,
    durationMinutes: 165,
  },
  AYT: {
    type: "AYT",
    family: "YKS",
    label: "Alan Yeterlilik Testleri",
    optionCount: 5,
    wrongPerCorrect: 4,
    questionCount: 160,
    durationMinutes: 180,
  },
  LGS: {
    type: "LGS",
    family: "LGS",
    label: "Liselere Geçiş Sistemi",
    optionCount: 4,
    wrongPerCorrect: 3,
    questionCount: 90,
    // Sözel (75 dk) + sayısal (80 dk) oturumlarının toplamı.
    durationMinutes: 155,
  },
};

/** YKS puan türleri. */
export const SCORE_TYPES = ["SAY", "EA", "SOZ", "DIL"] as const;
export type ScoreType = (typeof SCORE_TYPES)[number];

export const SCORE_TYPE_LABELS: Record<ScoreType, string> = {
  SAY: "Sayısal",
  EA: "Eşit Ağırlık",
  SOZ: "Sözel",
  DIL: "Dil",
};

/** Şık harfleri, sınavın şık sayısına göre. */
export function optionLetters(exam: ExamType): string[] {
  return ["A", "B", "C", "D", "E"].slice(0, EXAMS[exam].optionCount);
}
