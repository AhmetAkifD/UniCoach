import { Stack } from "expo-router";
import { fonts, useTheme } from "@/lib/theme";

/** Giriş yapılmış uygulama: sekmeler ve onların üstüne açılan ekranlar (profil, kaynak oynatıcısı, kaynak ekleme, PDF görüntüleyici, PDF yükleme). */
export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="profil" options={{ title: "Profil", headerBackTitle: "Geri" }} />
      <Stack.Screen name="kaynak/[id]" options={{ title: "Konu Anlatımı", headerBackTitle: "Geri" }} />
      <Stack.Screen name="kaynak-ekle" options={{ title: "Kaynak ekle", presentation: "modal", headerBackTitle: "Geri" }} />
      <Stack.Screen name="pdf/[id]" options={{ title: "Soru Bankası", headerBackTitle: "Geri" }} />
      <Stack.Screen name="pdf-yukle" options={{ title: "PDF yükle", presentation: "modal", headerBackTitle: "Geri" }} />
    </Stack>
  );
}
