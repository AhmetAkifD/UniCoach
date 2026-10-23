import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { radius, spacing } from "@unicoach/design";
import { useTheme } from "@/lib/theme";
import { Text } from "./text";

/**
 * Alttan açılan pencere (ders seçimi, PDF ayarları). Dışına dokununca ya da geri tuşuyla kapanır;
 * içerik uzunsa kendi içinde kayar.
 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // Android: karartma durum çubuğunun ve gezinme çubuğunun altına da uzansın.
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
        <Pressable
          // İçeriğe dokunmak pencereyi kapatmasın.
          onPress={() => undefined}
          style={{
            maxHeight: "85%",
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: insets.bottom,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing[4], paddingLeft: spacing[5] }}>
            <Text size="lg" weight="semibold">
              {title}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={onClose} hitSlop={8}>
              <X size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing[4] }}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
