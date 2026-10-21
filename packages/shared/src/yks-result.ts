import { z } from "zod";

/**
 * YKS Tercih: öğrencinin sınav sonucu (puanlar, başarı sıraları, OBP, netler).
 * Sonuç ya ÖSYM sonuç belgesinden (PDF, metin katmanı tarayıcıda okunur) ya da elle girilir.
 * Belgedeki kimlik bilgileri (T.C. kimlik no, ad soyad) API'ye hiç gönderilmez.
 */

/** Sonuç belgesindeki puan türleri (TYT dahil). */
export const RESULT_SCORE_TYPES = ["TYT", "SAY", "SOZ", "EA", "DIL"] as const;
export type ResultScoreType = (typeof RESULT_SCORE_TYPES)[number];

export const RESULT_SCORE_LABELS: Record<ResultScoreType, string> = {
  TYT: "TYT",
  SAY: "Sayısal",
  SOZ: "Sözel",
  EA: "Eşit Ağırlık",
  DIL: "Dil",
};

export const RESULT_SOURCES = ["document", "manual"] as const;
export type ResultSource = (typeof RESULT_SOURCES)[number];

/** Testlerin ait olduğu oturum */
export const RESULT_SESSIONS = ["TYT", "AYT", "YDT"] as const;
export type ResultSession = (typeof RESULT_SESSIONS)[number];

const score = z.number().min(0).max(600).nullable();
const rank = z.number().int().min(1).max(5_000_000).nullable();

export const yksScoreSchema = z.object({
  type: z.enum(RESULT_SCORE_TYPES),
  /** Ham puan (OBP'siz) ve başarı sırası */
  score,
  rank,
  /** Yerleştirme puanı (OBP eklenmiş) ve başarı sırası */
  placementScore: score,
  placementRank: rank,
  /** Ek puanlı yerleştirme (mesleki eğitim öğrencileri) */
  bonusScore: score,
  bonusRank: rank,
});

export const yksTestSchema = z.object({
  session: z.enum(RESULT_SESSIONS),
  name: z.string().trim().min(1).max(80),
  correct: z.number().int().min(0).max(80),
  wrong: z.number().int().min(0).max(80),
});

/** PUT /api/results/:year — aynı yılın sonucu varsa üzerine yazılır. */
export const saveYksResultSchema = z.object({
  source: z.enum(RESULT_SOURCES),
  diplomaGrade: z.number().min(0).max(100).nullable(),
  obp: z.number().min(0).max(500).nullable(),
  scores: z
    .array(yksScoreSchema)
    .max(RESULT_SCORE_TYPES.length)
    .refine((list) => new Set(list.map((s) => s.type)).size === list.length, { error: "Bir puan türü iki kez girilemez." }),
  tests: z.array(yksTestSchema).max(30),
});

export const YKS_FIRST_YEAR = 2018;

export type YksScore = z.infer<typeof yksScoreSchema>;
export type YksTest = z.infer<typeof yksTestSchema>;
export type SaveYksResultInput = z.infer<typeof saveYksResultSchema>;

export interface YksResult extends SaveYksResultInput {
  id: string;
  year: number;
  updatedAt: string;
}

/** Belgeden okunan sonuç; kimlik bilgisi yalnızca ekranda karşılaştırma için tutulur, kaydedilmez. */
export interface ParsedYksResult extends Omit<SaveYksResultInput, "source"> {
  year: number;
  /** Belgedeki ad soyad (hesaptaki adla karşılaştırmak için; API'ye gönderilmez) */
  fullName: string | null;
}

/** pdf.js metin parçası: sol üstten koordinat (PDF noktası) */
export interface ResultTextItem {
  s: string;
  x: number;
  y: number;
  w: number;
}

export class ResultParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResultParseError";
  }
}

/** "397,68000" → 397.68, "---" → null */
function parseDecimal(text: string): number | null {
  const t = text.trim();
  if (!/^\d+(,\d+)?$/.test(t)) return null;
  return Number(t.replace(",", "."));
}

/** "214.370" → 214370, "---" → null */
function parseRank(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,3}(\.\d{3})*$/.test(t)) return null;
  return Number(t.replace(/\./g, ""));
}

const SCORE_TYPE_TEXT: Record<string, ResultScoreType> = { TYT: "TYT", SAY: "SAY", SÖZ: "SOZ", EA: "EA", DİL: "DIL" };

interface Line {
  y: number;
  items: ResultTextItem[];
  text: string;
}

function toLines(items: ResultTextItem[]): Line[] {
  const sorted = items.filter((i) => i.s.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  for (const item of sorted) {
    const line = lines.find((l) => Math.abs(l.y - item.y) <= 3);
    if (line) line.items.push(item);
    else lines.push({ y: item.y, items: [item], text: "" });
  }
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x);
    l.text = l.items.map((i) => i.s.trim()).join(" ");
  }
  return lines;
}

const center = (i: ResultTextItem) => i.x + i.w / 2;

/** Başlık satırındaki her sütun başlığı için, altındaki satırda x'i en yakın değer. */
function columnValues(header: Line, values: Line): Map<string, string> {
  const out = new Map<string, string>();
  for (const h of header.items) {
    let best: ResultTextItem | null = null;
    for (const v of values.items) {
      if (!best || Math.abs(center(v) - center(h)) < Math.abs(center(best) - center(h))) best = v;
    }
    if (best && Math.abs(center(best) - center(h)) < 60) out.set(h.s.trim(), best.s.trim());
  }
  return out;
}

const isNumberLine = (l: Line) => l.items.length >= 2 && l.items.every((i) => /^\d+$/.test(i.s.trim()));
const isCorrectWrongLine = (l: Line) => l.items.length >= 2 && l.items.every((i) => /^(Doğru|Yanlış)$/.test(i.s.trim()));

/**
 * Doğru/yanlış tabloları: her "Doğru | Yanlış" çiftinin altındaki iki sayı, üstteki en yakın test adına aittir
 * (grup başlıkları, ör. "Fen Bilimleri", testin kendi adından daha yukarıda kalır).
 */
function parseTests(lines: Line[]): YksTest[] {
  const tests: YksTest[] = [];
  let session: ResultSession | null = null;
  let sectionStart = 0;
  lines.forEach((line, index) => {
    const head = /^(TYT|AYT|YDT)\s+TEST/i.exec(line.text);
    if (head) {
      session = head[1]!.toUpperCase() as ResultSession;
      sectionStart = index + 1;
      return;
    }
    if (!session || !isNumberLine(line) || index === 0 || !isCorrectWrongLine(lines[index - 1]!)) return;
    const labels = lines[index - 1]!.items;
    // Test adları: bu tablonun "Doğru | Yanlış" satırıyla bir önceki sayı satırı arasındakiler
    let from = index - 2;
    while (from >= sectionStart && !isNumberLine(lines[from]!)) from--;
    const names = lines
      .slice(from + 1, index - 1)
      .flatMap((l) => l.items.map((item) => ({ item, y: l.y })))
      .filter(({ item }) => !/^(Doğru|Yanlış)$/.test(item.s.trim()));
    for (let k = 0; k + 1 < labels.length; k += 2) {
      const correctLabel = labels[k]!;
      const wrongLabel = labels[k + 1]!;
      if (correctLabel.s.trim() !== "Doğru" || wrongLabel.s.trim() !== "Yanlış") continue;
      const left = correctLabel.x - 20;
      const right = wrongLabel.x + wrongLabel.w + 20;
      const candidates = names.filter(({ item }) => center(item) >= left && center(item) <= right);
      const name = candidates.sort((a, b) => b.y - a.y)[0]?.item.s.trim();
      const pick = (label: ResultTextItem) =>
        line.items.reduce((best, v) => (Math.abs(center(v) - center(label)) < Math.abs(center(best) - center(label)) ? v : best));
      const correct = Number(pick(correctLabel).s);
      const wrong = Number(pick(wrongLabel).s);
      if (name) tests.push({ session, name: name.replace(/\s+/g, " "), correct, wrong });
    }
  });
  return tests;
}

/** "TYT | 340,54879 | 214.370 | Y-TYT | 388,27039 | 224.527 | --- | ---" */
function parseScores(lines: Line[]): YksScore[] {
  const scores: YksScore[] = [];
  for (const line of lines) {
    const tokens = line.items.map((i) => i.s.trim());
    const type = SCORE_TYPE_TEXT[tokens[0]!.toLocaleUpperCase("tr-TR")];
    if (!type || tokens.length < 3) continue;
    // Tablonun dışındaki "TYT" ile başlayan satırlar (ör. başlıklar) sayı içermez.
    const rest = tokens.slice(1).filter((t) => !/^Y-/.test(t));
    if (!rest.every((t) => /^(-{2,}|[\d.,]+)$/.test(t))) continue;
    if (scores.some((s) => s.type === type)) continue;
    const [s, r, ps, pr, bs, br] = [...rest, "", "", "", "", "", ""];
    scores.push({
      type,
      score: parseDecimal(s!),
      rank: parseRank(r!),
      placementScore: parseDecimal(ps!),
      placementRank: parseRank(pr!),
      bonusScore: parseDecimal(bs!),
      bonusRank: parseRank(br!),
    });
  }
  return scores;
}

/**
 * ÖSYM sonuç belgesinin (Sonuç Açıklama Sistemi çıktısı) metin katmanını ayrıştırır.
 * Belge yapısı tanınmazsa `ResultParseError` atar.
 */
export function parseYksResult(items: ResultTextItem[]): ParsedYksResult {
  const lines = toLines(items);
  const all = lines.map((l) => l.text).join("\n");

  const yearMatch = /(\d{4})\s+Yükseköğretim Kurumları Sınavı/i.exec(all);
  if (!yearMatch) {
    throw new ResultParseError("Bu bir YKS sonuç belgesi gibi görünmüyor. ÖSYM Sonuç Açıklama Sistemi'nden aldığın PDF'i seç.");
  }
  const year = Number(yearMatch[1]);

  const nameLine = lines.find((l) => /^Adı\s+(ve\s+)?Soyadı/i.test(l.text));
  const fullName = nameLine?.items.slice(nameLine.items.findIndex((i) => /Soyadı/i.test(i.s)) + 1).map((i) => i.s.trim()).join(" ") || null;

  let diplomaGrade: number | null = null;
  let obp: number | null = null;
  const obpHeader = lines.findIndex((l) => l.items.some((i) => i.s.trim() === "OBP"));
  if (obpHeader >= 0 && lines[obpHeader + 1]) {
    const values = columnValues(lines[obpHeader]!, lines[obpHeader + 1]!);
    diplomaGrade = parseDecimal(values.get("Diploma Notu") ?? "");
    obp = parseDecimal(values.get("OBP") ?? "");
  }

  // Girilmemiş puan türleri ("---") atlanır.
  const scores = parseScores(lines).filter((s) => s.score !== null || s.placementScore !== null);
  if (!scores.length) {
    throw new ResultParseError("Belgede puan tablosu bulunamadı. Sonuçlar açıklandıktan sonra alınan belgeyi seç.");
  }

  return { year, fullName, diplomaGrade, obp, scores, tests: parseTests(lines) };
}

/** Puanı Türkçe biçimde gösterir: 340.54879 → "340,54879" */
export function formatScore(value: number): string {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 5, maximumFractionDigits: 5 });
}

/** Başarı sırası: 214370 → "214.370" */
export function formatRank(value: number): string {
  return value.toLocaleString("tr-TR");
}
