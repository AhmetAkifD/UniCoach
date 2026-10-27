import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { WifiOff } from "lucide-react-native";
import { spacing } from "@unicoach/design";
import { PairScanner } from "@/components/pair-scanner";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { apiBaseUrl } from "@/lib/api";
import { SessionProvider, useSession } from "@/lib/session";
import { ThemeProvider, useTheme } from "@/lib/theme";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  return (
    <SessionProvider>
      <Themed fontsLoaded={fontsLoaded} />
    </SessionProvider>
  );
}

function Themed({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { user } = useSession();
  return (
    <ThemeProvider preference={user?.theme ?? "system"}>
      <Navigator fontsLoaded={fontsLoaded} />
    </ThemeProvider>
  );
}

/** Oturum durumuna göre ekranlar: giriş yapılmamışsa yalnızca giriş, yapılmışsa uygulama. */
function Navigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { status } = useSession();
  const { name, colors } = useTheme();
  const ready = fontsLoaded && status !== "loading";

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;
  if (status === "offline") return <Offline />;

  return (
    <>
      <StatusBar style={name === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={status === "signedIn"}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={status === "signedOut"}>
          <Stack.Screen name="giris" />
        </Stack.Protected>
        {/* QR ile bağlan: giriş ekranından da Profil'den de açılır. */}
        <Stack.Screen name="eslestir" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}

/** Kayıtlı oturum var ama API'ye ulaşılamadı (ve bu cihazda son bilinen kullanıcı yok). Adres yanlışsa QR ile eşlenir. */
function Offline() {
  const { retry, signOut } = useSession();
  const { colors } = useTheme();
  const [scanning, setScanning] = useState(false);
  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: spacing[6], gap: spacing[4] }}>
        <Text size="lg" weight="semibold">
          QR ile bağlan
        </Text>
        <PairScanner onDone={() => setScanning(false)} />
        <Button variant="ghost" onPress={() => setScanning(false)}>
          Vazgeç
        </Button>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing[6], gap: spacing[4] }}>
      <WifiOff size={40} color={colors.textSubtle} strokeWidth={1.75} />
      <Text size="lg" weight="semibold" style={{ textAlign: "center" }}>
        Sunucuya ulaşılamadı
      </Text>
      <Text size="sm" tone="textMuted" style={{ textAlign: "center" }}>
        Telefonun ve bilgisayarın aynı Wi‑Fi ağında olmalı ve API çalışıyor olmalı.{"\n"}Adres: {apiBaseUrl()}
      </Text>
      <Button onPress={retry}>Tekrar dene</Button>
      <Button variant="secondary" onPress={() => setScanning(true)}>
        QR ile bağlan
      </Button>
      <Button variant="ghost" size="sm" onPress={() => void signOut()}>
        Çıkış yap
      </Button>
    </View>
  );
}
