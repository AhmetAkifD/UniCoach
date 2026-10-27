import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Stack, useNavigation, usePreventRemove } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Info,
  ListChecks,
  ScanSearch,
  Settings2,
  SlidersHorizontal,
  SquareDashedMousePointer,
  X,
} from "lucide-react-native";
import { spacing } from "@unicoach/design";
import {
  ApiError,
  DEFAULT_PAGE_WIDTH,
  MIN_QUESTION_BOX,
  applyTestKey,
  detectOnPage,
  duplicateQuestionKeys,
  findSubject,
  pageDetectionNotice,
  pageHasText,
  questionForBox,
  questionsForSave,
  readLastPageKeys,
  scanDocument,
  scanNotice,
  sortQuestions,
  splitTestFrom,
  suggestTestName,
  testNameTaken,
  testSections,
  type AnswerKeyGroups,
  type AnswerKeyMethod,
  type BookQuestion,
  type BookSummary,
  type DetectMethod,
  type EditorNotice,
  type EditorQuestion,
  type PageText,
  type QuestionRect,
} from "@unicoach/shared";
import { type PageFrameHandle } from "@/components/page-frame";
import { bookPdfSource, pdfErrorText, PdfPageFrame } from "@/components/pdf-page-frame";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { useDialog } from "@/components/ui/use-dialog";
import { API_BASE_URL, api } from "@/lib/api";
import { pdfjsAssets } from "@/lib/offline-files";
import { questionEditorHtml, type EditorBox, type EditorMode, type EditorPageEvent } from "@/lib/question-editor-page";
import { useTheme } from "@/lib/theme";
import { AnswerChoices, MethodsSheet, QuestionSheet, TestsSheet } from "./question-sheets";

type Q = EditorQuestion;
type Panel = "question" | "tests" | "methods" | null;

/**
 * Soruları çıkar (web'deki QuestionEditor'ın mobil karşılığı). Kurallar packages/shared/src/question-editing.ts'te;
 * sayfa, kutular, metin katmanı ve OCR WebView'deki sayfada (lib/question-editor-page.ts). Sorular burada tutulur,
 * "Kaydet" ile hepsi birden gönderilir (kayıtlı soruların kimliği korunur).
 */
export function QuestionEditor({
  book,
  initial,
  focusId,
}: {
  book: BookSummary;
  initial: BookQuestion[];
  /** Sınavdan "Kaynağında düzenle" ile gelindiyse açılıp seçilecek soru */
  focusId?: string;
}) {
  const focus = initial.find((q) => q.id === focusId);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { confirm, prompt, alert, dialog } = useDialog();
  const defaultChoiceCount = findSubject(book.subject)?.track === "LGS" ? 4 : 5;

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(book.pageCount ?? 0);
  const [page, setPage] = useState(focus?.page ?? 1);
  const [questions, setQuestions] = useState<Q[]>(() => initial.map(({ id, ...q }) => ({ ...q, key: id })));
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string | null>(focus?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<EditorNotice | null>(null);
  const [mode, setMode] = useState<EditorMode>("pan");
  const [panel, setPanel] = useState<Panel>(null);
  const [detectMethod, setDetectMethod] = useState<DetectMethod>(book.detectMethod);
  const [keyMethod, setKeyMethod] = useState<AnswerKeyMethod>(book.keyMethod);
  const cancelRef = useRef(false);
  const pageWidths = useRef(new Map<number, number>());
  const frameRef = useRef<PageFrameHandle>(null);

  const edit = useCallback((fn: (qs: Q[]) => Q[]) => {
    setQuestions(fn);
    setDirty(true);
  }, []);
  const patch = (key: string, value: Partial<Q>) => edit((qs) => qs.map((q) => (q.key === key ? { ...q, ...value } : q)));

  const widthOf = (p: number) => pageWidths.current.get(p) ?? DEFAULT_PAGE_WIDTH;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sorted = useMemo(() => sortQuestions(questions, widthOf), [questions]);
  const onPage = sorted.filter((q) => q.page === page);
  const current = questions.find((q) => q.key === selected) ?? null;
  const sections = testSections(sorted);
  const duplicates = useMemo(() => duplicateQuestionKeys(questions), [questions]);
  const answered = questions.filter((q) => q.answer).length;

  // --- Sayfa (WebView) ---
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pdf = useMemo(() => bookPdfSource(book.id), []);
  const html = useMemo(
    () =>
      questionEditorHtml(
        {
          source: pdf.source,
          page: focus?.page ?? 1,
          background: colors.surfaceMuted,
          colors: { primary: colors.primary, info: colors.info, danger: colors.danger, onPrimary: colors.onPrimary },
        },
        pdfjsAssets(),
      ),
    // Sayfa yalnızca ilk açılışta kurulur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (ready) frameRef.current?.call("show", page);
  }, [ready, page]);
  useEffect(() => {
    if (!ready) return;
    const boxes: EditorBox[] = onPage.map((q) => ({
      key: q.key,
      x: q.x,
      y: q.y,
      w: q.w,
      h: q.h,
      number: q.number,
      answer: q.answer,
      tone: duplicates.has(q.key) ? "duplicate" : q.key === selected ? "selected" : "normal",
    }));
    frameRef.current?.call("setBoxes", boxes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sorted, selected, page, duplicates]);
  useEffect(() => {
    if (ready) frameRef.current?.call("setMode", mode);
  }, [ready, mode]);

  /** Metin okuma istekleri: sayfa yanıtı `text` olayıyla, istek numarasıyla gönderir. */
  const requests = useRef(new Map<number, { resolve: (t: PageText) => void; reject: (e: Error) => void }>());
  const requestSeq = useRef(0);
  const readFromPage = (n: number, ocr: boolean) =>
    new Promise<PageText>((resolve, reject) => {
      const id = ++requestSeq.current;
      requests.current.set(id, { resolve, reject });
      frameRef.current?.call("read", id, n, ocr);
    });

  async function onDrawn(rect: QuestionRect) {
    if (rect.w < MIN_QUESTION_BOX || rect.h < MIN_QUESTION_BOX) return;
    const q = questionForBox({ rect, page, sorted, widthOf, defaultChoiceCount });
    edit((qs) => [...qs, q]);
    setSelected(q.key);
    // Yeni kutunun numarası hemen sorulur; önerilen numara seçili gelir.
    const value = await prompt({
      title: `${q.section} · yeni soru`,
      message: "Sorunun numarası",
      defaultValue: String(q.number),
      keyboardType: "number-pad",
      maxLength: 3,
      confirmLabel: "Tamam",
    });
    const n = Number(value);
    if (Number.isInteger(n) && n >= 1 && n !== q.number) patch(q.key, { number: n });
  }

  function onMessage(message: unknown) {
    const e = message as EditorPageEvent;
    if (e.type === "loaded") {
      setPageCount(e.pageCount);
      setReady(true);
    } else if (e.type === "page") {
      pageWidths.current.set(e.page, e.width);
    } else if (e.type === "select") {
      setSelected(e.key);
    } else if (e.type === "change") {
      patch(e.key, e.rect);
    } else if (e.type === "draw") {
      void onDrawn(e.rect);
    } else if (e.type === "error") {
      setLoadError(pdfErrorText(pdf.file, e.message));
    } else if (e.type === "text") {
      const request = requests.current.get(e.id);
      requests.current.delete(e.id);
      if (e.data) request?.resolve(e.data);
      else request?.reject(new Error(e.message ?? "Sayfa okunamadı."));
    }
  }

  // --- Soru bulma ---
  /** Sayfanın metni; `allowOcr` kapalıysa metinsiz sayfa OCR'a gönderilmez (boş döner). */
  async function readPage(n: number, allowOcr = true): Promise<PageText> {
    const text = await readFromPage(n, false);
    pageWidths.current.set(n, text.width);
    if (detectMethod === "text" || (detectMethod === "auto" && (pageHasText(text) || !allowOcr))) return text;
    return readFromPage(n, true);
  }

  const lastPageKeysRef = useRef<Promise<AnswerKeyGroups | null> | null>(null);
  function lastPageKeys() {
    lastPageKeysRef.current ??= readLastPageKeys(pageCount, (n) => readFromPage(n, false));
    return lastPageKeysRef.current;
  }

  async function detectThisPage() {
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
    } catch (err) {
      setNotice({ tone: "danger", text: err instanceof Error && err.message ? err.message : "Sayfa okunamadı." });
    } finally {
      setBusy(null);
    }
  }

  async function detectAll() {
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
      const result = await scanDocument({
        pageCount,
        detectMethod,
        keyMethod,
        defaultChoiceCount,
        readText: readPage,
        readTextLayer: (n) => readFromPage(n, false),
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

  function saveMethods(value: { detectMethod?: DetectMethod; keyMethod?: AnswerKeyMethod }) {
    if (value.detectMethod) setDetectMethod(value.detectMethod);
    if (value.keyMethod) setKeyMethod(value.keyMethod);
    api.books.update(book.id, value).catch(() => setNotice({ tone: "danger", text: "Seçim kaydedilemedi; bu oturumda yine de kullanılır." }));
  }

  async function save(): Promise<boolean> {
    if (duplicates.size) return false;
    setSaving(true);
    setNotice(null);
    try {
      const saved = await api.books.saveQuestions(book.id, { questions: questionsForSave(sorted) });
      setQuestions(saved.map(({ id, ...q }) => ({ ...q, key: id })));
      setSelected((s) => {
        const index = sorted.findIndex((q) => q.key === s);
        return index >= 0 ? (saved[index]?.id ?? null) : null;
      });
      setDirty(false);
      setNotice({ tone: "success", text: `${saved.length} soru kaydedildi.` });
      return true;
    } catch (err) {
      setNotice({ tone: "danger", text: err instanceof ApiError ? (err.errors?.questions ?? err.message) : "Kaydedilemedi." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Kaydedilmemiş değişiklik varken çıkılırsa sor. Onaylanınca önce koruma kalkar, geri hareketi bir sonraki
  // çizimde yinelenir (koruma açıkken yinelenirse yeniden yakalanır).
  const [leaveAction, setLeaveAction] = useState<Parameters<typeof navigation.dispatch>[0] | null>(null);
  usePreventRemove(dirty, ({ data }) => {
    void confirm({
      title: "Kaydedilmemiş değişiklikler",
      message: "Soruları kaydetmeden çıkarsan değişiklikler kaybolur.",
      confirmLabel: "Kaydetmeden çık",
      danger: true,
    }).then((leave) => {
      if (!leave) return;
      setDirty(false);
      setLeaveAction(data.action);
    });
  });
  useEffect(() => {
    if (leaveAction && !dirty) navigation.dispatch(leaveAction);
  }, [leaveAction, dirty, navigation]);

  async function splitFrom(key: string) {
    const from = sorted.find((q) => q.key === key);
    if (!from) return;
    setPanel(null);
    const name = await prompt({
      title: "Buradan yeni test başlat",
      message: "Bu soru ve testteki sonrakiler yeni teste taşınır, 1'den numaralanır.",
      defaultValue: suggestTestName(sections),
      placeholder: "Yeni testin adı",
      maxLength: 60,
      confirmLabel: "Başlat",
    });
    if (!name) return;
    if (testNameTaken(sections, name, from.section)) {
      await alert({ title: "Bu ad kullanılıyor", message: `"${name}" adında bir test zaten var; başka bir ad seç.` });
      return;
    }
    edit((qs) => splitTestFrom(qs, sorted, key, name));
  }

  function removeSelected() {
    if (!selected) return;
    edit((qs) => qs.filter((q) => q.key !== selected));
    setSelected(null);
    setPanel(null);
  }

  const goTo = (n: number) => {
    setSelected(null);
    setPage(Math.min(Math.max(1, n), pageCount || 1));
  };

  const canSave = dirty && !busy && !saving && duplicates.size === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {dialog}
      <Stack.Screen
        options={{
          title: "Soruları çıkar",
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
              disabled={!canSave}
              onPress={() => void save()}
              hitSlop={10}
              style={{ opacity: canSave ? 1 : 0.4 }}
            >
              {saving ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text weight="semibold" tone="primary">
                  Kaydet
                </Text>
              )}
            </Pressable>
          ),
        }}
      />

      {/* Araç şeridi */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}
        contentContainerStyle={{ gap: spacing[2], paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}
      >
        <ToolButton label="Bu sayfada bul" disabled={!ready || !!busy} onPress={() => void detectThisPage()} icon={ScanSearch} />
        <ToolButton label="Tüm PDF'te bul" disabled={!ready || !!busy} onPress={() => void detectAll()} icon={ScanSearch} />
        <ToolButton
          label={mode === "draw" ? "Çiziliyor" : "Kutu çiz"}
          active={mode === "draw"}
          disabled={!ready}
          onPress={() => setMode((m) => (m === "draw" ? "pan" : "draw"))}
          icon={SquareDashedMousePointer}
        />
        <ToolButton label={`Testler · ${sections.length}`} onPress={() => setPanel("tests")} icon={ListChecks} />
        <ToolButton label="Yöntem" disabled={!!busy} onPress={() => setPanel("methods")} icon={Settings2} />
      </ScrollView>

      {busy ? (
        <Banner tone="info" icon={<ActivityIndicator size="small" color={colors.info} />}>
          <Text size="sm" tone="info" style={{ flex: 1 }}>
            {busy}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => (cancelRef.current = true)} hitSlop={8}>
            <Text size="sm" weight="medium" tone="info" style={{ textDecorationLine: "underline" }}>
              Durdur
            </Text>
          </Pressable>
        </Banner>
      ) : duplicates.size > 0 ? (
        <Banner tone="danger" icon={<CircleAlert size={16} color={colors.danger} />}>
          <Text size="sm" tone="danger" style={{ flex: 1 }}>
            Aynı testte aynı numara birden fazla kez var (kırmızı kutular). Numaraları düzeltmeden kaydedemezsin.
          </Text>
        </Banner>
      ) : notice ? (
        <Banner
          tone={notice.tone}
          icon={
            notice.tone === "success" ? (
              <CircleCheck size={16} color={colors.success} />
            ) : notice.tone === "danger" ? (
              <CircleAlert size={16} color={colors.danger} />
            ) : (
              <Info size={16} color={colors.info} />
            )
          }
        >
          <Text size="sm" tone={notice.tone} style={{ flex: 1 }}>
            {notice.text}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={() => setNotice(null)} hitSlop={8}>
            <X size={16} color={colors[notice.tone]} />
          </Pressable>
        </Banner>
      ) : mode === "draw" ? (
        <Banner tone="info" icon={<SquareDashedMousePointer size={16} color={colors.info} />}>
          <Text size="sm" tone="info" style={{ flex: 1 }}>
            Sorunun çevresine parmağınla kutu çiz. Kaydırmak için "Çiziliyor"a dokunup çizimi kapat.
          </Text>
        </Banner>
      ) : null}

      <View style={{ flex: 1 }}>
        <PdfPageFrame
          ref={frameRef}
          file={pdf.file}
          html={html}
          baseUrl={`${API_BASE_URL}/`}
          background={colors.surfaceMuted}
          onMessage={onMessage}
          style={{ flex: 1 }}
        />
        {!ready && (
          <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: spacing[3], padding: spacing[6], backgroundColor: colors.surfaceMuted }}>
            {loadError ? (
              <Text tone="textMuted" style={{ textAlign: "center" }}>
                {loadError}
              </Text>
            ) : (
              <>
                <ActivityIndicator color={colors.primary} />
                <Text size="sm" tone="textMuted">
                  PDF açılıyor…
                </Text>
              </>
            )}
          </View>
        )}
      </View>

      <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: insets.bottom }}>
        {current ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], paddingHorizontal: spacing[4], paddingTop: spacing[3] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sorunun ayrıntıları"
              onPress={() => setPanel("question")}
              style={{ flex: 1, minWidth: 0 }}
            >
              <Text size="xs" tone="textMuted" numberOfLines={1}>
                {current.section}
              </Text>
              <Text weight="semibold" tone={duplicates.has(current.key) ? "danger" : "text"}>
                {current.number}. soru
              </Text>
            </Pressable>
            <AnswerChoices q={current} onChange={(answer) => patch(current.key, { answer })} size={36} />
            <Pressable accessibilityRole="button" accessibilityLabel="Sorunun ayrıntıları" onPress={() => setPanel("question")} hitSlop={8}>
              <SlidersHorizontal size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
          <IconButton label="Önceki sayfa" disabled={!ready || page <= 1} onPress={() => goTo(page - 1)}>
            <ChevronLeft size={22} color={colors.text} />
          </IconButton>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sayfa ${page} / ${pageCount}. Başka sayfaya gitmek için dokun.`}
            disabled={!ready}
            onPress={async () => {
              const value = await prompt({ title: "Sayfaya git", placeholder: `1–${pageCount}`, keyboardType: "number-pad", confirmLabel: "Git" });
              const n = Number(value);
              if (Number.isInteger(n) && n >= 1) goTo(n);
            }}
            style={{ alignItems: "center", paddingHorizontal: spacing[3] }}
          >
            <Text weight="medium" style={{ fontVariant: ["tabular-nums"] }}>
              Sayfa {page} / {pageCount || "–"}
            </Text>
            <Text size="xs" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
              Bu sayfada {onPage.length} soru · toplam {questions.length}, {answered} cevaplı
            </Text>
          </Pressable>
          <IconButton label="Sonraki sayfa" disabled={!ready || page >= pageCount} onPress={() => goTo(page + 1)}>
            <ChevronRight size={22} color={colors.text} />
          </IconButton>
        </View>
      </View>

      <QuestionSheet
        key={current?.key ?? "yok"}
        visible={panel === "question" && !!current}
        onClose={() => setPanel(null)}
        q={current}
        sections={sections}
        duplicate={!!current && duplicates.has(current.key)}
        onChange={(value) => current && patch(current.key, value)}
        onSplit={() => current && void splitFrom(current.key)}
        onDelete={removeSelected}
      />
      <TestsSheet
        visible={panel === "tests"}
        onClose={() => setPanel(null)}
        sorted={sorted}
        sections={sections}
        onOpenTest={(section) => {
          const first = sorted.find((q) => q.section === section);
          setPanel(null);
          if (first) goTo(first.page);
        }}
        onApplyKey={(section, map) => {
          const result = applyTestKey(questions, section, map);
          edit(() => result.questions);
          setNotice({ tone: "success", text: `"${section}" testine ${result.count} cevap işlendi.` });
          setPanel(null);
          return result.count;
        }}
      />
      <MethodsSheet visible={panel === "methods"} onClose={() => setPanel(null)} detectMethod={detectMethod} keyMethod={keyMethod} onChange={saveMethods} />
    </View>
  );
}

function ToolButton({
  label,
  icon: Icon,
  onPress,
  disabled,
  active,
}: {
  label: string;
  icon: typeof ScanSearch;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Button
      size="sm"
      variant={active ? "primary" : "secondary"}
      disabled={disabled}
      onPress={onPress}
      icon={<Icon size={16} color={active ? colors.onPrimary : colors.primarySoftText} />}
    >
      {label}
    </Button>
  );
}

function Banner({ tone, icon, children }: { tone: EditorNotice["tone"]; icon: ReactNode; children: ReactNode }) {
  const { colors } = useTheme();
  const bg = { success: colors.successSoft, danger: colors.dangerSoft, info: colors.infoSoft }[tone];
  return (
    <View
      accessibilityRole={tone === "danger" ? "alert" : undefined}
      style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[2], backgroundColor: bg }}
    >
      {icon}
      {children}
    </View>
  );
}

