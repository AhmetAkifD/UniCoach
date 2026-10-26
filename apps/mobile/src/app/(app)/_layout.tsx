import { Stack } from "expo-router";
import { fonts, useTheme } from "@/lib/theme";

/** Giriş yapılmış uygulama: sekmeler ve onların üstüne açılan ekranlar (profil, kaynak oynatıcısı, kaynak ekleme, PDF görüntüleyici, PDF yükleme, soru çıkarma, sınav, yeni sınav, tercih sonucu, programlar, tercih listesi). */
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
      <Stack.Screen name="sorular/[id]" options={{ title: "Soruları çıkar", headerBackTitle: "Geri" }} />
      <Stack.Screen name="sinav/[id]" options={{ title: "Sınav", headerBackTitle: "Geri" }} />
      <Stack.Screen name="sinav-incele/[id]" options={{ title: "Gözden geçir", headerBackTitle: "Geri" }} />
      <Stack.Screen name="tercih-sonuc" options={{ title: "Sonucunu ekle", presentation: "modal", headerBackTitle: "Geri" }} />
      <Stack.Screen name="tercih-programlar" options={{ title: "Programlar", headerBackTitle: "Geri" }} />
      <Stack.Screen name="tercih-liste" options={{ title: "Tercih listem", headerBackTitle: "Geri" }} />
      <Stack.Screen name="sinav-yeni" options={{ title: "Yeni sınav", presentation: "modal", headerBackTitle: "Geri" }} />
      <Stack.Screen name="calisma-alani" options={{ title: "Çalışma Alanı", headerBackTitle: "Geri" }} />
      <Stack.Screen name="pdf-yukle" options={{ title: "PDF yükle", presentation: "modal", headerBackTitle: "Geri" }} />
    </Stack>
  );
}
