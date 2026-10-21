/**
 * PDF sayfasındaki metinden soruları bulur. Kaynak, pdf.js metin katmanı (dijital PDF) ya da OCR (taranmış PDF)
 * olabilir; ikisi de aynı biçime ({ s, x, y, w, h } — PDF noktası, sayfanın sol üstünden) çevrilip buraya verilir.
 *
 * Yöntem: Sütunun sol kenarında satırı başlatan "12." biçimindeki numaralar soru başlangıcıdır. Soru kutusu
 * numaradan aynı sütundaki bir sonraki numaraya (ya da sütun sonuna) kadar uzanır ve son metin satırında biter.
 * Şıklar "A)"–"E)" satırlarıdır; OCR harfleri karıştırabildiği için ("EB)", "O)") şık sırası esas alınır.
 * Numara 1'e dönünce yeni test başlar; test adı sayfa başlığından (ör. "TEMEL MATEMATİK TESTİ") alınır.
 * Cevap anahtarı sayfaları ("1. B", "2. A" … çiftleri) soru olarak değil, anahtar olarak okunur.
 */

import type { AnswerKeyMethod } from "@unicoach/shared";

/** Sayfadaki tek metin parçası. y, parçanın taban çizgisi değil üst kenarıdır. */
export interface TextItem {
  s: string;
  x: number;
  y: number;
  w: number;
  h: number;
}


export interface PageText {
  page: number;
  width: number;
  height: number;
  items: TextItem[];
  /** Metin OCR'dan geldiyse true: numaralar sık kaçırıldığı için sorular şık kümelerinden bulunur. */
  ocr?: boolean;
}

export interface DetectedQuestion {
  section: string;
  number: number;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  choiceCount: number;
  answer: string | null;
  choices: string[];
  /** Numara sayfadan okundu mu (false: okunamadı, sıradan tahmin edildi — OCR'da olur) */
  numberRead?: boolean;
}

/**
 * Sayfalar arasında taşınan durum. Numaralar sırayla ilerler; 1. soru her görüldüğünde yeni test açılır.
 */
export interface DetectState {
  section: string | null;
  lastNumber: number;
  /** Adsız testler için sayaç ("Test 1", "Test 2"…) */
  testCount: number;
  /** Henüz kullanılmamış test başlığı (yalnızca bir kez, kendisinden sonra açılan teste ad olur) */
  heading: string | null;
  /** Kullanılan test adları: iki test asla aynı adı almaz (aksi hâlde numaraları çakışmış görünür). */
  used: Set<string>;
  /** Sonradan adı bulunan testler: "Test 1" → "Mavi Test-01" (önceki sayfalardaki sorulara da uygulanır) */
  renames: Map<string, string>;
}

export const initialDetectState = (): DetectState => ({
  section: null,
  lastNumber: 0,
  testCount: 0,
  heading: null,
  used: new Set(),
  renames: new Map(),
});

const GENERIC_NAME = /^Test \d+$/;

/**
 * Başlık, testin ilk sayfasında değil sonraki sayfalarında yazıyor olabilir (bazı yayınevleri ilk sayfaya
 * büyük bir afiş koyar). Sayfada yeni test başlamadıysa ve geçerli testin adı hâlâ "Test N" ise başlık ona verilir.
 */
function nameCurrentTest(state: DetectState, startedOnPage: boolean) {
  if (startedOnPage || !state.heading || !state.section || !GENERIC_NAME.test(state.section)) return;
  if ([...state.used].some((u) => u.toLocaleLowerCase("tr-TR") === state.heading!.toLocaleLowerCase("tr-TR"))) return;
  state.used.add(state.heading);
  state.renames.set(state.section, state.heading);
  state.section = state.heading;
  state.heading = null;
}

/** Yeni test açar: varsa yeni görülen başlık, yoksa "Test N"; ad daha önce kullanıldıysa "(2)", "(3)" eklenir. */
function startTest(state: DetectState) {
  state.testCount += 1;
  const base = state.heading ?? `Test ${state.testCount}`;
  const norm = (s: string) => s.toLocaleLowerCase("tr-TR");
  let name = base;
  for (let i = 2; [...state.used].some((u) => norm(u) === norm(name)); i++) name = `${base} (${i})`;
  state.used.add(name);
  state.section = name;
  // Başlık bir kez kullanılır; sonraki testler kendi başlıklarını bulamazsa "Test N" olur.
  state.heading = null;
}

const LETTERS = ["A", "B", "C", "D", "E"];
const NUMBER = /^(\d{1,3})[.)]$/;
const NUMBER_INLINE = /^(\d{1,3})[.)]\s+\S/;
/** Şık işareti: "A)", "B )", OCR hataları ("EB)", "O)", "Di)", "8)") dahil kısa bir önek + ")" */
const CHOICE_MARK = /^[(\[]?([A-Za-zÇĞİÖŞÜçğıöşü0-9]{1,2})\s?[)\]]/;
/** "TÜRKÇE TESTİ", "1. TEST" gibi başlıklar (\b Türkçe harflerde çalışmadığı için boşlukla) */
const HEADING = /(^|\s)TEST(İ|I)?(\s|$)/u;

/** Bir satırdaki parçalar (aynı sütun, üst kenarları birbirine yakın). */
interface Line {
  y: number;
  bottom: number;
  x: number;
  items: TextItem[];
  text: string;
}

function toLines(items: TextItem[]): Line[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l.y - it.y) < Math.max(3, it.h * 0.45));
    if (line) {
      line.items.push(it);
      line.bottom = Math.max(line.bottom, it.y + it.h);
      line.x = Math.min(line.x, it.x);
    } else {
      lines.push({ y: it.y, bottom: it.y + it.h, x: it.x, items: [it], text: "" });
    }
  }
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x);
    l.text = l.items.map((i) => i.s).join(" ").replace(/\s+/g, " ").trim();
  }
  return lines.sort((a, b) => a.y - b.y);
}

/** "12.C", "12-C", "12) C" gibi tek parça cevap çifti */
const KEY_PAIR = /^(\d{1,3})\s*[.)\-:]\s*([A-E])$/;

/**
 * Sayfa altbilgisinin üst sınırı. Altbilgi: sayfa numarası (ortada ya da köşede), "Diğer sayfaya geçiniz."
 * satırı ve bazı yayınevlerinin sayfa altına koyduğu cevap şeridi ("1.A 2.A 3.D…").
 */
function footerTop(p: PageText): number {
  const mid = p.width / 2;
  const footer = p.items.filter(
    (i) =>
      (i.y > p.height * 0.75 &&
        ((/^\d{1,4}$/.test(i.s) && Math.abs(i.x + i.w / 2 - mid) < p.width * 0.08) ||
          /sayfaya geçiniz|kontrol ediniz|sayfaya geçin/i.test(i.s))) ||
      (i.y > p.height * 0.9 && /^\d{1,4}$/.test(i.s.trim())) ||
      (i.y > p.height * 0.85 && KEY_PAIR.test(i.s.trim())),
  );
  return footer.length ? Math.min(...footer.map((i) => i.y)) - 6 : p.height;
}

/**
 * Sayfa altı cevap şeridi: sayfanın alt %15'indeki "1.A", "2.B"… çiftleri o sayfadaki soruların cevabıdır.
 * En az iki çift yoksa şerit yok sayılır.
 */
export function parsePageBottomKey(p: PageText): Map<number, string> | null {
  const band = p.items.filter((i) => i.y > p.height * 0.85);
  const map = new Map<number, string>();
  for (const it of band) {
    const pair = KEY_PAIR.exec(it.s.trim());
    if (pair) {
      map.set(Number(pair[1]), pair[2]!);
      continue;
    }
    // Numara ve harf ayrı parçalarsa ("1." + "A")
    const num = /^(\d{1,3})[.)\-:]?$/.exec(it.s.trim());
    const letter = num && band.find((l) => /^[A-E]$/.test(l.s.trim()) && Math.abs(l.y - it.y) < 3 && l.x > it.x && l.x - (it.x + it.w) < 8);
    if (num && letter) map.set(Number(num[1]), letter.s.trim());
  }
  return map.size >= 2 ? map : null;
}

/** Sayfa bir cevap anahtarı mı? "12. C" çiftleri çoğunluktaysa evet. */
export function parseAnswerKeyPage(p: PageText): { heading: string | null; answers: Map<number, string> }[] | null {
  const lines = toLines(p.items);
  let pairs = 0;
  let pairLines = 0;
  for (const l of lines) {
    const n = [...l.text.matchAll(/(\d{1,3})\s?[.)-]\s?([A-E])\b/g)].length;
    pairs += n;
    if (n) pairLines++;
  }
  if (pairs < 10 || pairLines < lines.length * 0.4) return null;

  // Sütun sütun oku: her başlık ("… TESTİ") kendi altındaki çiftleri toplar.
  const headings = p.items.filter((i) => isHeading(i.s));
  const groups = new Map<TextItem | null, Map<number, string>>();
  const numbers = p.items.filter((i) => /^\d{1,3}[.)-]?$/.test(i.s));
  for (const n of numbers) {
    const letter = p.items.find((i) => /^[A-E]$/.test(i.s) && Math.abs(i.y - n.y) < 3 && i.x > n.x && i.x - n.x < 60);
    const inline = /^(\d{1,3})[.)-]?\s?([A-E])$/.exec(n.s);
    const value = letter?.s ?? inline?.[2];
    if (!value) continue;
    const head =
      headings
        .filter((h) => h.y < n.y && n.x >= h.x - 40 && n.x <= h.x + Math.max(h.w, 120))
        .sort((a, b) => b.y - a.y)[0] ?? null;
    const map = groups.get(head) ?? new Map<number, string>();
    map.set(Number.parseInt(n.s, 10), value);
    groups.set(head, map);
  }
  // Satır içi "1-C 2-A" gibi tek parça metinler (metin katmanı birleştirilmişse)
  if (!groups.size) {
    const map = new Map<number, string>();
    for (const l of lines) for (const m of l.text.matchAll(/(\d{1,3})\s?[.)-]\s?([A-E])\b/g)) map.set(Number(m[1]), m[2]!);
    groups.set(null, map);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a && b ? a.x - b.x || a.y - b.y : 0))
    .map(([h, answers]) => ({ heading: h ? titleCase(h.s) : null, answers }));
}

function isHeading(s: string) {
  const upper = s.trim().toLocaleUpperCase("tr-TR");
  return HEADING.test(upper) && upper.length > 5 && upper.length < 60;
}

/** Başlık parçasını aynı satırda hemen ardından gelen parçalarla birleştirir ("MAVİ TEST" + "-02"). */
function headingText(head: TextItem, items: TextItem[]) {
  const parts = [head];
  let end = head.x + head.w;
  for (const it of items.filter((i) => Math.abs(i.y - head.y) < 3 && i.x > head.x).sort((a, b) => a.x - b.x)) {
    if (it.x - end > 12) break;
    parts.push(it);
    end = it.x + it.w;
  }
  return titleCase(parts.map((i) => i.s.trim()).join(" ").replace(/\s*-\s*/g, "-").slice(0, 60));
}

function titleCase(s: string) {
  return s
    .toLocaleLowerCase("tr-TR")
    .split(/\s+/)
    .map((w) => w.charAt(0).toLocaleUpperCase("tr-TR") + w.slice(1))
    .join(" ");
}

/**
 * Bir sayfanın sorularını bulur. Sütunlar sayfa ortasından ayrılır (tek sütunlu sayfalarda sağ sütun boş kalır).
 * `state` sayfalar arasında taşınır ve yerinde güncellenir.
 */
export function detectPage(p: PageText, state: DetectState, defaultChoiceCount = 5): DetectedQuestion[] {
  const mid = p.width / 2;
  const bottomLimit = footerTop(p);
  const items = p.items.filter((i) => i.s.trim() && i.y < bottomLimit);

  // Sayfa başlığındaki test adı (ör. "TEMEL MATEMATİK TESTİ")
  const heading = items.find((i) => i.y < p.height * 0.2 && isHeading(i.s));
  if (heading) state.heading = headingText(heading, items);
  let startedOnPage = false;

  const out: DetectedQuestion[] = [];
  const columns = [items.filter((i) => i.x < mid), items.filter((i) => i.x >= mid)].map((colItems) => {
    const lines = toLines(colItems);
    const starts = lines.map((l) => l.x).sort((a, b) => a - b);
    // Metnin sol kenarı: satır başlarının ortancası (soru numaraları genelde bunun solunda "asılı" durur)
    const right = Math.max(0, ...colItems.map((i) => i.x + i.w));
    return { lines, textEdge: starts[Math.floor(starts.length / 2)] ?? 0, left: starts[0] ?? 0, right };
  });
  for (const [col, { lines, textEdge, left, right }] of columns.entries()) {
    if (!lines.length) continue;

    // Aday: satırın ilk parçası "12." biçiminde
    const candidates = lines.flatMap((l, index) => {
      const first = l.items[0]!;
      const m = NUMBER.exec(first.s.trim()) ?? NUMBER_INLINE.exec(first.s.trim());
      return m && first.x - left < 30 ? [{ index, number: Number(m[1]), line: l, hanging: first.x < textEdge - 4 }] : [];
    });
    // Numaralar metnin solunda asılıysa yalnızca onlar sayılır; metin içindeki "1. nesil…" gibi satırlar elenir.
    const hanging = candidates.filter((c) => c.hanging);
    const pool = hanging.length ? hanging : candidates;

    // Gövdesi şıksız ve kısa olanlar yönerge satırıdır ("1. Bu testte 40 soru vardır.").
    const starts = pool.filter((c, k) => {
      const body = lines.slice(c.index, pool[k + 1]?.index ?? lines.length);
      const height = body[body.length - 1]!.bottom - c.line.y;
      return countChoiceMarks(body) >= 2 || height > 60;
    });

    for (const [k, start] of starts.entries()) {
      // Numara sırası: 1 yeni testi başlatır; geri giden ya da çok ileri atlayan numara soru sayılmaz.
      const expected = state.lastNumber + 1;
      const isNewTest = start.number === 1 && state.lastNumber !== 0;
      if (state.section !== null && !isNewTest && (start.number < expected || start.number > expected + 4)) continue;

      const endIndex = starts[k + 1]?.index ?? lines.length;
      const body = lines.slice(start.index, endIndex);
      const last = body[body.length - 1]!;
      const colLeft = col === 0 ? Math.max(0, left - 10) : Math.max(mid, left - 10);
      const colRight = col === 0 ? mid - 4 : Math.min(p.width, right + 8);

      if (state.section === null || isNewTest) {
        startTest(state);
        startedOnPage = true;
      }
      state.lastNumber = start.number;

      const { choices, count } = readChoices(body, defaultChoiceCount);
      const top = Math.max(0, start.line.y - 8);
      out.push({
        section: state.section!,
        number: start.number,
        numberRead: true,
        page: p.page,
        x: round(colLeft),
        y: round(top),
        w: round(colRight - colLeft),
        h: round(Math.min(bottomLimit, last.bottom + 10) - top),
        choiceCount: count,
        answer: null,
        choices,
      });
    }
  }
  nameCurrentTest(state, startedOnPage);
  return out;
}

function countChoiceMarks(body: Line[]) {
  return body.reduce((n, l, li) => n + l.items.filter((it, ii) => isChoiceMark(it.s, li === 0 && ii === 0)).length, 0);
}

/** Romen rakamlı öncüller ("I)", "II)") ve sorunun kendi numarası şık değildir. */
function isChoiceMark(s: string, isFirst: boolean) {
  const m = CHOICE_MARK.exec(s.trim());
  return !!m && !isFirst && !/^(I{1,3}|IV|V|VI{0,3})$/.test(m[1]!);
}

/**
 * Şıkları okur: satır başındaki ya da satır içindeki "X)" işaretleri sırayla A, B, C… sayılır (OCR'ın yanlış
 * okuduğu harfler de böylece doğru şıkka düşer). Şık metni, bir sonraki işarete kadar olan metindir.
 */
function readChoices(body: Line[], defaultCount: number): { choices: string[]; count: number } {
  const marks: { line: number; item: number }[] = [];
  body.forEach((l, li) =>
    l.items.forEach((it, ii) => {
      if (isChoiceMark(it.s, li === 0 && ii === 0)) marks.push({ line: li, item: ii });
    }),
  );
  // Şıklar sorunun sonundaki son N işarettir (öncüllerde "a)" gibi işaretler olabilir).
  const picked = marks.slice(-5);
  if (picked.length < 2) return { choices: [], count: defaultCount };
  const texts: string[] = [];
  for (const [k, mark] of picked.entries()) {
    const next = picked[k + 1];
    const parts: string[] = [];
    for (let li = mark.line; li < body.length; li++) {
      const items = body[li]!.items;
      const from = li === mark.line ? mark.item : 0;
      const to = next && next.line === li ? next.item : items.length;
      if (next && li > next.line) break;
      if (li > mark.line && next && li === next.line && next.item === 0) break;
      parts.push(...items.slice(from, to).map((i) => i.s));
      if (next && li === next.line) break;
    }
    texts.push(parts.join(" ").replace(CHOICE_MARK, "").replace(/\s+/g, " ").trim());
  }
  const count = picked.length >= 4 ? picked.length : defaultCount;
  return { choices: texts.slice(0, count), count };
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * OCR'lı sayfalar için: soru numaraları sık kaçırıldığından her soru, son şıkkıyla biten bir şık kümesi olarak
 * bulunur. Soru, sütunda önceki sorunun bittiği yerden başlar. Numara okunabildiyse o, okunamadıysa sıradaki
 * numara verilir (öğrenci düzenleyicide düzeltir).
 */
export function detectPageByChoices(p: PageText, state: DetectState, defaultChoiceCount = 5): DetectedQuestion[] {
  const mid = p.width / 2;
  const bottomLimit = footerTop(p);
  const contentTop = p.height * 0.08;
  const items = p.items.filter((i) => i.s.trim() && i.y < bottomLimit && i.y > contentTop);
  const heading = p.items.find((i) => i.y < p.height * 0.2 && isHeading(i.s));
  if (heading) state.heading = headingText(heading, p.items);
  let startedOnPage = false;

  const out: DetectedQuestion[] = [];
  for (const col of [0, 1]) {
    const colItems = items.filter((i) => (col === 0 ? i.x + i.w / 2 < mid : i.x + i.w / 2 >= mid));
    if (!colItems.length) continue;
    const lines = toLines(colItems);
    const left = Math.min(...lines.map((l) => l.x));
    const right = Math.max(...colItems.map((i) => i.x + i.w));
    const isChoiceLine = (l: Line) => l.items.some((it, ii) => isChoiceMark(it.s, false) && (ii === 0 || it.x - l.x < 40 || l.items.filter((x) => isChoiceMark(x.s, false)).length >= 2));

    let begin = 0;
    let i = 0;
    while (i < lines.length) {
      if (!isChoiceLine(lines[i]!)) {
        i++;
        continue;
      }
      // Şık kümesi: art arda gelen şık satırları (çok satırlı şıkların devam satırları dahil)
      let end = i;
      let marks = 0;
      for (let j = i; j < lines.length; j++) {
        const l = lines[j]!;
        if (isChoiceLine(l)) {
          marks += l.items.filter((it) => isChoiceMark(it.s, false)).length;
          end = j;
        } else if (j - end > 1 || marks >= defaultChoiceCount) break;
        if (marks >= defaultChoiceCount) break;
      }
      if (marks < 2) {
        i = end + 1;
        continue;
      }
      const body = lines.slice(begin, end + 1);
      const first = body[0]!;
      // Numara yalnızca sütunun sol kenarındaysa sayılır; girintili "I." öncülleri OCR'da "1." okunabiliyor.
      const lead = first.items[0]!;
      const numberMatch = lead.x - left < 8 ? (NUMBER.exec(lead.s) ?? NUMBER_INLINE.exec(lead.s)) : null;
      const number = numberMatch ? Number(numberMatch[1]) : state.lastNumber + 1;
      if (state.section === null || (number === 1 && state.lastNumber !== 0)) {
        startTest(state);
        startedOnPage = true;
      }
      state.lastNumber = number;
      const { choices, count } = readChoices(body, defaultChoiceCount);
      const top = Math.max(0, first.y - 8);
      const last = body[body.length - 1]!;
      const x = Math.max(col === 0 ? 0 : mid, left - 10);
      out.push({
        section: state.section!,
        number,
        numberRead: !!numberMatch,
        page: p.page,
        x: round(x),
        y: round(top),
        w: round(Math.min(col === 0 ? mid - 4 : p.width, right + 8) - x),
        h: round(Math.min(bottomLimit, last.bottom + 10) - top),
        choiceCount: count,
        answer: null,
        choices,
      });
      begin = end + 1;
      i = end + 1;
    }
  }
  nameCurrentTest(state, startedOnPage);
  return out;
}

/**
 * Tüm sayfaları sırayla tarar; cevap anahtarı sayfalarını ayırır ve anahtarı testlere eşler:
 * önce başlık adıyla, olmazsa sırayla (anahtardaki 1. grup → 1. test…).
 */
export function detectDocument(
  pages: PageText[],
  { defaultChoiceCount = 5, keyMethod = "auto" }: { defaultChoiceCount?: number; keyMethod?: AnswerKeyMethod } = {},
): DetectedQuestion[] {
  const state = initialDetectState();
  const questions: DetectedQuestion[] = [];
  const keys: { heading: string | null; answers: Map<number, string> }[] = [];
  for (const p of pages) {
    const key = keyMethod === "auto" || keyMethod === "lastPages" ? parseAnswerKeyPage(p) : null;
    if (key) {
      keys.push(...key);
      continue;
    }
    const found = p.ocr ? detectPageByChoices(p, state, defaultChoiceCount) : detectPage(p, state, defaultChoiceCount);
    if (keyMethod === "auto" || keyMethod === "pageBottom") applyPageBottomKey(p, found);
    questions.push(...found);
  }
  applyRenames(questions, state);
  repairRestarts(questions);
  applyAnswerKeys(questions, keys);
  return questions;
}

/** Sonradan adı bulunan testlerin önceki sayfalardaki sorularını da yeniden adlandırır. */
export function applyRenames(questions: { section: string }[], state: DetectState) {
  for (const q of questions) {
    let name = q.section;
    for (let guard = 0; state.renames.has(name) && guard < 10; guard++) name = state.renames.get(name)!;
    q.section = name;
  }
}

/** Sayfa altı cevap şeridini o sayfanın sorularına numarayla işler; işlenen cevap sayısını döner. */
export function applyPageBottomKey(p: PageText, questions: { page: number; number: number; answer: string | null }[]) {
  const key = parsePageBottomKey(p);
  if (!key) return 0;
  let count = 0;
  for (const q of questions) {
    const letter = q.page === p.page ? key.get(q.number) : undefined;
    if (!letter) continue;
    q.answer = letter;
    count++;
  }
  return count;
}

/**
 * OCR'da numaralar kaçırılabildiği için test başı ("1.") okunamayabilir. Okunan bir numara bir öncekinden
 * küçükse yeni test başlamış demektir: o numaradan geriye sayılarak okunamamış önceki sorular 1, 2, 3…
 * olur ve yeni test oradan açılır. Okunamayan numaralar sıradan yeniden verilir; böylece bir testte aynı
 * numara iki kez geçmez.
 */
function repairRestarts(questions: DetectedQuestion[]) {
  if (!questions.some((q) => q.numberRead === false)) return;
  const used = new Set(questions.map((q) => q.section));
  const unique = (base: string) => {
    let name = base;
    for (let i = 2; used.has(name); i++) name = `${base} (${i})`;
    used.add(name);
    return name;
  };
  let testCount = new Set(questions.map((q) => q.section)).size;
  let section: string | null = null;
  let original: string | null = null;
  let last = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]!;
    if (q.section !== original) {
      // Bulucunun açtığı yeni test (1. soru okundu ya da başlık değişti)
      original = q.section;
      section = q.section;
      last = 0;
    }
    if (q.numberRead && q.number <= last) {
      // Geriye dönüş: önceki (numarası okunamamış) n-1 soru yeni testin başıdır.
      const back = Math.min(q.number - 1, i);
      const startIndex = i - back;
      const canMove = questions.slice(startIndex, i).every((x) => x.numberRead === false && x.section === section);
      section = unique(`Test ${++testCount}`);
      if (canMove) questions.slice(startIndex, i).forEach((x, k) => Object.assign(x, { section, number: k + 1 }));
    } else if (!q.numberRead) {
      q.number = last + 1;
    }
    q.section = section!;
    last = q.number;
  }
}

export function applyAnswerKeys(
  questions: DetectedQuestion[],
  keys: { heading: string | null; answers: Map<number, string> }[],
) {
  const sections = [...new Set(questions.map((q) => q.section))];
  const norm = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
  const used = new Set<number>();
  for (const section of sections) {
    let index = keys.findIndex((k, i) => !used.has(i) && k.heading && norm(k.heading) === norm(section));
    if (index < 0) index = keys.findIndex((_, i) => !used.has(i));
    if (index < 0) break;
    used.add(index);
    for (const q of questions.filter((q) => q.section === section)) q.answer = keys[index]!.answers.get(q.number) ?? q.answer;
  }
}

/** "CABDE…", "1-C 2-A …", "1. C, 2. A" gibi yazılmış anahtarı numara → harf eşlemesine çevirir. */
export function parseAnswerKeyText(text: string): Map<number, string> {
  const map = new Map<number, string>();
  const upper = text.toLocaleUpperCase("tr-TR");
  const pairs = [...upper.matchAll(/(\d{1,3})\s*[.)\-:]?\s*([A-E])\b/g)];
  if (pairs.length) {
    for (const m of pairs) map.set(Number(m[1]), m[2]!);
    return map;
  }
  [...upper.replace(/[^A-E]/g, "")].forEach((letter, i) => map.set(i + 1, letter));
  return map;
}

export { LETTERS as CHOICE_LETTER_ORDER };
