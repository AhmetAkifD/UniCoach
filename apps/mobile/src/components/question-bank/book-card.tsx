import { View } from "react-native";
import { router } from "expo-router";
import { FileText } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import { formatBytes, type BookSummary } from "@unicoach/shared";
import { Badge } from "@/components/ui/badge";
import { PressableCard } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Text } from "@/components/ui/text";

/** Soru Bankası'ndaki bir PDF: ad, konu, kalınan sayfa, soru sayısı (web'deki BookCard). */
export function BookCard({ book, color, showTopic = true }: { book: BookSummary; color: string; showTopic?: boolean }) {
  const percent = book.pageCount ? (book.lastPage / book.pageCount) * 100 : 0;
  return (
    <PressableCard
      accessibilityLabel={`${book.title}, ${book.pageCount ? `sayfa ${book.lastPage}/${book.pageCount}` : "henüz açılmadı"}`}
      onPress={() => router.push({ pathname: "/pdf/[id]", params: { id: book.id } })}
      style={{ padding: spacing[4], gap: spacing[3] }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[3] }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            alignItems: "center",
            justifyContent: "center",
            // Ders rengi %16 saydamlıkla (web'deki color-mix karşılığı).
            backgroundColor: `${color}29`,
          }}
        >
          <FileText size={22} color={color} strokeWidth={1.75} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text weight="semibold" numberOfLines={2}>
            {book.title}
          </Text>
          {showTopic && book.topic && <Badge>{book.topic}</Badge>}
        </View>
      </View>
      <View style={{ gap: 4 }}>
        <ProgressBar value={percent} color={color} label={`${book.title} ilerlemesi`} showValue={false} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text size="xs" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
            {book.pageCount ? `Sayfa ${book.lastPage}/${book.pageCount}` : "Henüz açılmadı"}
          </Text>
          <Text size="xs" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
            {book.questionCount > 0 && `${book.questionCount} soru · `}
            {formatBytes(book.sizeBytes)}
          </Text>
        </View>
      </View>
    </PressableCard>
  );
}
