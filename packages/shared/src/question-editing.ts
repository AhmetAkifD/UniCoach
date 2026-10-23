import type { AnswerKeyMethod, BookQuestionInput, ChoiceLetter } from "./question-bank";
import {
  applyAnswerKeys,
  applyPageBottomKey,
  applyRenames,
  detectDocument,
  detectPage,
  detectPageByChoices,
  parseAnswerKeyPage,
  type DetectedQuestion,
  type DetectState,
  type PageText,
} from "./question-detect";

/**
 * Soru düzenleyicisinin (Soru Bankası → soruları çıkar) platformdan bağımsız kuralları. Web ve mobil düzenleyici
 * aynı kuralları kullanır; PDF'i okumak (metin katmanı, OCR) ve çizmek her platformun kendi işidir.
 */

/** Düzenleyicideki soru: kaydedilmemiş olabileceği için kendi anahtarıyla izlenir (kayıtlıysa anahtar = kimlik). */
export type EditorQuestion = Omit<BookQuestionInput, "id"> & { key: string };
export type QuestionRect = { x: number; y: number; w: number; h: number };
/** Düzenleyicide gösterilen bildirim */
export type EditorNotice = { tone: "success" | "danger" | "info"; text: string };

/** Metin katmanında sayfa başına bundan az karakter varsa sayfa taranmış sayılır ve OCR'a gönderilir. */
export const MIN_TEXT_CHARS = 40;
/** Elle çizilen kutu bundan küçükse (PDF noktası) yok sayılır. */
export const MIN_QUESTION_BOX = 12;
/** Sayfa genişliği bilinmiyorsa (A4, PDF noktası) */
export const DEFAULT_PAGE_WIDTH = 595;

/** Yeni (kaydedilmemiş) sorunun anahtar öneki; kayıtta kimlik gönderilmez. */
const NEW_PREFIX = "yeni-";
let keySeq = 0;
export const newQuestionKey = () => `${NEW_PREFIX}${++keySeq}`;
export const isNewQuestionKey = (key: string) => key.startsWith(NEW_PREFIX);

export const pageHasText = (p: PageText) => p.items.reduce((sum, i) => sum + i.s.length, 0) >= MIN_TEXT_CHARS;

/** PDF sırası: sayfa → sütun (sol/sağ) → yukarıdan aşağı. */
export function questionOrderKey(q: QuestionRect & { page: number }, pageWidth: number) {
  const col = q.x + q.w / 2 >= pageWidth / 2 ? 1 : 0;
  return q.page * 1e7 + col * 1e6 + q.y;
}

export function sortQuestions<T extends QuestionRect & { page: number }>(qs: T[], widthOf: (page: number) => number): T[] {
  return [...qs].sort((a, b) => questionOrderKey(a, widthOf(a.page)) - questionOrderKey(b, widthOf(b.page)));
}

/** Anahtarı testlere sırayla eşlemek için soruların PDF sırası (sayfa → x → y; sütun ayrımı kaba). */
export const sortForKey = <T extends { page: number; x: number; y: number }>(qs: T[]) =>
  [...qs].sort((a, b) => a.page - b.page || (a.x > 297 ? 1 : 0) - (b.x > 297 ? 1 : 0) || a.y - b.y);

/** Aynı testte aynı numarası olan soruların anahtarları (kaydedilemez). */
export function duplicateQuestionKeys(qs: EditorQuestion[]): Set<string> {
  const id = (q: EditorQuestion) => `${q.section.toLocaleLowerCase("tr-TR")}#${q.number}`;
  const seen = new Map<string, number>();
  for (const q of qs) seen.set(id(q), (seen.get(id(q)) ?? 0) + 1);
  return new Set(qs.filter((q) => seen.get(id(q))! > 1).map((q) => q.key));
}

export const testSections = (sorted: EditorQuestion[]) => [...new Set(sorted.map((q) => q.section))];

export function roundRect(r: QuestionRect): QuestionRect {
  const round = (n: number) => Math.round(n * 10) / 10;
  return { x: round(r.x), y: round(r.y), w: Math.max(1, round(r.w)), h: Math.max(1, round(r.h)) };
}

export function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): QuestionRect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

/** Bulunan soru düzenleyiciye girer; şık metinleri saklanmaz (şıklar görselin içinde, yalnızca harf seçilir). */
export const toEditorQuestion = (d: DetectedQuestion): EditorQuestion => ({
  section: d.section,
  number: d.number,
  page: d.page,
  x: d.x,
  y: d.y,
  w: d.w,
  h: d.h,
  choiceCount: d.choiceCount,
  answer: (d.answer as ChoiceLetter | null) ?? null,
  choices: [],
  key: newQuestionKey(),
});

/** Kayıt gövdesi: kayıtlı soruların kimliği gönderilir ki sınavlardaki bağlantılar kopmasın. */
export const questionsForSave = (sorted: EditorQuestion[]) =>
  sorted.map(({ key, ...q }) => ({ ...q, id: isNewQuestionKey(key) ? undefined : key, choices: [] }));

const usesLastPages = (m: AnswerKeyMethod) => m === "auto" || m === "lastPages";
const usesPageBottom = (m: AnswerKeyMethod) => m === "auto" || m === "pageBottom";

export type AnswerKeyGroups = NonNullable<ReturnType<typeof parseAnswerKeyPage>>;

/**
 * Ayrı cevap anahtarı sayfaları (ÖSYM): PDF'in sonundan geriye doğru, anahtar olmayan ilk sayfaya kadar
 * (en fazla 6 sayfa) okunur. Sonuç PDF başına bir kez hesaplanıp saklanmalıdır.
 */
export async function readLastPageKeys(pageCount: number, readText: (page: number) => Promise<PageText>): Promise<AnswerKeyGroups | null> {
  const keys: AnswerKeyGroups = [];
  let misses = 0;
  for (let n = pageCount; n >= Math.max(1, pageCount - 5) && misses < 2; n--) {
    const key = parseAnswerKeyPage(await readText(n));
    if (key) keys.unshift(...key);
    else if (keys.length) break;
    else misses++;
  }
  return keys.length ? keys : null;
}

export type PageDetection =
  /** Sayfa bir cevap anahtarıydı: cevaplar testlere işlendi. */
  | { kind: "key"; questions: EditorQuestion[]; count: number }
  /** Sayfadaki sorular bulundu ve diğer sayfalardakilerle birleştirildi. */
  | { kind: "questions"; questions: EditorQuestion[]; found: EditorQuestion[]; ocr: boolean };

/**
 * "Bu sayfada bul": sayfanın metninden soruları bulur ve o sayfadaki eski soruların yerine koyar. Önceki
 * sayfalardaki son soru testin adını ve numara sırasını belirler; başlık bu sayfada bulunduysa önceki
 * sayfalardaki aynı testin adı da güncellenir. Cevaplar sayfa altı şeridinden ve son sayfalardaki anahtardan
 * (yalnızca boş olanlar) okunur.
 */
export function detectOnPage({
  text,
  sorted,
  keyMethod,
  defaultChoiceCount,
  lastPageKeys,
}: {
  text: PageText;
  /** Düzenleyicideki bütün sorular, PDF sırasıyla */
  sorted: EditorQuestion[];
  keyMethod: AnswerKeyMethod;
  defaultChoiceCount: number;
  /** `readLastPageKeys` sonucu (yöntem son sayfaları kullanmıyorsa null) */
  lastPageKeys: AnswerKeyGroups | null;
}): PageDetection {
  const page = text.page;
  const key = usesLastPages(keyMethod) ? parseAnswerKeyPage(text) : null;
  if (key) {
    const all: DetectedQuestion[] = sorted.map((q) => ({ ...q }));
    applyAnswerKeys(all, key);
    const questions = sorted.map((q, i) => ({ ...q, answer: (all[i]!.answer as ChoiceLetter | null) ?? q.answer }));
    return { kind: "key", questions, count: key.reduce((n, k) => n + k.answers.size, 0) };
  }
  const before = sorted.filter((q) => q.page < page);
  const prev = before[before.length - 1];
  const state: DetectState = {
    section: prev?.section ?? null,
    lastNumber: prev?.number ?? 0,
    testCount: new Set(before.map((q) => q.section)).size,
    heading: null,
    // Diğer sayfalardaki test adları tekrar kullanılmaz.
    used: new Set(sorted.filter((q) => q.page !== page).map((q) => q.section)),
    renames: new Map(),
  };
  const detected = (text.ocr ? detectPageByChoices : detectPage)(text, state, defaultChoiceCount);
  if (usesPageBottom(keyMethod)) applyPageBottomKey(text, detected);
  const found = detected.map(toEditorQuestion);
  const rest = sorted.filter((q) => q.page !== page).map((q) => ({ ...q }));
  applyRenames(rest, state);
  const all = [...rest, ...found];
  if (lastPageKeys) {
    const ordered = sortForKey(all);
    const copy: DetectedQuestion[] = ordered.map((q) => ({ ...q }));
    applyAnswerKeys(copy, lastPageKeys);
    const byKey = new Map(ordered.map((q, i) => [q.key, copy[i]!.answer as ChoiceLetter | null]));
    for (const q of found) {
      const answer = byKey.get(q.key);
      if (!q.answer && answer) q.answer = answer;
    }
  }
  return { kind: "questions", questions: all, found, ocr: !!text.ocr };
}

export function pageDetectionNotice(result: PageDetection): EditorNotice {
  if (result.kind === "key") return { tone: "success", text: `Bu sayfa bir cevap anahtarı: ${result.count} cevap testlere işlendi.` };
  const { found, ocr } = result;
  const answered = found.filter((q) => q.answer).length;
  return found.length
    ? {
        tone: "success",
        text: `${found.length} soru bulundu${answered ? `, ${answered} tanesinin cevabı okundu` : ""}${ocr ? " (metin tanımayla — kutuları ve numaraları kontrol et)" : ""}.`,
      }
    : { tone: "info", text: "Bu sayfada soru bulunamadı. Kutuyu kendin çizebilirsin." };
}

/**
 * "Tüm PDF'te bul": bütün sayfaları sırayla okuyup soruları bulur. Otomatikte PDF'in çoğu metinliyse metinsiz
 * sayfalar kapak/görseldir, metin tanımaya (OCR) gönderilmez. `readText(n, allowOcr)` sayfayı yönteme göre okur;
 * `cancelled()` true dönerse tarama durur ve null döner.
 */
export async function scanDocument({
  pageCount,
  detectMethod,
  keyMethod,
  defaultChoiceCount,
  readText,
  readTextLayer,
  onProgress,
  cancelled,
}: {
  pageCount: number;
  detectMethod: "auto" | "text" | "ocr";
  keyMethod: AnswerKeyMethod;
  defaultChoiceCount: number;
  readText: (page: number, allowOcr: boolean) => Promise<PageText>;
  /** Yalnızca metin katmanı (OCR'sız), otomatikte PDF'i incelemek için */
  readTextLayer: (page: number) => Promise<PageText>;
  onProgress: (message: string) => void;
  cancelled: () => boolean;
}): Promise<{ questions: EditorQuestion[]; ocrPages: number } | null> {
  let allowOcr = true;
  if (detectMethod === "auto") {
    onProgress("PDF inceleniyor…");
    let textual = 0;
    for (let n = 1; n <= pageCount; n++) {
      if (cancelled()) return null;
      if (pageHasText(await readTextLayer(n))) textual++;
    }
    allowOcr = textual < pageCount / 2;
  }
  const pages: PageText[] = [];
  let ocrPages = 0;
  for (let n = 1; n <= pageCount; n++) {
    if (cancelled()) return null;
    onProgress(`Sayfa ${n}/${pageCount} okunuyor…${ocrPages ? " (metin tanıma, sayfa başına birkaç saniye)" : ""}`);
    const text = await readText(n, allowOcr);
    if (text.ocr && text.items.length > 20) ocrPages++;
    pages.push(text);
  }
  return { questions: detectDocument(pages, { defaultChoiceCount, keyMethod }).map(toEditorQuestion), ocrPages };
}

export function scanNotice(questions: EditorQuestion[], ocrPages: number): EditorNotice {
  if (!questions.length) return { tone: "info", text: "Soru bulunamadı. Kutuları kendin çizebilirsin." };
  const answered = questions.filter((q) => q.answer).length;
  const testCount = new Set(questions.map((q) => q.section)).size;
  return {
    tone: "success",
    text: `${testCount} testte ${questions.length} soru bulundu, ${answered} tanesinin cevabı anahtardan okundu.${ocrPages ? ` ${ocrPages} sayfa metin tanımayla okundu; o sayfaları kontrol et.` : ""}`,
  };
}

/**
 * Elle çizilen kutudan yeni soru: PDF sırasında kendinden önceki sorunun testinde ve bir sonraki numarayla açılır.
 */
export function questionForBox({
  rect,
  page,
  sorted,
  widthOf,
  defaultChoiceCount,
}: {
  rect: QuestionRect;
  page: number;
  sorted: EditorQuestion[];
  widthOf: (page: number) => number;
  defaultChoiceCount: number;
}): EditorQuestion {
  const at = questionOrderKey({ ...rect, page }, widthOf(page));
  const prev = sorted.filter((q) => questionOrderKey(q, widthOf(q.page)) < at).pop();
  const section = prev?.section ?? testSections(sorted)[0] ?? "Test 1";
  return {
    key: newQuestionKey(),
    section,
    number: (prev && prev.section === section ? prev.number : 0) + 1,
    page,
    ...roundRect(rect),
    choiceCount: defaultChoiceCount,
    answer: null,
    choices: [],
  };
}

/** "Buradan yeni test başlat" için önerilen ad ("Test 4") */
export function suggestTestName(sections: string[]) {
  let n = sections.length + 1;
  while (sections.includes(`Test ${n}`)) n++;
  return `Test ${n}`;
}

/** Bu ad başka bir testte kullanılıyorsa true (büyük/küçük harf ayrımı yok). */
export const testNameTaken = (sections: string[], name: string, except: string) =>
  sections.some((s) => s !== except && s.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"));

/**
 * Seçili sorudan başlayarak aynı testteki sonraki soruları yeni bir teste taşır ve 1'den numaralar
 * (OCR'ın kaçırdığı "test yeniden 1'den başlıyor" durumunu tek dokunuşla düzeltmek için).
 */
export function splitTestFrom(questions: EditorQuestion[], sorted: EditorQuestion[], key: string, name: string): EditorQuestion[] {
  const index = sorted.findIndex((q) => q.key === key);
  const from = sorted[index];
  if (!from) return questions;
  const moved = sorted.slice(index).filter((q) => q.section === from.section);
  const numbers = new Map(moved.map((q, i) => [q.key, i + 1]));
  const section = name.slice(0, 60);
  return questions.map((q) => (numbers.has(q.key) ? { ...q, section, number: numbers.get(q.key)! } : q));
}

/** Elle girilen cevap anahtarını bir teste işler; işlenen cevap sayısını da döner. */
export function applyTestKey(questions: EditorQuestion[], section: string, answers: Map<number, string>) {
  let count = 0;
  const next = questions.map((q) => {
    const letter = q.section === section ? answers.get(q.number) : undefined;
    if (!letter) return q;
    count++;
    return { ...q, answer: letter as ChoiceLetter };
  });
  return { questions: next, count };
}
