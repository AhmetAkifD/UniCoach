import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { TriangleAlert } from "lucide-react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { spacing } from "@unicoach/design";
import type { YksResult } from "@unicoach/shared";
import { ResultForm } from "@/components/tercih/result-form";
import { ResultImport } from "@/components/tercih/result-import";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { Screen } from "@/components/ui/screen";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

type Method = "document" | "manual";

/**
 * Sonuç ekleme (belgeden ya da elle) ve düzenleme (`?yil=`; yalnızca form, yıl değişmez). Web'de aynı sayfada
 * olan AddResult ve SavedResult'ın düzenleme kısmı. `?yillar=` kayıtlı yıllar (üzerine yazma onayı için).
 */
export default function ResultScreen() {
  const params = useLocalSearchParams<{ yil?: string; yillar?: string }>();
  const { user } = useSession();
  const { colors } = useTheme();
  const savedYears = (params.yillar ?? "").split(",").filter(Boolean).map(Number);
  const editYear = params.yil ? Number(params.yil) : null;
  const [method, setMethod] = useState<Method>("document");
  // Düzenlemede sonuç okunamazsa ekleme ekranına düşülmez; hata ve "Tekrar dene" gösterilir.
  const [edit, setEdit] = useState<{ result: YksResult | null; error: string | null }>({ result: null, error: null });
  const loadEdit = useCallback(async () => {
    if (!editYear) return;
    setEdit({ result: null, error: null });
    try {
      const found = (await api.results.list()).find((r) => r.year === editYear);
      setEdit(found ? { result: found, error: null } : { result: null, error: `${editYear} sonucu bulunamadı. Silinmiş olabilir.` });
    } catch {
      setEdit({ result: null, error: "Sonucun yüklenemedi." });
    }
  }, [editYear]);
  useEffect(() => {
    void loadEdit();
  }, [loadEdit]);

  const done = () => router.back();
  // Ekran yeniden kullanılıp parametre değişirse eski yılın sonucu gösterilmesin.
  const result = editYear && edit.result?.year === editYear ? edit.result : null;
  if (editYear && !result) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[4], backgroundColor: colors.bg, padding: spacing[6] }}>
        <Stack.Screen options={{ title: `${editYear} sonucunu düzenle` }} />
        {edit.error ? (
          <>
            <TriangleAlert size={32} color={colors.textSubtle} strokeWidth={1.75} />
            <Text tone="textMuted" style={{ textAlign: "center" }}>
              {edit.error}
            </Text>
            <Button variant="secondary" onPress={() => void loadEdit()}>
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
    <Screen edges={["bottom"]}>
      <Stack.Screen options={{ title: result ? `${result.year} sonucunu düzenle` : "Sonucunu ekle" }} />
      {result ? (
        <ResultForm result={result} savedYears={savedYears} onSaved={done} />
      ) : (
        <View style={{ gap: spacing[5] }}>
          <SegmentedControl<Method>
            label="Nasıl ekleyeceksin?"
            value={method}
            onChange={setMethod}
            options={[
              { value: "document", label: "Sonuç belgesinden" },
              { value: "manual", label: "Elle gir" },
            ]}
          />
          {method === "document" ? (
            <ResultImport savedYears={savedYears} accountName={`${user?.firstName ?? ""} ${user?.lastName ?? ""}`} onSaved={done} />
          ) : (
            <ResultForm savedYears={savedYears} onSaved={done} />
          )}
        </View>
      )}
    </Screen>
  );
}
