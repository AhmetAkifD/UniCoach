"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Info,
  KeyRound,
  Loader2,
  Pause,
  ScanSearch,
  SplitSquareVertical,
  Trash2,
  X,
} from "lucide-react";
import {
  ANSWER_KEY_METHOD_LABELS,
  ANSWER_KEY_METHODS,
  ApiError,
  CHOICE_LETTERS,
  DETECT_METHOD_LABELS,
  DETECT_METHODS,
  type AnswerKeyMethod,
  type DetectMethod,
  findSubject,
  type BookQuestion,
  type BookSummary,
  type ChoiceLetter,
  MIN_QUESTION_BOX,
  applyTestKey,
  detectOnPage,
  duplicateQuestionKeys,
  pageDetectionNotice,
  pageHasText,
  parseAnswerKeyText,
  questionForBox,
  questionsForSave,
  readLastPageKeys,
  rectFromPoints,
  roundRect,
  scanDocument,
  scanNotice,
  sortQuestions,
  splitTestFrom,
  suggestTestName,
  testNameTaken,
  testSections,
  DEFAULT_PAGE_WIDTH,
  type AnswerKeyGroups,
  type EditorQuestion,
  type PageText,
  type QuestionRect,
} from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDialog } from "@/components/ui/use-dialog";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { openPdf, pageText, type PDFDocumentProxy } from "@/lib/pdf";
/** Düzenleyicideki soru (kurallar packages/shared/src/question-editing.ts'te; mobil de aynılarını kullanır). */
type Q = EditorQuestion;
type Rect = QuestionRect;
/** Boyutlandırma tutamacı: kenar (n, s, e, w) ya da köşe (nw, ne, sw, se). */
type Edge = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
type Drag =
  | { kind: "move"; key: string; start: { x: number; y: number }; orig: Rect }
  | { kind: "resize"; key: string; edge: Edge; orig: Rect }
  | { kind: "draw"; start: { x: number; y: number } };
type Notice = { tone: "success" | "danger" | "info"; text: string };

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

export function QuestionEditor({
  book,
  initial,
  focusId,
  examId,
}: {
  book: BookSummary;
  initial: BookQuestion[];
  /** Sınavdan "kaynağında düzenle" ile gelindiyse açılıp seçilecek soru */
  focusId?: string;
  /** Sınavdan gelindiyse o sınav (süresi durdurulmuştur); dönüşte devam ettirilir. */
  examId?: string;
}) {
  const focus = initial.find((q) => q.id === focusId);
  const router = useRouter();
  const defaultChoiceCount = findSubject(book.subject)?.track === "LGS" ? 4 : 5;
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(focus?.page ?? 1);
  const [questions, setQuestions] = useState<Q[]>(() => initial.map(({ id, ...q }) => ({ ...q, key: id })));
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(focus?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [keyPanel, setKeyPanel] = useState(false);
  const [detectMethod, setDetectMethod] = useState<DetectMethod>(book.detectMethod);
  const [keyMethod, setKeyMethod] = useState<AnswerKeyMethod>(book.keyMethod);
  /** Yöntem seçimi PDF'e hemen kaydedilir (sorulardan bağımsız). */
  function saveMethods(value: { detectMethod?: DetectMethod; keyMethod?: AnswerKeyMethod }) {
    if (value.detectMethod) setDetectMethod(value.detectMethod);
    if (value.keyMethod) setKeyMethod(value.keyMethod);
    browserApi.books.update(book.id, value).catch(() =>
      setNotice({ tone: "danger", text: "Seçim kaydedilemedi; bu oturumda yine de kullanılır." }),
    );
  }
  /** Numarası girilmeyi bekleyen yeni kutu */
  const [askNumber, setAskNumber] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const leavingRef = useRef(false);
  const { confirm, prompt, alert, dialog } = useDialog();
  const pageWidths = useRef(new Map<number, number>());
  const pageCount = doc?.numPages ?? book.pageCount ?? 0;

  const edit = useCallback((fn: (qs: Q[]) => Q[]) => {
    setQuestions(fn);
    setDirty(true);
  }, []);

  // --- PDF ---
  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    const task = openPdf(browserApi.books.filePath(book.id));
    task
      .then((t) => t.promise)
      .then((pdf) => !cancelled && setDoc(pdf))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
      void task.then((t) => t.destroy());
    };
  }, [book.id, attempt]);

  // Kaydedilmemiş değişiklik varken sayfadan çıkılırsa uyar.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (!leavingRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const widthOf = (p: number) => pageWidths.current.get(p) ?? DEFAULT_PAGE_WIDTH;
  const sorted = useMemo(
    () => sortQuestions(questions, widthOf),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions],
  );
  const onPage = sorted.filter((q) => q.page === page);
  const current = questions.find((q) => q.key === selected) ?? null;
  const sections = testSections(sorted);

  /** Aynı testte aynı numara iki kez varsa kaydedilemez. */
  const duplicates = useMemo(() => duplicateQuestionKeys(questions), [questions]);

  // --- Soru bulma ---
  /** Sayfanın metni; `allowOcr` kapalıysa metinsiz sayfa OCR'a gönderilmez (boş döner). */
  async function readPage(n: number, allowOcr = true): Promise<PageText> {
    if (!doc) throw new Error("PDF açılmadı.");
    const text = await pageText(doc, n);
    pageWidths.current.set(n, text.width);
    if (detectMethod === "text" || (detectMethod === "auto" && (pageHasText(text) || !allowOcr))) return text;
    const { ocrPageText } = await import("@/lib/ocr");
    return { ...(await ocrPageText(doc, n)), ocr: true };
  }

  /** Ayrı cevap anahtarı sayfaları (ÖSYM): PDF başına bir kez okunur; "Bu sayfada bul" da cevapları buradan alır. */
  const lastPageKeysRef = useRef<Promise<AnswerKeyGroups | null> | null>(null);
  function lastPageKeys() {
    const pdf = doc;
    if (!pdf) return Promise.resolve(null);
    lastPageKeysRef.current ??= readLastPageKeys(pdf.numPages, (n) => pageText(pdf, n));
    return lastPageKeysRef.current;
  }

  async function detectThisPage() {
    if (!doc) return;
    if (
      onPage.length &&
      !(await confirm({
        title: "Bu sayfayı yeniden tara",
        message: `Bu sayfadaki ${onPage.length} soru silinip yeniden bulunsun mu?`,
        confirmLabel: "Yeniden bul",
      }))
    )
      return;
    setNotice(null);
    setBusy(`${page}. sayfa okunuyor…`);
    try {
      const text = await readPage(page);
      if (text.ocr) setBusy("Metin tanıma (OCR) çalışıyor…");
      const result = detectOnPage({
        text,
        sorted,
        keyMethod,
        defaultChoiceCount,
        lastPageKeys: keyMethod === "auto" || keyMethod === "lastPages" ? await lastPageKeys() : null,
      });
      edit(() => result.questions);
      if (result.kind === "questions") setSelected(null);
      setNotice(pageDetectionNotice(result));
    } catch {
      setNotice({ tone: "danger", text: "Sayfa okunamadı." });
    } finally {
      setBusy(null);
    }
  }

  async function detectAll() {
    if (!doc) return;
    if (
      questions.length &&
      !(await confirm({
        title: "Tüm PDF'i yeniden tara",
        message: `Mevcut ${questions.length} soru silinip tüm PDF yeniden taransın mı?`,
        confirmLabel: "Yeniden tara",
      }))
    )
      return;
    setNotice(null);
    cancelRef.current = false;
    try {
      const pdf = doc;
      const result = await scanDocument({
        pageCount: pdf.numPages,
        detectMethod,
        keyMethod,
        defaultChoiceCount,
        readText: readPage,
        readTextLayer: (n) => pageText(pdf, n),
        onProgress: setBusy,
        cancelled: () => cancelRef.current,
      });
      if (!result) {
        setNotice({ tone: "info", text: "Tarama durduruldu; sorular değişmedi." });
        return;
      }
      edit(() => result.questions);
      setSelected(null);
      setPage(result.questions[0]?.page ?? 1);
      setNotice(scanNotice(result.questions, result.ocrPages));
    } catch {
      setNotice({ tone: "danger", text: "PDF taranırken bir hata oldu." });
    } finally {
      setBusy(null);
    }
  }

  /** Kaydeder; başarılıysa true. */
  async function save(): Promise<boolean> {
    if (duplicates.size) return false;
    setSaving(true);
    setNotice(null);
    try {
      const saved = await browserApi.books.saveQuestions(book.id, {
        // Kayıtlı soruların kimliği gönderilir; sınavlardaki bağlantılar kopmaz.
        questions: questionsForSave(sorted),
      });
      setQuestions(saved.map(({ id, ...q }) => ({ ...q, key: id })));
      setSelected((s) => {
        const index = sorted.findIndex((q) => q.key === s);
        return index >= 0 ? (saved[index]?.id ?? null) : null;
      });
      setDirty(false);
      setNotice({ tone: "success", text: `${saved.length} soru kaydedildi.` });
      router.refresh();
      return true;
    } catch (err) {
      setNotice({ tone: "danger", text: err instanceof ApiError ? (err.errors?.questions ?? err.message) : "Kaydedilemedi." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  /** Sınava dön: değişiklik varsa önce kaydedilir; sınav devam ettirilir ve düzeltme sınava yansır. */
  async function backToExam(saveFirst: boolean) {
    if (saveFirst && dirty && !(await save())) return;
    if (!saveFirst && dirty) {
      const discard = await confirm({
        title: "Kaydetmeden dön",
        message: "Kaydedilmemiş değişiklikler kaybolacak. Sınava dönülsün mü?",
        confirmLabel: "Dön",
        danger: true,
      });
      if (!discard) return;
      setDirty(false);
    }
    // Kaydedildi ya da vazgeçildi: çıkış uyarısı gösterilmez.
    leavingRef.current = true;
    window.location.assign(`/sinavlar/${examId}?devam=1`);
  }

  // --- Sayfayı çiz ---
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [rendered, setRendered] = useState(0);
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    observer.observe(area);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!doc || !width) return;
    let cancelled = false;
    let cancelTask: (() => void) | undefined;
    void (async () => {
      const pdfPage = await doc.getPage(page);
      if (cancelled) return;
      const base = pdfPage.getViewport({ scale: 1 });
      pageWidths.current.set(page, base.width);
      setSize({ w: base.width, h: base.height });
      const viewport = pdfPage.getViewport({ scale: width / base.width });
      const ratio = window.devicePixelRatio || 1;
      const canvas = canvasRef.current!;
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      const task = pdfPage.render({ canvas, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] });
      cancelTask = () => task.cancel();
      try {
        await task.promise;
        if (!cancelled) setRendered((r) => r + 1);
      } catch {
        // Yeni sayfaya geçildiği için iptal edildi.
      }
    })();
    return () => {
      cancelled = true;
      cancelTask?.();
    };
  }, [doc, page, width]);
  const scale = size ? width / size.w : 1;

  // --- Kutuları sürükleme, boyutlandırma ve çizme ---
  const dragRef = useRef<Drag | null>(null);
  const [ghost, setGhost] = useState<Rect | null>(null);
  const toPoint = (e: ReactPointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(Math.max(0, (e.clientX - rect.left) / scale), size?.w ?? 0),
      y: Math.min(Math.max(0, (e.clientY - rect.top) / scale), size?.h ?? 0),
    };
  };
  const setRect = (key: string, rect: Rect) =>
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...roundRect(rect) } : q)));

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || busy) return;
    const target = e.target as HTMLElement;
    const key = target.closest<HTMLElement>("[data-key]")?.dataset.key;
    const edge = target.dataset.edge as Edge | undefined;
    const point = toPoint(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (key) {
      const q = questions.find((x) => x.key === key)!;
      setSelected(key);
      dragRef.current = edge
        ? { kind: "resize", key, edge, orig: { x: q.x, y: q.y, w: q.w, h: q.h } }
        : { kind: "move", key, start: point, orig: { x: q.x, y: q.y, w: q.w, h: q.h } };
    } else {
      setSelected(null);
      dragRef.current = { kind: "draw", start: point };
      setGhost({ ...point, w: 0, h: 0 });
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || !size) return;
    const p = toPoint(e);
    if (drag.kind === "draw") {
      setGhost(rectFromPoints(drag.start, p));
    } else if (drag.kind === "move") {
      const x = Math.min(Math.max(0, drag.orig.x + p.x - drag.start.x), size.w - drag.orig.w);
      const y = Math.min(Math.max(0, drag.orig.y + p.y - drag.start.y), size.h - drag.orig.h);
      setRect(drag.key, { ...drag.orig, x, y });
    } else {
      // Tutulan kenar(lar) imleci izler, karşı kenar sabit kalır.
      const o = drag.orig;
      const left = drag.edge.includes("w") ? p.x : o.x;
      const right = drag.edge.includes("e") ? p.x : o.x + o.w;
      const top = drag.edge.includes("n") ? p.y : o.y;
      const bottom = drag.edge.includes("s") ? p.y : o.y + o.h;
      setRect(drag.key, rectFromPoints({ x: left, y: top }, { x: right, y: bottom }));
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.kind !== "draw") return setDirty(true);
    // Kutu bırakılan noktadan hesaplanır (hızlı sürüklemede son çizim ekrana yansımamış olabilir).
    const rect = rectFromPoints(drag.start, toPoint(e));
    setGhost(null);
    if (!rect || rect.w < MIN_QUESTION_BOX || rect.h < MIN_QUESTION_BOX) return;
    const q = questionForBox({ rect, page, sorted, widthOf, defaultChoiceCount });
    edit((qs) => [...qs, q]);
    setSelected(q.key);
    // Yeni kutunun numarası hemen sorulur: önerilen numara seçili gelir, yazıp Enter'a basılır.
    setAskNumber(q.key);
  }

  const removeSelected = useCallback(() => {
    if (!selected) return;
    edit((qs) => qs.filter((q) => q.key !== selected));
    setSelected(null);
  }, [selected, edit]);

  // Kısayollar: A–E seçili sorunun cevabı, ← → sayfa, Delete seçili kutuyu siler, Esc seçimi bırakır.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey || document.querySelector("dialog[open]")) return;
      const index = CHOICE_LETTERS.indexOf(e.key.toUpperCase() as ChoiceLetter);
      const q = questions.find((x) => x.key === selected);
      if (q && index >= 0) {
        e.preventDefault();
        if (index < q.choiceCount) {
          const answer = CHOICE_LETTERS[index]!;
          edit((qs) => qs.map((x) => (x.key === q.key ? { ...x, answer } : x)));
        }
        return;
      }
      if (e.key === "ArrowRight") setPage((p) => Math.min(pageCount || p, p + 1));
      else if (e.key === "ArrowLeft") setPage((p) => Math.max(1, p - 1));
      else if (e.key === "Delete" || e.key === "Backspace") removeSelected();
      else if (e.key === "Escape") setSelected(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageCount, removeSelected, questions, selected, edit]);

  /**
   * Seçili sorudan başlayarak aynı testteki sonraki soruları yeni bir teste taşır ve 1'den numaralar.
   * OCR'ın kaçırdığı "test yeniden 1'den başlıyor" durumunu tek tıkla düzeltmek için.
   */
  async function splitFrom(key: string) {
    const from = sorted.find((q) => q.key === key);
    if (!from) return;
    const name = await prompt({
      title: "Buradan yeni test başlat",
      message: "Bu soru ve testteki sonrakiler yeni teste taşınır, 1'den numaralanır.",
      defaultValue: suggestTestName(sections),
      placeholder: "Yeni testin adı",
      confirmLabel: "Başlat",
    });
    if (!name) return;
    if (testNameTaken(sections, name, from.section)) {
      await alert({ title: "Bu ad kullanılıyor", message: `"${name}" adında bir test zaten var; başka bir ad seç.` });
      return;
    }
    edit((qs) => splitTestFrom(qs, sorted, key, name));
  }

  const patch = (key: string, value: Partial<Q>) => edit((qs) => qs.map((q) => (q.key === key ? { ...q, ...value } : q)));
  const answered = questions.filter((q) => q.answer).length;

  return (
    <div className="flex flex-col gap-6">
      {dialog}
      {examId && (
        <div className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-warning sm:flex-row sm:items-center">
          <span className="flex flex-1 items-start gap-2 text-sm">
            <Pause className="mt-0.5 size-4 shrink-0" aria-hidden />
            Sınavın duraklatıldı. Soruyu düzeltip sınava dönünce süre kaldığı yerden devam eder ve düzeltme sınava yansır.
          </span>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="ghost" onClick={() => void backToExam(false)} disabled={saving}>
              Sınava dön
            </Button>
            <Button size="sm" onClick={() => void backToExam(true)} loading={saving} disabled={duplicates.size > 0}>
              {dirty ? "Kaydet ve sınava dön" : "Sınava dön ve devam et"}
            </Button>
          </div>
        </div>
      )}
      <Link
        href={`/soru-bankasi/${book.id}`}
        className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> {book.title}
      </Link>

      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Soruları çıkar</h1>
          <ul className="flex max-w-2xl list-disc flex-col gap-1 pl-5 text-sm text-text-muted">
            <li>Boş bir yere sürükleyerek kutu çiz, numarasını yaz ve Enter'a bas.</li>
            <li>Kutuyu seçip A–E tuşlarıyla doğru cevabı işaretle.</li>
            <li>Kutuyu sürükleyerek taşı, kenar ve köşelerinden boyutlandır; Delete ile sil.</li>
            <li>← → ile sayfa değiştir.</li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void detectThisPage()} disabled={!doc || !!busy}>
            <ScanSearch className="size-4" aria-hidden /> Bu sayfada bul
          </Button>
          <Button variant="secondary" onClick={() => void detectAll()} disabled={!doc || !!busy}>
            <ScanSearch className="size-4" aria-hidden /> Tüm PDF'te bul
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={!dirty || !!busy || duplicates.size > 0}>
            Kaydet
          </Button>
        </div>
      </header>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-end">
        <MethodSelect
          label="Soruları bulma"
          value={detectMethod}
          options={DETECT_METHODS.map((m) => ({ value: m, label: DETECT_METHOD_LABELS[m] }))}
          onChange={(value) => saveMethods({ detectMethod: value })}
          disabled={!!busy}
        />
        <MethodSelect
          label="Cevap anahtarı"
          value={keyMethod}
          options={ANSWER_KEY_METHODS.map((m) => ({ value: m, label: ANSWER_KEY_METHOD_LABELS[m] }))}
          onChange={(value) => saveMethods({ keyMethod: value })}
          disabled={!!busy}
        />
        <p className="text-xs text-text-subtle sm:flex-1">
          Kitabın düzenine uyanı seç; bu PDF için hatırlanır. Otomatik, hepsini dener.
        </p>
      </div>

      {busy && (
        <div role="status" className="flex items-center gap-3 rounded-md bg-info-soft px-3.5 py-3 text-sm text-info">
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          <span className="flex-1">{busy}</span>
          <button type="button" onClick={() => (cancelRef.current = true)} className="font-medium underline underline-offset-2">
            Durdur
          </button>
        </div>
      )}
      {notice && !busy && (
        <div
          role={notice.tone === "danger" ? "alert" : "status"}
          className={cn(
            "flex items-start gap-2 rounded-md px-3.5 py-3 text-sm",
            notice.tone === "success" && "bg-success-soft text-success",
            notice.tone === "danger" && "bg-danger-soft text-danger",
            notice.tone === "info" && "bg-info-soft text-info",
          )}
        >
          {notice.tone === "success" ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : notice.tone === "danger" ? (
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          <span className="flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Kapat" className="shrink-0 opacity-70 hover:opacity-100">
            <X className="size-4" />
          </button>
        </div>
      )}
      {duplicates.size > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-3 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Aynı testte aynı numara birden fazla kez var (kırmızı kutular). Numaraları düzeltmeden kaydedemezsin.
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <IconButton label="Önceki sayfa" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft className="size-5" />
              </IconButton>
              <span className="min-w-20 text-center text-sm tabular-nums text-text-muted">
                {page} / {pageCount || "–"}
              </span>
              <IconButton label="Sonraki sayfa" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}>
                <ChevronRight className="size-5" />
              </IconButton>
            </div>
            <span className="text-sm text-text-muted tabular-nums">Bu sayfada {onPage.length} soru</span>
          </div>

          <div ref={areaRef} className="relative">
            {loadError ? (
              <Card className="flex flex-col items-center gap-3 py-14 text-center">
                <CircleAlert className="size-9 text-danger" strokeWidth={1.75} aria-hidden />
                <p className="font-semibold">PDF açılamadı.</p>
                <Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
                  Tekrar dene
                </Button>
              </Card>
            ) : (
              <div className="relative overflow-hidden rounded-md bg-white shadow-card" style={{ height: size ? size.h * scale : "70vh" }}>
                <canvas ref={canvasRef} className="block w-full" style={{ height: size ? size.h * scale : undefined }} />
                {!doc && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-black/40">
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> PDF açılıyor…
                  </div>
                )}
                {size && (
                  <div
                    className={cn("absolute inset-0 touch-none select-none", busy ? "cursor-wait" : "cursor-crosshair")}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                  >
                    {onPage.map((q) => (
                      <QuestionBox
                        key={q.key}
                        q={q}
                        scale={scale}
                        selected={q.key === selected}
                        duplicate={duplicates.has(q.key)}
                      />
                    ))}
                    {ghost && (
                      <div
                        className="absolute border-2 border-dashed border-primary bg-primary/10"
                        style={{ left: ghost.x * scale, top: ghost.y * scale, width: ghost.w * scale, height: ghost.h * scale }}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          {current ? (
            <QuestionForm
              key={current.key}
              q={current}
              sections={sections}
              canvas={current.page === page ? canvasRef.current : null}
              scale={scale}
              rendered={rendered}
              duplicate={duplicates.has(current.key)}
              onChange={(value) => patch(current.key, value)}
              onDelete={removeSelected}
              onSplit={() => void splitFrom(current.key)}
              askNumber={askNumber === current.key}
              onNumberDone={() => setAskNumber(null)}
              onClose={() => setSelected(null)}
            />
          ) : (
            <Card className="flex flex-col gap-3 p-4">
              <h2 className="font-semibold">Bu sayfadaki sorular</h2>
              {onPage.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {onPage.map((q) => (
                    <button
                      key={q.key}
                      type="button"
                      onClick={() => setSelected(q.key)}
                      className={cn(
                        "inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-sm tabular-nums",
                        duplicates.has(q.key) ? "border-danger text-danger" : "border-border text-text hover:border-border-strong",
                      )}
                    >
                      {q.number}
                      <span className={q.answer ? "font-semibold text-success" : "text-text-subtle"}>{q.answer ?? "?"}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">Henüz soru yok. "Bu sayfada bul"a bas ya da kutuyu kendin çiz.</p>
              )}
              <p className="text-xs text-text-subtle">Bir kutuya tıklayınca numarasını, cevabını ve şıklarını düzenleyebilirsin.</p>
            </Card>
          )}

          <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Testler</h2>
              <span className="text-sm text-text-muted tabular-nums">
                {questions.length} soru · {answered} cevaplı
              </span>
            </div>
            {sections.length ? (
              <ul className="flex flex-col gap-1.5 text-sm">
                {sections.map((s) => {
                  const list = sorted.filter((q) => q.section === s);
                  return (
                    <li key={s} className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        className="truncate text-left hover:underline"
                        onClick={() => {
                          setPage(list[0]!.page);
                          setSelected(null);
                        }}
                      >
                        {s}
                      </button>
                      <span className="shrink-0 text-text-muted tabular-nums">
                        {list.length} · {list.filter((q) => q.answer).length} cevaplı
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">Sorular bulununca testler burada listelenir.</p>
            )}
            {sections.length > 0 && (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => setKeyPanel((v) => !v)}>
                <KeyRound className="size-4" aria-hidden /> Cevap anahtarı gir
              </Button>
            )}
            {keyPanel && (
              <AnswerKeyForm
                sections={sections}
                onApply={(section, map) => {
                  const result = applyTestKey(questions, section, map);
                  edit(() => result.questions);
                  setNotice({ tone: "success", text: `"${section}" testine cevaplar işlendi.` });
                  setKeyPanel(false);
                  return result.count;
                }}
              />
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function QuestionBox({ q, scale, selected, duplicate }: { q: Q; scale: number; selected: boolean; duplicate: boolean }) {
  return (
    <div
      data-key={q.key}
      className={cn(
        "absolute cursor-move border-2",
        duplicate ? "border-danger bg-danger/5" : selected ? "border-primary bg-primary/10" : "border-info/70 hover:border-primary",
      )}
      style={{ left: q.x * scale, top: q.y * scale, width: q.w * scale, height: q.h * scale }}
    >
      <span
        className={cn(
          "pointer-events-none absolute -top-px left-0 inline-flex items-center gap-1 rounded-br-md px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white",
          duplicate ? "bg-danger" : selected ? "bg-primary" : "bg-info",
        )}
      >
        {q.number}
        <span className="opacity-80">{q.answer ?? "?"}</span>
      </span>
      {selected && (
        <>
          {/* Kenarlar: kutunun dört kenarı boyunca görünmez tutma şeritleri */}
          <span data-edge="n" className="absolute inset-x-2 -top-1.5 h-3 cursor-ns-resize" />
          <span data-edge="s" className="absolute inset-x-2 -bottom-1.5 h-3 cursor-ns-resize" />
          <span data-edge="w" className="absolute inset-y-2 -left-1.5 w-3 cursor-ew-resize" />
          <span data-edge="e" className="absolute inset-y-2 -right-1.5 w-3 cursor-ew-resize" />
          {(["nw", "ne", "sw", "se"] as const).map((edge) => (
            <span
              key={edge}
              data-edge={edge}
              className={cn(
                "absolute size-3 rounded-full border-2 border-white bg-primary",
                edge.includes("n") ? "-top-1.5" : "-bottom-1.5",
                edge.includes("w") ? "-left-1.5" : "-right-1.5",
                edge === "nw" || edge === "se" ? "cursor-nwse-resize" : "cursor-nesw-resize",
              )}
            />
          ))}
        </>
      )}
    </div>
  );
}

function QuestionForm({
  q,
  sections,
  canvas,
  scale,
  rendered,
  duplicate,
  onChange,
  onDelete,
  onSplit,
  askNumber,
  onNumberDone,
  onClose,
}: {
  q: Q;
  sections: string[];
  canvas: HTMLCanvasElement | null;
  scale: number;
  rendered: number;
  duplicate: boolean;
  onChange: (value: Partial<Q>) => void;
  onDelete: () => void;
  onSplit: () => void;
  askNumber: boolean;
  onNumberDone: () => void;
  onClose: () => void;
}) {
  // Sorunun kesilmiş hâli: sınavda gösterilecek görüntünün önizlemesi.
  const previewRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview || !canvas) return;
    const ratio = canvas.width / (canvas.clientWidth || 1);
    const sx = q.x * scale * ratio;
    const sy = q.y * scale * ratio;
    const sw = q.w * scale * ratio;
    const sh = q.h * scale * ratio;
    preview.width = Math.max(1, Math.floor(sw));
    preview.height = Math.max(1, Math.floor(sh));
    preview.getContext("2d")?.drawImage(canvas, sx, sy, sw, sh, 0, 0, preview.width, preview.height);
  }, [canvas, q.x, q.y, q.w, q.h, scale, rendered]);
  const listId = `sections-${q.key}`;
  const numberRef = useRef<HTMLInputElement>(null);
  const [numberDraft, setNumberDraft] = useState<string | null>(null);
  useEffect(() => {
    if (!askNumber) return;
    numberRef.current?.focus();
    numberRef.current?.select();
  }, [askNumber]);

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">
          {q.section} · {q.number}. soru
        </h2>
        <button type="button" onClick={onClose} aria-label="Kapat" className="text-text-muted hover:text-text">
          <X className="size-5" />
        </button>
      </div>
      {canvas && <canvas ref={previewRef} className="max-h-64 w-full rounded-md border border-border bg-white object-contain" />}

      <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
        <Input
          className="w-full min-w-0"
          placeholder="Test adı"
          value={q.section}
          onChange={(e) => onChange({ section: e.target.value })}
          list={listId}
          maxLength={60}
          error={q.section.trim() ? undefined : "Test adı yaz."}
        />
        <datalist id={listId}>
          {sections.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <Input
          ref={numberRef}
          className={cn("w-full min-w-0", askNumber && "border-primary")}
          placeholder="No"
          inputMode="numeric"
          value={numberDraft ?? String(q.number)}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
            setNumberDraft(digits);
            const n = Number(digits);
            if (n >= 1) onChange({ number: n });
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            // Enter numarayı onaylar; odak bırakılır ki A–E tuşlarıyla cevap hemen işaretlenebilsin.
            e.currentTarget.blur();
          }}
          onBlur={() => {
            setNumberDraft(null);
            onNumberDone();
          }}
          error={duplicate ? "Tekrar" : undefined}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Doğru cevap</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Doğru cevap">
          {CHOICE_LETTERS.slice(0, q.choiceCount).map((letter) => (
            <button
              key={letter}
              type="button"
              role="radio"
              aria-checked={q.answer === letter}
              onClick={() => onChange({ answer: q.answer === letter ? null : letter })}
              className={cn(
                "inline-flex size-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors duration-fast",
                q.answer === letter
                  ? "border-success bg-success-soft text-success"
                  : "border-border-strong text-text-muted hover:border-primary hover:text-text",
              )}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">Şık sayısı</span>
        {[4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() =>
              onChange({ choiceCount: n, answer: q.answer && CHOICE_LETTERS.indexOf(q.answer) >= n ? null : q.answer })
            }
            className={cn(
              "h-8 rounded-md border px-3 tabular-nums",
              q.choiceCount === n ? "border-primary bg-primary-soft text-primary-soft-text" : "border-border text-text-muted",
            )}
          >
            {n}
          </button>
        ))}
      </div>


      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={onSplit} title="Bu soru ve testteki sonrakiler yeni teste taşınır, 1'den numaralanır">
          <SplitSquareVertical className="size-4" aria-hidden /> Buradan yeni test başlat
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          <Trash2 className="size-4" aria-hidden /> Soruyu sil
        </Button>
      </div>
    </Card>
  );
}

function AnswerKeyForm({
  sections,
  onApply,
}: {
  sections: string[];
  onApply: (section: string, answers: Map<number, string>) => number;
}) {
  const [section, setSection] = useState(sections[0] ?? "");
  const [text, setText] = useState("");
  const parsed = parseAnswerKeyText(text);
  return (
    <form
      className="flex flex-col gap-2 border-t border-border pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (parsed.size) onApply(section, parsed);
      }}
    >
      <select
        aria-label="Test"
        value={section}
        onChange={(e) => setSection(e.target.value)}
        className="h-11 rounded-md border border-border-strong bg-surface px-3 text-text"
      >
        {sections.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <textarea
        aria-label="Cevap anahtarı"
        placeholder={'"CABDE…" ya da "1-C 2-A 3-B…"'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="rounded-md border border-border-strong bg-surface px-3 py-2 font-mono text-sm uppercase text-text placeholder:normal-case placeholder:text-text-subtle"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-text-muted tabular-nums">{parsed.size} cevap okundu</span>
        <Button type="submit" size="sm" disabled={!parsed.size}>
          Uygula
        </Button>
      </div>
    </form>
  );
}

function MethodSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-10 rounded-md border border-border-strong bg-surface px-3 text-text disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex size-9 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  );
}
