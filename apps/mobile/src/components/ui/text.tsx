import { Text as RNText, type TextProps } from "react-native";
import { typography } from "@unicoach/design";
import { fonts, useTheme, type Colors } from "@/lib/theme";

type Size = keyof typeof typography.fontSize;
type Weight = keyof typeof fonts;

export interface AppTextProps extends TextProps {
  size?: Size;
  weight?: Weight;
  /** Anlamsal renk adı (token) */
  tone?: keyof Colors;
}

/** Uygulamadaki bütün yazılar: Inter, token boyutları ve anlamsal renkler. */
export function Text({ size = "base", weight = "regular", tone = "text", style, ...props }: AppTextProps) {
  const { colors } = useTheme();
  const [fontSize, lineHeight] = typography.fontSize[size];
  return <RNText style={[{ fontFamily: fonts[weight], fontSize, lineHeight, color: colors[tone] }, style]} {...props} />;
}
