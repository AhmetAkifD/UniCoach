import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { semantic, type ThemeName } from "@unicoach/design";
import type { ThemePreference } from "@unicoach/shared";

export type Colors = (typeof semantic)[ThemeName];

interface Theme {
  name: ThemeName;
  colors: Colors;
}

const ThemeContext = createContext<Theme>({ name: "light", colors: semantic.light });

/**
 * Renkler packages/design token'larından gelir (web ile aynı değerler). Tercih hesaptadır (`AuthUser.theme`);
 * "system" ya da giriş yapılmamışsa cihazın açık/koyu ayarı izlenir.
 */
export function ThemeProvider({ preference, children }: { preference: ThemePreference; children: ReactNode }) {
  const system = useColorScheme();
  const name: ThemeName = preference === "system" ? (system === "dark" ? "dark" : "light") : preference;
  const value = useMemo(() => ({ name, colors: semantic[name] }), [name]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/** Inter ağırlıkları: React Native'de her ağırlık ayrı yazı tipi dosyasıdır. */
export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;
