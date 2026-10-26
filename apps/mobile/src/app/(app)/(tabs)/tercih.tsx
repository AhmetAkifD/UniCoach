import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { GraduationCap, Info, ListOrdered, Pencil, Plus, Search, Trash2, TriangleAlert } from "lucide-react-native";
import { layout, radius, spacing } from "@unicoach/design";
import { formatDate, type YksResult } from "@unicoach/shared";
import { ResultSummary } from "@/components/tercih/result-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useDialog } from "@/components/ui/use-dialog";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

/** YKS Tercih: kayıtlı sonuçlar, sonuç ekleme ve programlara/tercih listesine geçiş (web'deki /tercih). */
export default function TercihScreen() {
  const { user } = useSession();
  const { colors } = useTheme();
  const { confirm, dialog } = useDialog();
  const [results, setResults] = useState<YksResult[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setResults(await api.results.list());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function remove(year: number) {
    const ok = await confirm({ title: `${year} sonucunu sil`, message: "Bu yılın puanları ve sıraları silinsin mi?", confirmLabel: "Sil", danger: true });
    if (!ok) return;
    try {
      await api.results.remove(year);
      await load();
    } catch {
      setError(true);
    }
  }

  if (!results) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[4], backgroundColor: colors.bg, padding: spacing[6] }}>
        {error ? (
          <>
            <TriangleAlert size={32} color={colors.textSubtle} strokeWidth={1.75} />
            <Text tone="textMuted">Sonuçların yüklenemedi.</Text>
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

  const years = results.map((r) => r.year).join(",");
  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: layout.pageGutter.mobile, gap: spacing[6], paddingBottom: spacing[10] }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.primary}
          colors={[colors.primary]}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      {dialog}
      <View style={{ gap: spacing[4] }}>
        <Text tone="textMuted">Önce sınav sonucunu ekle. Tercih yaparken puanların ve başarı sıraların buradan kullanılacak.</Text>
        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          <Button
            variant={results.length ? "primary" : "secondary"}
            icon={<Search size={18} color={results.length ? colors.onPrimary : colors.primarySoftText} />}
            onPress={() => router.push("/tercih-programlar")}
            style={{ flex: 1 }}
          >
            Programlar
          </Button>
          <Button variant="secondary" icon={<ListOrdered size={18} color={colors.primarySoftText} />} onPress={() => router.push("/tercih-liste")} style={{ flex: 1 }}>
            Tercih listem
          </Button>
        </View>
      </View>

      {user?.examTrack === "LGS" && (
        <View style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start", borderRadius: radius.md, backgroundColor: colors.infoSoft, padding: spacing[3] }}>
          <Info size={16} color={colors.info} style={{ marginTop: 2 }} />
          <Text size="sm" tone="info" style={{ flex: 1 }}>
            Tercih modülü YKS içindir. LGS'ye hazırlanıyorsan sınavını profilinden değiştirebilirsin.
          </Text>
        </View>
      )}

      {results.length === 0 ? (
        <Card style={{ alignItems: "center", gap: spacing[3], paddingVertical: spacing[10] }}>
          <GraduationCap size={40} color={colors.textSubtle} strokeWidth={1.75} />
          <Text size="lg" weight="semibold">
            Sonucun henüz yok
          </Text>
          <Text size="sm" tone="textMuted" style={{ textAlign: "center" }}>
            ÖSYM sonuç belgeni seç ya da puanlarını elle gir. Programlar senin sıranla karşılaştırılır.
          </Text>
          <Button icon={<Plus size={20} color={colors.onPrimary} />} onPress={() => router.push({ pathname: "/tercih-sonuc", params: { yillar: years } })} style={{ marginTop: spacing[2] }}>
            Sonucunu ekle
          </Button>
        </Card>
      ) : (
        <>
          {results.map((r) => (
            <View key={r.id} style={{ gap: spacing[3] }}>
              <View style={{ gap: spacing[2] }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3], flexWrap: "wrap" }}>
                  <Text size="xl" weight="semibold">
                    {r.year} YKS sonucun
                  </Text>
                  <Badge tone={r.source === "document" ? "success" : "neutral"}>{r.source === "document" ? "Belgeden okundu" : "Elle girildi"}</Badge>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text size="xs" tone="textMuted">
                    Güncellendi: {formatDate(r.updatedAt)}
                  </Text>
                  <View style={{ flexDirection: "row", gap: spacing[1] }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Pencil size={16} color={colors.text} />}
                      onPress={() => router.push({ pathname: "/tercih-sonuc", params: { yil: String(r.year), yillar: years } })}
                    >
                      Düzenle
                    </Button>
                    <Button variant="ghost" size="sm" icon={<Trash2 size={16} color={colors.danger} />} onPress={() => void remove(r.year)}>
                      <Text size="sm" weight="medium" tone="danger">
                        Sil
                      </Text>
                    </Button>
                  </View>
                </View>
              </View>
              <ResultSummary result={r} />
            </View>
          ))}
          <Button variant="secondary" icon={<Plus size={18} color={colors.primarySoftText} />} onPress={() => router.push({ pathname: "/tercih-sonuc", params: { yillar: years } })}>
            Başka bir sonuç ekle
          </Button>
        </>
      )}
    </ScrollView>
  );
}
