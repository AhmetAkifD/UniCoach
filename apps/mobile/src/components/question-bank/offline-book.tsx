import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { CloudDownload, HardDrive, Trash2 } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import { formatBytes, type BookSummary } from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Text } from "@/components/ui/text";
import { api, getApiToken, syncEngine } from "@/lib/api";
import { downloadBook, offlineBook, removeOfflineBook, type DownloadHandle } from "@/lib/offline-files";
import { useSyncState } from "@/lib/sync";
import { useTheme } from "@/lib/theme";

/**
 * "Çevrimdışı kullan" (kullanıcı kararı: PDF başına seçilir): PDF cihaza indirilince görüntüleyici, soru düzenleyici ve
 * sınav ekranı onu cihazdan okur; internet ve evdeki sunucu gerekmez. Cihazdan kaldırılabilir.
 */
export function OfflineBook({ book }: { book: BookSummary }) {
  const { colors } = useTheme();
  const { connection } = useSyncState();
  const [stored, setStored] = useState(() => offlineBook(book.id) !== null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const taskRef = useRef<DownloadHandle | null>(null);

  useEffect(() => () => taskRef.current?.cancel(), []);
  if (!syncEngine.enabled) return null;

  async function download() {
    setError(null);
    setProgress(0);
    const task = downloadBook(book.id, api.books.filePath(book.id), getApiToken(), (sent, total) =>
      setProgress(total > 0 ? (sent / total) * 100 : 0),
    );
    taskRef.current = task;
    try {
      await task.promise;
      setStored(true);
    } catch {
      setError(connection === "offline" ? "Sunucuya ulaşılamıyor; indirmek için evdeki sunucuyla aynı ağda olmalısın." : "PDF indirilemedi.");
    } finally {
      taskRef.current = null;
      setProgress(null);
    }
  }

  return (
    <View style={{ gap: spacing[3], padding: spacing[4], borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        {stored ? <HardDrive size={18} color={colors.success} /> : <CloudDownload size={18} color={colors.textMuted} />}
        <Text weight="semibold">{stored ? "Bu cihazda" : "Çevrimdışı kullan"}</Text>
      </View>
      <Text size="sm" tone="textMuted">
        {stored
          ? "PDF bu cihaza indirildi: internet ve evdeki sunucu olmadan da okuyabilir, soru çıkarabilir, sınav çözebilirsin."
          : `PDF'i (${formatBytes(book.sizeBytes)}) bu cihaza indir; sunucuya ulaşamadığında da açılsın.`}
      </Text>
      {progress !== null && <ProgressBar value={progress} label="İndirme" />}
      {error && (
        <Text size="sm" tone="danger">
          {error}
        </Text>
      )}
      {progress !== null ? (
        <Button variant="ghost" size="sm" onPress={() => taskRef.current?.cancel()} style={{ alignSelf: "flex-start" }}>
          Vazgeç
        </Button>
      ) : stored ? (
        <Button
          variant="ghost"
          size="sm"
          icon={<Trash2 size={16} color={colors.text} />}
          onPress={() => {
            removeOfflineBook(book.id);
            setStored(false);
          }}
          style={{ alignSelf: "flex-start" }}
        >
          Cihazdan kaldır
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          icon={<CloudDownload size={16} color={colors.primarySoftText} />}
          onPress={() => void download()}
          style={{ alignSelf: "flex-start" }}
        >
          İndir
        </Button>
      )}
    </View>
  );
}
