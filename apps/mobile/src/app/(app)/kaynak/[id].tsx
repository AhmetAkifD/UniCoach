import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View, useWindowDimensions } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { StatusBar } from "expo-status-bar";
import { NotebookPen, TriangleAlert } from "lucide-react-native";
import { spacing } from "@unicoach/design";
import { ApiError, type SourceDetail } from "@unicoach/shared";
import { SourcePlayer } from "@/components/library/source-player";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { subjectColor } from "@/lib/subject-color";
import { useTheme } from "@/lib/theme";

/** Tam ekrandan çıkınca dikey kilit bu süre sonra kalkar; telefon yatay tutuluyorsa ekran yeniden yan döner. */
const PORTRAIT_HOLD_MS = 1500;

/**
 * Bir kaynağın oynatıcı ekranı (web'deki /konular/[id]); sekmelerin üstüne açılır. Uygulama dikey kilitlidir,
 * yalnızca bu ekranda döndürme açılır: telefon yan çevrilince video bütün ekranı kaplar. Oynatıcıdaki tam ekran
 * düğmesi ekranı yataya, tam ekrandan çıkış dikeye çevirir (telefon dik tutulurken de).
 */
export default function SourceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const { colors } = useTheme();
  const [source, setSource] = useState<SourceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  const landscape = Platform.OS !== "web" && width > height;

  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    if (Platform.OS === "web") return;
    void ScreenOrientation.unlockAsync();
    return () => {
      mounted.current = false;
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  function onFullscreenChange(on: boolean) {
    if (Platform.OS === "web") return;
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    unlockTimer.current = null;
    if (on) {
      void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      return;
    }
    // Önce dikeye zorla, sonra telefonla döndürmeyi yeniden aç.
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).then(() => {
      // Bu arada ekrandan çıkıldıysa kilit dikeyde kalmalı.
      if (!mounted.current) return;
      unlockTimer.current = setTimeout(() => void ScreenOrientation.unlockAsync(), PORTRAIT_HOLD_MS);
    });
  }

  const load = useCallback(async () => {
    setError(null);
    try {
      setSource(await api.sources.get(id));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? "Bu kaynak bulunamadı. Silinmiş olabilir." : "Kaynak yüklenemedi.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!source) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[4], backgroundColor: colors.bg, padding: spacing[6] }}>
        <Stack.Screen options={{ title: "Konu Anlatımı" }} />
        {error ? (
          <>
            <TriangleAlert size={32} color={colors.textSubtle} strokeWidth={1.75} />
            <Text tone="textMuted" style={{ textAlign: "center" }}>
              {error}
            </Text>
            <Button variant="secondary" onPress={() => void load()}>
              Tekrar dene
            </Button>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: source.title,
          headerShown: !landscape,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Çalışma alanında aç"
              onPress={() => router.push({ pathname: "/calisma-alani", params: { video: source.id } })}
              hitSlop={10}
            >
              <NotebookPen size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <StatusBar hidden={landscape} />
      <SourcePlayer
        fullscreen={landscape}
        onFullscreenChange={onFullscreenChange}
        source={source}
        examTrack={user?.examTrack ?? null}
        color={subjectColor(source.subject)}
        onChanged={(summary) => setSource((prev) => (prev ? { ...prev, ...summary } : prev))}
        onDeleted={() => router.back()}
      />
    </>
  );
}
