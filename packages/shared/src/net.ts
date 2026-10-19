import { EXAMS, type ExamType } from "./exams";

export interface AnswerTally {
  correct: number;
  wrong: number;
  /** Bilgi amaçlı; net hesabını etkilemez. */
  blank?: number;
}

/** Net = doğru − yanlış / (yanlış-doğru oranı). YKS'de 4, LGS'de 3 yanlış bir doğruyu götürür. */
export function calculateNet({ correct, wrong }: AnswerTally, exam: ExamType): number {
  if (correct < 0 || wrong < 0) throw new RangeError("Doğru ve yanlış sayısı negatif olamaz.");
  return correct - wrong / EXAMS[exam].wrongPerCorrect;
}

/** Neti Türkçe biçimde gösterir: 84.5 → "84,5", 30.25 → "30,25". */
export function formatNet(net: number): string {
  return net.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}
