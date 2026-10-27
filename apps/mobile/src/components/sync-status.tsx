import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { CloudOff, RefreshCw } from "lucide-react-native";
import { spacing } from "@unicoach/design";
import { formatDate } from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { syncEngine } from "@/lib/api";
import { useSyncState } from "@/lib/sync";
import { useTheme } from "@/lib/theme";

/**
 * Profildeki "Bu cihazdaki veriler" kartı: verinin bir kopyası telefonda durur ve evdeki sunucuya ulaşınca
 * eşitlenir. Bağlantı durumu, son eşitleme ve elle eşitleme.
 */
export function SyncStatusCard() {
  const { colors } = useTheme();
  const state = useSyncState();
  if (!syncEngine.enabled) return null;
  const offline = state.connection === "offline";
  return (
    <Card style={{ gap: spacing[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: offline ? colors.warning : colors.success }} />
        <Text weight="semibold">{offline ? "Çevrimdışı" : "Sunucuya bağlı"}</Text>
      </View>
      <Text size="sm" tone="textMuted">
        {offline
          ? "Evdeki sunucuya ulaşılamıyor. Verilerini bu cihazdaki kopyadan görüyorsun. Notların, izleme ilerlemen ve kaldığın sayfa bu cihaza kaydedilir, sunucuya ulaşınca gönderilir. Diğer değişiklikler için sunucuyla aynı ağda olmalısın."
          : "Verilerinin bir kopyası bu cihazda da duruyor; sunucuya ulaşılamadığında da görebilir, not alabilirsin."}
      </Text>
      <Text size="sm" tone="textMuted">
        Son eşitleme: {state.syncedAt ? formatDate(state.syncedAt) : "henüz yok"}
      </Text>
      {state.pending > 0 && (
        <Text size="sm" weight="medium" tone="warning">
          Gönderilmeyi bekleyen {state.pending} değişiklik var.
        </Text>
      )}
      <Button
        variant="secondary"
        size="sm"
        loading={state.syncing}
        icon={<RefreshCw size={16} color={colors.primarySoftText} />}
        onPress={() => void syncEngine.sync()}
        style={{ alignSelf: "flex-start" }}
      >
        Şimdi eşitle
      </Button>
    </Card>
  );
}

/** Sekmelerin başlığında, çevrimdışıyken görünen simge; dokununca profildeki eşitleme kartı açılır. */
export function OfflineIndicator() {
  const { colors } = useTheme();
  const state = useSyncState();
  if (state.connection !== "offline") return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Çevrimdışısın. Ayrıntılar için dokun."
      onPress={() => router.push("/profil")}
      hitSlop={8}
      style={{ marginRight: spacing[3] }}
    >
      <CloudOff size={22} color={colors.warning} />
    </Pressable>
  );
}
