import { View } from "react-native";
import { Image } from "expo-image";
import type { AuthUser } from "@unicoach/shared";
import { apiBaseUrl, getApiToken } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { Text } from "./ui/text";

function initials(user: Pick<AuthUser, "firstName" | "lastName">) {
  return [user.firstName, user.lastName].map((p) => p.trim().charAt(0).toLocaleUpperCase("tr")).join("");
}

/** Profil fotoğrafı (oturum belirteciyle API'den), yoksa baş harfler — web'deki UserAvatar. */
export function UserAvatar({ user, size = 36 }: { user: Pick<AuthUser, "firstName" | "lastName" | "avatarUrl">; size?: number }) {
  const { colors } = useTheme();
  if (user.avatarUrl) {
    const token = getApiToken();
    return (
      <Image
        source={{ uri: `${apiBaseUrl()}${user.avatarUrl}`, headers: token ? { Authorization: `Bearer ${token}` } : undefined }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}
    >
      <Text weight="semibold" tone="primarySoftText" style={{ fontSize: size * 0.38, lineHeight: size * 0.5 }}>
        {initials(user)}
      </Text>
    </View>
  );
}
