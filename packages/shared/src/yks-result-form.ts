import {
  RESULT_SCORE_TYPES,
  YKS_RESULT_TESTS,
  formatRank,
  type ResultScoreType,
  type SaveYksResultInput,
  type YksResult,
  type YksScore,
} from "./yks-result";

/**
 * Sonucu elle girme/düzenleme formunun kuralları (web ve mobil aynı formu kullanır): metin kutularının durumu,
 * kayıtlı sonuçtan doldurma ve API gövdesine çevirme (hatalı alanlar `errors`'ta).
 */

export type ResultScoreField = "score" | "rank" | "placementScore" | "placementRank" | "bonusScore" | "bonusRank";
export type ResultScoreInputs = Record<ResultScoreType, Record<ResultScoreField, string>>;
export type ResultTestInputs = Record<string, { correct: string; wrong: string }>;

export interface ResultFormState {
  scores: ResultScoreInputs;
  obp: string;
  diplomaGrade: string;
  tests: ResultTestInputs;
}

export const RESULT_RANK_FIELDS = new Set<ResultScoreField>(["rank", "placementRank", "bonusRank"]);
export const RESULT_SCORE_FIELDS: ResultScoreField[] = ["score", "rank", "placementScore", "placementRank", "bonusScore", "bonusRank"];

const decimalText = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));
const rankText = (v: number | null) => (v === null ? "" : formatRank(v));

/** "388,27039" ya da "388.27039" → 388.27039; boş → null; geçersiz → NaN */
export function readDecimal(text: string): number | null {
  const t = text.trim().replace(/\s/g, "");
  if (!t) return null;
  return /^\d+([.,]\d+)?$/.test(t) ? Number(t.replace(",", ".")) : NaN;
}

/** "224.527" ya da "224527" → 224527 */
export function readRank(text: string): number | null {
  const t = text.trim().replace(/[\s.]/g, "");
  if (!t) return null;
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

export function toResultFormState(result?: YksResult): ResultFormState {
  const scores = Object.fromEntries(
    RESULT_SCORE_TYPES.map((type) => {
      const s = result?.scores.find((x) => x.type === type);
      return [
        type,
        Object.fromEntries(
          RESULT_SCORE_FIELDS.map((f) => [f, RESULT_RANK_FIELDS.has(f) ? rankText(s?.[f] ?? null) : decimalText(s?.[f] ?? null)]),
        ),
      ];
    }),
  ) as ResultScoreInputs;
  const tests: ResultTestInputs = {};
  for (const t of result?.tests ?? []) {
    if (t.correct + t.wrong > 0) tests[t.name] = { correct: String(t.correct), wrong: String(t.wrong) };
  }
  return {
    scores,
    obp: decimalText(result?.obp ?? null),
    diplomaGrade: decimalText(result?.diplomaGrade ?? null),
    tests,
  };
}

export type ResultFormErrors = Record<string, string>;

/** Form değerlerini API gövdesine çevirir; hatalı alanlar `errors`'a yazılır. */
export function buildResultInput(state: ResultFormState, testList: typeof YKS_RESULT_TESTS) {
  const errors: ResultFormErrors = {};
  const scores: YksScore[] = [];
  for (const type of RESULT_SCORE_TYPES) {
    const inputs = state.scores[type];
    const values = {} as Record<ResultScoreField, number | null>;
    for (const f of RESULT_SCORE_FIELDS) {
      const v = RESULT_RANK_FIELDS.has(f) ? readRank(inputs[f]) : readDecimal(inputs[f]);
      if (Number.isNaN(v)) errors[`${type}.${f}`] = RESULT_RANK_FIELDS.has(f) ? "Yalnızca rakam" : "Örn. 388,27039";
      else if (v !== null && RESULT_RANK_FIELDS.has(f) && v < 1) errors[`${type}.${f}`] = "En az 1";
      else if (v !== null && !RESULT_RANK_FIELDS.has(f) && v > 600) errors[`${type}.${f}`] = "En fazla 600";
      values[f] = Number.isNaN(v) ? null : v;
    }
    if ((values.placementScore === null) !== (values.placementRank === null)) {
      const missing = values.placementScore === null ? "placementScore" : "placementRank";
      errors[`${type}.${missing}`] ??= "Bunu da gir";
    }
    if ((values.bonusScore === null) !== (values.bonusRank === null)) {
      const missing = values.bonusScore === null ? "bonusScore" : "bonusRank";
      errors[`${type}.${missing}`] ??= "Bunu da gir";
    }
    if (RESULT_SCORE_FIELDS.some((f) => values[f] !== null)) scores.push({ type, ...values });
  }
  if (!scores.some((s) => s.placementScore !== null && s.placementRank !== null) && !Object.keys(errors).length) {
    errors.form = "En az bir puan türünün yerleştirme puanını ve başarı sırasını gir.";
  }

  const obp = readDecimal(state.obp);
  if (Number.isNaN(obp) || (obp !== null && obp > 500)) errors.obp = "0–500 arası, örn. 397,68";
  const diplomaGrade = readDecimal(state.diplomaGrade);
  if (Number.isNaN(diplomaGrade) || (diplomaGrade !== null && diplomaGrade > 100)) errors.diplomaGrade = "0–100 arası, örn. 79,536";

  const tests: SaveYksResultInput["tests"] = [];
  for (const t of testList) {
    const input = state.tests[t.name];
    const correct = input?.correct.trim() ? Number(input.correct) : 0;
    const wrong = input?.wrong.trim() ? Number(input.wrong) : 0;
    if (!Number.isInteger(correct) || !Number.isInteger(wrong) || correct < 0 || wrong < 0) {
      errors[`test.${t.name}`] = "Yalnızca rakam";
    } else if (correct + wrong > t.questions) {
      errors[`test.${t.name}`] = `Bu testte ${t.questions} soru var`;
    } else if (correct + wrong > 0) {
      tests.push({ session: t.session, name: t.name, correct, wrong });
    }
  }

  return {
    errors,
    payload: {
      diplomaGrade: Number.isNaN(diplomaGrade) ? null : diplomaGrade,
      obp: Number.isNaN(obp) ? null : obp,
      scores,
      tests,
    },
  };
}


/** Formda sorulan testler: belgedekiler ve kayıtlı sonuçta olup listede olmayanlar (düzenlenebilsinler diye). */
export function resultFormTests(result?: YksResult) {
  return [
    ...YKS_RESULT_TESTS,
    ...(result?.tests ?? [])
      .filter((t) => !YKS_RESULT_TESTS.some((x) => x.name === t.name))
      .map((t) => ({ session: t.session, name: t.name, questions: 80 })),
  ];
}

/** "Diğer bilgiler" açık başlasın mı (kayıtlı sonuçta isteğe bağlı alanlardan biri doluysa). */
export function resultFormHasExtras(s: ResultFormState) {
  return Boolean(s.obp || s.diplomaGrade || Object.keys(s.tests).length || RESULT_SCORE_TYPES.some((t) => s.scores[t].score || s.scores[t].bonusScore));
}
