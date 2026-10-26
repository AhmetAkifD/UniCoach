import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { ArrowDown, ArrowUp, CircleAlert, ListOrdered, Search, Trash2, TriangleAlert } from "lucide-react-native";
import { layout, radius, spacing } from "@unicoach/design";
import { ApiError, PREFERENCE_MAX, preferenceWarnings, type PreferenceItem, type YksResult } from "@unicoach/shared";
import { ProgramCard } from "@/components/tercih/program-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";

/**
 * Tercih listesi (web'deki PreferenceList): öncelik sırasıyla programlar. Puana ya da koşullara uymayan programlar
 * listede kalır, yalnızca altlarında uyarı görünür. Sıra oklarla değişir; her değişiklik hemen kaydedilir.
 */
export default function PreferenceListScreen() {
  const { colors } = useTheme();
  const [items, setItems] = useState<PreferenceItem[] | null>(null);
  const [latest, setLatest] = useState<YksResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Programlar ekranından eklenip dönülünce liste yenilenir.
  useFocusEffect(
    useCallback(() => {
      Promise.all([api.preferences.list(), api.results.list()]).then(
        ([list, results]) => {
          setItems(list);
          setLatest(results[0] ?? null);
        },
        () => setError("Listen yüklenemedi."),
      );
    }, []),
  );

  async function run(next: PreferenceItem[], call: () => Promise<PreferenceItem[]>) {
    const previous = items;
    setItems(next);
    setBusy(true);
    setError(null);
    try {
      setItems(await call());
    } catch (err) {
      setItems(previous);
      setError(err instanceof ApiError ? err.message : "Liste kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, delta: number) {
    if (!items) return;
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    const renumbered = next.map((item, i) => ({ ...item, position: i + 1 }));
    void run(renumbered, () => api.preferences.reorder(renumbered.map((i) => i.program.code)));
  }

  function remove(code: number) {
    if (!items) return;
    const next = items.filter((i) => i.program.code !== code).map((item, i) => ({ ...item, position: i + 1 }));
    void run(next, () => api.preferences.remove(code));
  }

  if (!items) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: spacing[6] }}>
        {error ? <Text tone="textMuted">{error}</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }

  const scores = latest?.scores ?? null;
  const resultYear = latest?.year ?? null;
  const warned = items.filter((i) => preferenceWarnings(i.program, scores, resultYear).length).length;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: layout.pageGutter.mobile, gap: spacing[4], paddingBottom: spacing[10] }}>
      {items.length === 0 ? (
        <Card style={{ alignItems: "center", gap: spacing[3], paddingVertical: spacing[10] }}>
          <ListOrdered size={40} color={colors.textSubtle} strokeWidth={1.75} />
          <Text size="lg" weight="semibold">
            Listen boş
          </Text>
          <Text size="sm" tone="textMuted" style={{ textAlign: "center" }}>
            Programlar ekranında istediğin programın altındaki "Listeme ekle"ye bas. En fazla {PREFERENCE_MAX} tercih yapabilirsin.
          </Text>
          <Button icon={<Search size={18} color={colors.onPrimary} />} onPress={() => router.push("/tercih-programlar")} style={{ marginTop: spacing[2] }}>
            Programları keşfet
          </Button>
        </Card>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing[3] }}>
            <Text size="2xl" weight="bold" style={{ fontVariant: ["tabular-nums"] }}>
              {items.length}
              <Text tone="textMuted" weight="medium">
                {" "}
                / {PREFERENCE_MAX} tercih
              </Text>
            </Text>
            {items.length < PREFERENCE_MAX && (
              <Button variant="secondary" size="sm" icon={<Search size={16} color={colors.primarySoftText} />} onPress={() => router.push("/tercih-programlar")}>
                Program ekle
              </Button>
            )}
          </View>
          {warned > 0 && (
            <Badge tone="warning" icon={TriangleAlert}>
              {`${warned} tercihte uyarı var`}
            </Badge>
          )}
          {!scores && (
            <Pressable accessibilityRole="link" onPress={() => router.navigate("/tercih")} style={{ borderRadius: radius.md, backgroundColor: colors.infoSoft, padding: spacing[3] }}>
              <Text size="sm" tone="info">
                Sonucun kayıtlı olmadığı için programlar puanınla karşılaştırılamıyor.{" "}
                <Text size="sm" weight="medium" tone="info" style={{ textDecorationLine: "underline" }}>
                  Sonucunu ekle
                </Text>
              </Text>
            </Pressable>
          )}
          {error && (
            <View accessibilityRole="alert" style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start", borderRadius: radius.md, backgroundColor: colors.dangerSoft, padding: spacing[3] }}>
              <CircleAlert size={16} color={colors.danger} style={{ marginTop: 2 }} />
              <Text size="sm" tone="danger" style={{ flex: 1 }}>
                {error}
              </Text>
            </View>
          )}
          {items.map((item, index) => {
            const p = item.program;
            return (
              <ProgramCard
                key={p.code}
                program={p}
                myRank={scores?.find((s) => s.type === p.scoreType)?.placementRank ?? undefined}
                resultYear={resultYear}
                warnings={preferenceWarnings(p, scores, resultYear)}
                withEducationType={false}
                leading={
                  <View
                    accessibilityLabel={`${item.position}. tercih`}
                    style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft }}
                  >
                    <Text size="lg" weight="bold" tone="primarySoftText" style={{ fontVariant: ["tabular-nums"] }}>
                      {item.position}
                    </Text>
                  </View>
                }
                actions={
                  <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: spacing[1], borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing[2] }}>
                    <IconButton label="Yukarı taşı" disabled={busy || index === 0} onPress={() => move(index, -1)}>
                      <ArrowUp size={20} color={colors.text} />
                    </IconButton>
                    <IconButton label="Aşağı taşı" disabled={busy || index === items.length - 1} onPress={() => move(index, 1)}>
                      <ArrowDown size={20} color={colors.text} />
                    </IconButton>
                    <IconButton label="Listeden çıkar" disabled={busy} onPress={() => remove(p.code)}>
                      <Trash2 size={20} color={colors.danger} />
                    </IconButton>
                  </View>
                }
              />
            );
          })}
        </>
      )}
    </ScrollView>
  );
}
