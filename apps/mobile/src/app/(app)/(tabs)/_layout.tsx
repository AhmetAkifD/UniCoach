import { Pressable, type ColorValue } from "react-native";
import { Tabs, router } from "expo-router";
import { BookOpenText, ClipboardList, GraduationCap, House, PlaySquare, type LucideIcon } from "lucide-react-native";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/lib/session";
import { fonts, useTheme } from "@/lib/theme";

const icon =
  (Icon: LucideIcon) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Icon color={color as string} size={size - 2} strokeWidth={1.75} />;

/** Sekmeler: altta sekme çubuğu (DESIGN.md: Ana Sayfa · Konular · Soru Bankası · Sınavlar · Tercih), sağ üstte profil (üstüne açılır). */
export default function AppLayout() {
  const { user } = useSession();
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
        headerTintColor: colors.text,
        headerRight: () =>
          user ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Profil"
              onPress={() => router.push("/profil")}
              style={{ marginRight: 16 }}
              hitSlop={8}
            >
              <UserAvatar user={user} size={34} />
            </Pressable>
          ) : null,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Ana Sayfa", headerTitle: "UniCoach", tabBarIcon: icon(House) }} />
      <Tabs.Screen name="konular" options={{ title: "Konular", headerTitle: "Konu Anlatımı", tabBarIcon: icon(PlaySquare) }} />
      <Tabs.Screen name="soru-bankasi" options={{ title: "Soru Bankası", tabBarIcon: icon(BookOpenText) }} />
      <Tabs.Screen name="sinavlar" options={{ title: "Sınavlar", headerTitle: "Geçmiş Sınavlar", tabBarIcon: icon(ClipboardList) }} />
      <Tabs.Screen name="tercih" options={{ title: "Tercih", headerTitle: "YKS Tercih", tabBarIcon: icon(GraduationCap) }} />
    </Tabs>
  );
}
