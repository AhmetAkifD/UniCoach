/**
 * UniCoach tasarım token'ları — "Modern & sakin".
 *
 * TEK KAYNAK: Web (Tailwind, dist/theme.css üzerinden) ve mobil (Expo, doğrudan
 * bu nesneler) aynı değerleri kullanır. Bir değeri değiştirirseniz docs/DESIGN.md
 * dosyasını da güncelleyin.
 */

/** Ham renk paletleri. Bileşenlerde doğrudan değil, `semantic` üzerinden kullanın. */
export const palette = {
  indigo: {
    50: "#EEF2FF",
    100: "#E0E7FF",
    200: "#C7D2FE",
    300: "#A5B4FC",
    400: "#818CF8",
    500: "#6366F1",
    600: "#4F46E5",
    700: "#4338CA",
    800: "#3730A3",
    900: "#312E81",
    950: "#1E1B4B",
  },
  violet: {
    50: "#F5F3FF",
    100: "#EDE9FE",
    200: "#DDD6FE",
    300: "#C4B5FD",
    400: "#A78BFA",
    500: "#8B5CF6",
    600: "#7C3AED",
    700: "#6D28D9",
    800: "#5B21B6",
    900: "#4C1D95",
    950: "#2E1065",
  },
  slate: {
    0: "#FFFFFF",
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    800: "#1E293B",
    900: "#0F172A",
    950: "#020617",
  },
  /** Koyu tema yüzeyleri: hafif indigo tonlu lacivert. */
  night: {
    900: "#0B1020",
    800: "#121831",
    700: "#1A2140",
    600: "#263056",
  },
  green: { 50: "#F0FDF4", 500: "#22C55E", 700: "#15803D", 900: "#14532D" },
  amber: { 50: "#FFFBEB", 500: "#F59E0B", 700: "#B45309", 900: "#78350F" },
  red: { 50: "#FEF2F2", 500: "#EF4444", 600: "#DC2626", 900: "#7F1D1D" },
  sky: { 50: "#F0F9FF", 500: "#0EA5E9", 700: "#0369A1", 900: "#0C4A6E" },
} as const;

export type ThemeName = "light" | "dark";

/** Anlamsal renkler: arayüzde yalnızca bunları kullanın. */
export const semantic = {
  light: {
    bg: palette.slate[50],
    surface: palette.slate[0],
    surfaceMuted: palette.slate[100],
    border: palette.slate[200],
    borderStrong: palette.slate[300],
    text: palette.slate[900],
    textMuted: palette.slate[500],
    textSubtle: palette.slate[400],
    primary: palette.indigo[600],
    primaryHover: palette.indigo[700],
    primarySoft: palette.indigo[50],
    primarySoftText: palette.indigo[700],
    onPrimary: palette.slate[0],
    accent: palette.violet[500],
    accentSoft: palette.violet[50],
    focusRing: palette.indigo[300],
    success: palette.green[700],
    successSoft: palette.green[50],
    warning: palette.amber[700],
    warningSoft: palette.amber[50],
    danger: palette.red[600],
    dangerSoft: palette.red[50],
    info: palette.sky[700],
    infoSoft: palette.sky[50],
  },
  dark: {
    bg: palette.night[900],
    surface: palette.night[800],
    surfaceMuted: palette.night[700],
    border: palette.night[600],
    borderStrong: palette.slate[600],
    text: palette.slate[200],
    textMuted: palette.slate[400],
    textSubtle: palette.slate[500],
    primary: palette.indigo[400],
    primaryHover: palette.indigo[300],
    primarySoft: palette.indigo[950],
    primarySoftText: palette.indigo[200],
    onPrimary: palette.night[900],
    accent: palette.violet[400],
    accentSoft: palette.violet[950],
    focusRing: palette.indigo[500],
    success: palette.green[500],
    successSoft: palette.green[900],
    warning: palette.amber[500],
    warningSoft: palette.amber[900],
    danger: palette.red[500],
    dangerSoft: palette.red[900],
    info: palette.sky[500],
    infoSoft: palette.sky[900],
  },
} as const satisfies Record<ThemeName, Record<string, string>>;

export type SemanticColor = keyof typeof semantic.light;

/**
 * Ders renkleri: konu kartları, grafikler ve rozetlerde dersi ayırt etmek için.
 * Her iki temada da okunur olacak şekilde 500-600 tonları seçildi.
 */
export const subjectColors = {
  matematik: "#6366F1",
  geometri: "#8B5CF6",
  fizik: "#0EA5E9",
  kimya: "#10B981",
  biyoloji: "#84CC16",
  turkce: "#F43F5E",
  edebiyat: "#EC4899",
  tarih: "#F59E0B",
  cografya: "#14B8A6",
  felsefe: "#A855F7",
  din: "#06B6D4",
  ingilizce: "#3B82F6",
  fen: "#22C55E",
  inkilap: "#EA580C",
} as const;

export type SubjectColorKey = keyof typeof subjectColors;

export const typography = {
  fontFamily: {
    /** Web: next/font ile Inter; mobil: @expo-google-fonts/inter. */
    sans: "Inter",
    mono: "JetBrains Mono",
  },
  /** px cinsinden. [boyut, satır yüksekliği] */
  fontSize: {
    xs: [12, 16],
    sm: [14, 20],
    base: [16, 24],
    lg: [18, 28],
    xl: [20, 28],
    "2xl": [24, 32],
    "3xl": [30, 36],
    "4xl": [36, 40],
  },
  fontWeight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;

/** 4px tabanlı boşluk ölçeği (px). Tailwind'in varsayılan ölçeğiyle birebir aynıdır: p-4 = 16px. */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** Köşe yarıçapları (px). Kart = lg, buton/input = md, çip/rozet = full. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

/** Gölgeler: düşük kontrastlı, "yüzen kart" hissi. Mobilde elevation karşılıkları verilir. */
export const shadow = {
  card: {
    css: "0 1px 2px rgb(15 23 42 / 0.04), 0 4px 12px rgb(15 23 42 / 0.06)",
    elevation: 2,
  },
  raised: {
    css: "0 2px 4px rgb(15 23 42 / 0.06), 0 12px 24px rgb(15 23 42 / 0.10)",
    elevation: 6,
  },
} as const;

/** Animasyon süreleri (ms). */
export const motion = {
  fast: 150,
  base: 250,
  slow: 400,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

/** Ekran kırılımları (px) — web için. Mobil uygulama tek sütun düzeni kullanır. */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

/** İçerik genişliği sınırı (px). */
export const layout = {
  maxContentWidth: 1200,
  headerHeight: 64,
  pageGutter: { mobile: 16, desktop: 32 },
} as const;
