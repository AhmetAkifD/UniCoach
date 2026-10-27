import { useRef, useState } from "react";
import { Linking, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { QrCode } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import { ApiError, parsePairCode, type AuthUser } from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useDialog } from "@/components/ui/use-dialog";
import { syncEngine } from "@/lib/api";
import { useSession } from "@/lib/session";
import { deviceStore } from "@/lib/storage";
import { useTheme } from "@/lib/theme";

/** Belirteçteki kullanıcı kimliği (doğrulama sunucuda; burada yalnızca "başka hesap mı" uyarısı için). */
function tokenUser(token: string): string | null {
  try {
    const part = token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    return (JSON.parse(atob(part)) as { sub?: string }).sub ?? null;
  } catch {
    return null;
  }
}

/**
 * Web'deki Profil → "Telefonu eşle" QR kodunu okutur: sunucu adresi saklanır ve koddaki oturumla giriş yapılır
 * (lib/session.tsx `pair`). Başka bir hesaba geçiliyorsa ve gönderilmemiş değişiklik varsa önce sorulur.
 */
export function PairScanner({ onDone }: { onDone: (user: AuthUser) => void }) {
  const { colors } = useTheme();
  const { pair } = useSession();
  const { confirm, dialog } = useDialog();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<{ tone: "textMuted" | "danger" | "primary"; text: string } | null>(null);
  const busy = useRef(false);

  async function scanned(data: string) {
    if (busy.current) return;
    busy.current = true;
    try {
      const code = parsePairCode(data);
      if (!code) {
        setStatus({ tone: "danger", text: "Bu bir UniCoach eşleme kodu değil. Bilgisayarında Profil → Telefonu eşle'deki kodu okut." });
        return;
      }
      const current = await deviceStore.get<AuthUser>("uc_user");
      const pending = syncEngine.getState().pending;
      if (current && pending && tokenUser(code.token) !== current.id) {
        const ok = await confirm({
          title: "Başka bir hesap",
          message: `Bu kod başka bir hesabın. Bu cihazda gönderilmemiş ${pending} değişiklik var; devam edersen kaybolur.`,
          confirmLabel: "Yine de bağlan",
          danger: true,
        });
        if (!ok) return;
      }
      setStatus({ tone: "primary", text: `${code.url} adresine bağlanılıyor…` });
      try {
        onDone(await pair(code));
      } catch (err) {
        setStatus({
          tone: "danger",
          text:
            err instanceof ApiError
              ? err.status === 401
                ? "Bu kodun süresi dolmuş. Bilgisayarında yeni bir kod oluştur."
                : err.message
              : `Kod okundu ama ${code.url} adresine ulaşılamadı. Telefonun bilgisayarla aynı Wi‑Fi ağında mı? Bilgisayarda başka bir adres seçip yeniden dene.`,
        });
      }
    } finally {
      // Aynı kod art arda okunmasın diye kısa bir ara
      setTimeout(() => {
        busy.current = false;
      }, 1500);
    }
  }

  const steps = "Bilgisayarında UniCoach'u aç: Profil → Telefonu eşle → QR kodu göster. Sonra kodu buraya okut.";

  return (
    <View style={{ gap: spacing[4] }}>
      {dialog}
      <Text size="sm" tone="textMuted">
        {steps}
      </Text>
      {!permission ? null : permission.granted ? (
        <View style={{ aspectRatio: 1, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#000" }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => void scanned(data)}
          />
        </View>
      ) : (
        <View
          style={{
            aspectRatio: 1,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            gap: spacing[3],
            padding: spacing[5],
          }}
        >
          <QrCode size={40} color={colors.textSubtle} strokeWidth={1.75} />
          <Text size="sm" tone="textMuted" style={{ textAlign: "center" }}>
            Kodu okutmak için kameraya izin vermelisin.
          </Text>
          {permission.canAskAgain ? (
            <Button onPress={() => void requestPermission()}>Kameraya izin ver</Button>
          ) : (
            <Button variant="secondary" onPress={() => void Linking.openSettings()}>
              Ayarları aç
            </Button>
          )}
        </View>
      )}
      {status && (
        <Text size="sm" tone={status.tone} accessibilityLiveRegion="polite">
          {status.text}
        </Text>
      )}
    </View>
  );
}
