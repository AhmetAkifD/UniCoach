import { router } from "expo-router";
import { X } from "lucide-react-native";
import { View } from "react-native";
import { spacing } from "@unicoach/design";
import { PairScanner } from "@/components/pair-scanner";
import { IconButton } from "@/components/ui/icon-button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/lib/theme";

/** QR ile bağlan (giriş ekranından ve Profil'den): web'deki "Telefonu eşle" kodu okutulur. */
export default function PairScreen() {
  const { colors } = useTheme();
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <Screen edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text size="xl" weight="semibold">
          QR ile bağlan
        </Text>
        <IconButton label="Kapat" onPress={close}>
          <X size={22} color={colors.text} />
        </IconButton>
      </View>
      <View style={{ gap: spacing[2] }}>
        <PairScanner onDone={() => router.replace("/")} />
      </View>
    </Screen>
  );
}
