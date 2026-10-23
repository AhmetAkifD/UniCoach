import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { ClipboardList, ListChecks, Pencil, Trash2 } from "lucide-react-native";
import { spacing } from "@unicoach/design";
import { ApiError, findSubject, formatBytes, type BookSummary, type ExamTrack } from "@unicoach/shared";
import { SubjectSelect } from "@/components/library/subject-select";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useDialog } from "@/components/ui/use-dialog";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { TopicInput } from "./topic-input";

/** PDF'in bilgileri ve ayarları (web'deki BookHeader): ad, ders, konu, silme. */
export function BookSettings({
  visible,
  onClose,
  book,
  color,
  examTrack,
  topics,
  onChanged,
  onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  book: BookSummary;
  color: string;
  examTrack: ExamTrack | null;
  topics: string[];
  onChanged: (book: BookSummary) => void;
  onDeleted: () => void;
}) {
  const { colors } = useTheme();
  const { confirm, alert, prompt, dialog } = useDialog();
  const [topic, setTopic] = useState(book.topic ?? "");
  const [pending, setPending] = useState(false);
  const topicChanged = topic.trim() !== (book.topic ?? "");

  async function run(action: () => Promise<BookSummary | void>, after: (book: BookSummary | void) => void) {
    setPending(true);
    try {
      after(await action());
    } catch (err) {
      await alert({
        title: "Kaydedilemedi",
        message: err instanceof ApiError ? (err.errors?.title ?? err.errors?.topic ?? err.message) : "Bir sorun oluştu, tekrar dene.",
      });
    } finally {
      setPending(false);
    }
  }

  const changed = (next: BookSummary | void) => next && onChanged(next);

  async function rename() {
    const title = await prompt({ title: "Adını değiştir", placeholder: "Ad", defaultValue: book.title, maxLength: 120, confirmLabel: "Kaydet" });
    if (title && title !== book.title) await run(() => api.books.update(book.id, { title }), changed);
  }

  async function remove() {
    const ok = await confirm({
      title: "PDF'i sil",
      message:
        book.questionCount > 0
          ? `Bu PDF ve ondan çıkarılan ${book.questionCount} soru silinsin mi? Bu sorularla kurduğun sınavlar da etkilenir.`
          : "Bu PDF soru bankandan silinsin mi?",
      confirmLabel: "Sil",
      danger: true,
    });
    if (ok) await run(() => api.books.remove(book.id), onDeleted);
  }

  const rows: [string, string][] = [
    ["Konu", book.topic ?? "Belirtilmemiş"],
    ["Sayfa", book.pageCount ? String(book.pageCount) : "—"],
    ["Boyut", formatBytes(book.sizeBytes)],
    ["Çıkarılan soru", String(book.questionCount)],
  ];

  return (
    <Sheet visible={visible} title="PDF bilgileri" onClose={onClose}>
      {dialog}
      <View style={{ paddingHorizontal: spacing[5], gap: spacing[5] }}>
        <View style={{ gap: spacing[2] }}>
          <Text size="lg" weight="semibold">
            {book.title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
            <Text size="sm" tone="textMuted">
              {findSubject(book.subject)?.label ?? book.subject}
            </Text>
          </View>
          {rows.map(([label, value]) => (
            <View key={label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text size="sm" tone="textMuted">
                {label}
              </Text>
              <Text size="sm" style={{ fontVariant: ["tabular-nums"] }}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        <Button
          icon={<ListChecks size={18} color={colors.onPrimary} />}
          onPress={() => {
            onClose();
            router.push({ pathname: "/sorular/[id]", params: { id: book.id } });
          }}
        >
          {book.questionCount ? `Soruları düzenle (${book.questionCount})` : "Soruları çıkar"}
        </Button>
        {book.questionCount > 0 && (
          <Button
            variant="secondary"
            icon={<ClipboardList size={18} color={colors.primarySoftText} />}
            onPress={() => {
              onClose();
              router.push({ pathname: "/sinav-yeni", params: { pdf: book.id } });
            }}
          >
            Sınav oluştur
          </Button>
        )}

        <View style={{ gap: spacing[4] }}>
          <View style={{ gap: 6 }}>
            <Text size="sm" weight="medium">
              Ders
            </Text>
            <SubjectSelect
              value={book.subject}
              examTrack={examTrack}
              disabled={pending}
              onChange={(subject) => void run(() => api.books.update(book.id, { subject }), changed)}
            />
          </View>
          <TopicInput value={topic} onChange={setTopic} topics={topics} editable={!pending} />
          {topicChanged && (
            <Button variant="secondary" loading={pending} onPress={() => void run(() => api.books.update(book.id, { topic }), changed)}>
              Konuyu kaydet
            </Button>
          )}
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={pending}
              icon={<Pencil size={16} color={colors.primarySoftText} />}
              onPress={() => void rename()}
              style={{ flex: 1 }}
            >
              Adını değiştir
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              icon={<Trash2 size={16} color={colors.onPrimary} />}
              onPress={() => void remove()}
              style={{ flex: 1 }}
            >
              PDF'i sil
            </Button>
          </View>
        </View>
      </View>
    </Sheet>
  );
}
