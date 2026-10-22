import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { layout, spacing } from "@unicoach/design";
import { useTheme } from "@/lib/theme";

/**
 * Ekran kabı: `bg` zemin, güvenli alan, klavye açılınca içerik kayar. Tek sütun, 16px kenar boşluğu
 * (`layout.pageGutter.mobile`). Sekmeli ekranlarda üst kenar başlık çubuğuna bırakılır.
 */
export function Screen({
  children,
  scroll = true,
  edges = ["top"],
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const content = [{ padding: layout.pageGutter.mobile, gap: spacing[6], paddingBottom: spacing[10] }, contentStyle];
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, content]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
