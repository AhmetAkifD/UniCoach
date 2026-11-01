import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { CircleAlert, FileText, Upload } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import { ApiError, BOOK_MAX_BYTES, bookTopics, formatBytes } from "@unicoach/shared";
import { SubjectSelect } from "@/components/library/subject-select";
import { TopicInput } from "@/components/question-bank/topic-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { api, syncEngine } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { UploadCancelled, uploadBookFile, type PickedPdf, type UploadHandle } from "@/lib/upload";

type Errors = { file?: string; subject?: string; title?: string; topic?: string; form?: string };

function titleFromFileName(name: string) {
  return name.replace(/\.pdf$/i, "").replace(/[_]+/g, " ").trim().slice(0, 120);
}

/** "PDF yükle": soru kitabı PDF'i + ders + isteğe bağlı konu (web'deki UploadBookDialog). */
export default function UploadBookScreen() {
  const { user } = useSession();
  const { colors } = useTheme();
  const [pdf, setPdf] = useState<PickedPdf | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [sent, setSent] = useState<number | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const uploadRef = useRef<UploadHandle | null>(null);
  const busy = sent !== null;

  // Önceden kullanılan konular öneri olarak gösterilir.
  useEffect(() => {
    api.books.list().then((books) => setTopics(bookTopics(books)), () => undefined);
    // Ekrandan çıkılırsa yükleme durur.
    return () => uploadRef.current?.cancel();
  }, []);

  async function pick() {
    // Kopyalanmaz: Expo Go seçicinin önbellek klasörünü okutmuyor; dosya content:// adresinden akar (lib/upload.ts).
    const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: false, base64: false });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    const isPdf = asset.mimeType === "application/pdf" || /\.pdf$/i.test(asset.name);
    if (!isPdf) return setErrors({ file: "Yalnızca PDF dosyası yükleyebilirsin." });
    const size = asset.size ?? asset.file?.size ?? 0;
    setErrors({ file: size > BOOK_MAX_BYTES ? `PDF en fazla ${formatBytes(BOOK_MAX_BYTES)} olabilir.` : undefined });
    setPdf({ uri: asset.uri, name: asset.name, size, file: asset.file });
    setTitle((current) => current || titleFromFileName(asset.name));
  }

  async function submit() {
    const next: Errors = {
      file: !pdf ? "Bir PDF seç." : pdf.size > BOOK_MAX_BYTES ? `PDF en fazla ${formatBytes(BOOK_MAX_BYTES)} olabilir.` : undefined,
      subject: subject ? undefined : "Bir ders seç.",
      title: title.trim() ? undefined : "Bir ad yaz.",
    };
    setErrors(next);
    if (next.file || next.subject || next.title || !pdf) return;

    let bookId: string | null = null;
    try {
      setSent(0);
      const book = await api.books.create({ subject, title, topic, sizeBytes: pdf.size });
      bookId = book.id;
      uploadRef.current = uploadBookFile(book.id, pdf, setSent);
      await uploadRef.current.promise;
      uploadRef.current = null;
      // Dosya API dışından gönderildiği için yeni PDF'i telefondaki kopyaya almak üzere eşitlenir.
      await syncEngine.sync();
      router.replace({ pathname: "/pdf/[id]", params: { id: book.id } });
    } catch (err) {
      uploadRef.current = null;
      // Dosyası gelmeyen kayıt kalmasın.
      if (bookId) void api.books.remove(bookId).catch(() => undefined);
      if (err instanceof UploadCancelled) return setSent(null);
      setErrors(
        err instanceof ApiError && err.errors
          ? { subject: err.errors.subject, title: err.errors.title, topic: err.errors.topic, form: err.errors.sizeBytes }
          : { form: err instanceof Error ? err.message : "PDF yüklenemedi." },
      );
      setSent(null);
    }
  }

  return (
    <Screen edges={["bottom"]}>
      <Text tone="textMuted">Soru kitabının PDF'ini seç, dersini ve istersen konusunu yaz. En fazla {formatBytes(BOOK_MAX_BYTES)}.</Text>

      {errors.form && (
        <View
          accessibilityRole="alert"
          style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start", borderRadius: radius.md, backgroundColor: colors.dangerSoft, padding: spacing[3] }}
        >
          <CircleAlert size={16} color={colors.danger} style={{ marginTop: 2 }} />
          <Text size="sm" tone="danger" style={{ flex: 1 }}>
            {errors.form}
          </Text>
        </View>
      )}

      <View style={{ gap: 6 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={pdf ? `Seçilen PDF: ${pdf.name}. Değiştirmek için dokun.` : "PDF seç"}
          disabled={busy}
          onPress={() => void pick()}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing[3],
            padding: spacing[4],
            borderRadius: radius.lg,
            borderWidth: 1,
            borderStyle: pdf ? "solid" : "dashed",
            borderColor: errors.file ? colors.danger : pdf ? colors.border : colors.borderStrong,
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            opacity: busy ? 0.6 : 1,
          })}
        >
          <View style={{ width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft }}>
            {pdf ? <FileText size={22} color={colors.primarySoftText} strokeWidth={1.75} /> : <Upload size={22} color={colors.primarySoftText} strokeWidth={1.75} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="medium" numberOfLines={2}>
              {pdf ? pdf.name : "PDF seç"}
            </Text>
            <Text size="sm" tone="textMuted">
              {pdf ? `${formatBytes(pdf.size)} · değiştirmek için dokun` : "Telefonundaki ya da Drive'daki dosyalardan"}
            </Text>
          </View>
        </Pressable>
        {errors.file && (
          <Text size="sm" tone="danger">
            {errors.file}
          </Text>
        )}
      </View>

      <View style={{ gap: spacing[4] }}>
        <Input label="Ad" placeholder="ör. 3D TYT Matematik Soru Bankası" value={title} onChangeText={setTitle} error={errors.title} editable={!busy} maxLength={120} />
        <View style={{ gap: 6 }}>
          <Text size="sm" weight="medium">
            Ders
          </Text>
          <SubjectSelect value={subject} onChange={setSubject} examTrack={user?.examTrack ?? null} error={errors.subject} disabled={busy} />
        </View>
        <TopicInput value={topic} onChange={setTopic} topics={topics} error={errors.topic} editable={!busy} />
      </View>

      {busy && pdf ? (
        <View style={{ gap: spacing[3] }}>
          <ProgressBar value={pdf.size ? (sent / pdf.size) * 100 : 0} label="Yükleme ilerlemesi" />
          <Text size="sm" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
            Yükleniyor… {formatBytes(sent)} / {formatBytes(pdf.size)}
          </Text>
          <Button variant="ghost" onPress={() => uploadRef.current?.cancel()}>
            İptal et
          </Button>
        </View>
      ) : (
        <Button onPress={() => void submit()}>Yükle</Button>
      )}
    </Screen>
  );
}
