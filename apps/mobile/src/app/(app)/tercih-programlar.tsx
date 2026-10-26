import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Check, CircleAlert, ListPlus, RefreshCw, RotateCcw, SlidersHorizontal } from "lucide-react-native";
import { layout, radius, spacing } from "@unicoach/design";
import {
  ApiError,
  defaultProgramScoreType,
  EDUCATION_TYPES,
  EMPTY_PROGRAM_FILTERS,
  formatDate,
  formatRank,
  formatScore,
  nearRankRange,
  placementCode,
  placementRanks,
  PREFERENCE_MAX,
  PROGRAM_LEVEL_LABELS,
  PROGRAM_LEVELS,
  programGroupOptions,
  RESULT_SCORE_CODES,
  RESULT_SCORE_LABELS,
  RESULT_SCORE_TYPES,
  SCHOLARSHIPS,
  UNIVERSITY_TYPE_LABELS,
  UNIVERSITY_TYPES,
  type ProgramFilterOptions,
  type ProgramFilters,
  type ProgramSource,
  type ProgramSummary,
  type YksResult,
} from "@unicoach/shared";
import { ProgramCard } from "@/components/tercih/program-card";
import { Chip } from "@/components/tercih/result-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

const PAGE_SIZE = 25;

/**
 * Program arama (web'deki ProgramExplorer): YÖK Atlas'ın filtreleriyle, indirilmiş veride ya da canlı. Filtreler
 * alttan açılan pencerede; sonuçlar kart olarak, "Daha fazla göster" ile sonraki sayfa eklenir.
 */
export default function ProgramsScreen() {
  const { user } = useSession();
  const { colors } = useTheme();
  const [options, setOptions] = useState<ProgramFilterOptions | null>(null);
  const [latest, setLatest] = useState<YksResult | null>(null);
  const [listCodes, setListCodes] = useState<number[]>([]);
  const [source, setSource] = useState<ProgramSource>("local");
  const [filters, setFilters] = useState<ProgramFilters>(EMPTY_PROGRAM_FILTERS);
  const [items, setItems] = useState<ProgramSummary[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const requestId = useRef(0);
  const ranks = useMemo(() => placementRanks(latest), [latest]);
  const resultYear = latest?.year ?? null;
  const defaultType = defaultProgramScoreType(ranks);

  // Açılışta: filtre seçenekleri, en yeni sonuç (karşılaştırma için) ve tercih listesindeki kodlar.
  useEffect(() => {
    Promise.all([api.programs.filters(), api.results.list(), api.preferences.list()]).then(
      ([opts, results, list]) => {
        const last = results[0] ?? null;
        setOptions(opts);
        setLatest(last);
        setListCodes(list.map((i) => i.program.code));
        setSource(opts.snapshot ? "local" : "live");
        setFilters({ ...EMPTY_PROGRAM_FILTERS, scoreType: defaultProgramScoreType(placementRanks(last)) });
      },
      () => setError("Programlar yüklenemedi."),
    );
  }, []);

  const search = useCallback(
    async (nextPage: number) => {
      const id = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await api.programs.search({ ...filters, source, page: nextPage, size: PAGE_SIZE });
        if (id !== requestId.current) return;
        setItems((prev) => (nextPage === 0 ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
        setPage(nextPage);
      } catch (err) {
        if (id === requestId.current) setError(err instanceof ApiError ? err.message : "Programlar yüklenemedi.");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [filters, source],
  );

  // Filtre değişince kısa gecikmeyle baştan ara (sıra kutusuna yazarken her tuşta istek gitmesin).
  useEffect(() => {
    if (!options) return;
    const t = setTimeout(() => void search(0), 300);
    return () => clearTimeout(t);
  }, [options, search]);

  // Admin indirmeyi başlattıysa bitene kadar durumu yokla.
  useEffect(() => {
    if (!options?.syncing) return;
    const t = setInterval(async () => {
      const next = await api.programs.filters().catch(() => null);
      if (next && !next.syncing) setOptions(next);
    }, 3000);
    return () => clearInterval(t);
  }, [options?.syncing]);

  async function addToList(code: number) {
    setAdding(code);
    setError(null);
    try {
      setListCodes((await api.preferences.add(code)).map((i) => i.program.code));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Program listene eklenemedi.");
    } finally {
      setAdding(null);
    }
  }

  const set = <K extends keyof ProgramFilters>(key: K, value: ProgramFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const groups = useMemo(() => programGroupOptions(options?.groups ?? [], filters.scoreType), [options, filters.scoreType]);
  const myRank = filters.scoreType ? ranks[filters.scoreType] : undefined;
  const activeCount = [
    filters.universityIds.length,
    filters.groupIds.length,
    filters.cityCodes.length,
    filters.level,
    filters.universityType,
    filters.scholarshipId !== null,
    filters.educationTypeId,
    filters.minRank,
    filters.maxRank,
  ].filter(Boolean).length;
  const scores = (latest?.scores ?? []).filter((s) => s.placementScore !== null && s.placementRank !== null);

  if (!options) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg, padding: spacing[6] }}>
        {error ? <Text tone="textMuted">{error}</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }

  const snapshot = options.snapshot;
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: layout.pageGutter.mobile, gap: spacing[5], paddingBottom: spacing[10] }}>
      <View style={{ gap: spacing[2] }}>
        <SegmentedControl<ProgramSource>
          label="Veri kaynağı"
          value={source}
          onChange={setSource}
          options={[
            { value: "local", label: "İndirilmiş veri", hint: snapshot ? formatDate(snapshot.syncedAt) : "Henüz indirilmedi" },
            { value: "live", label: "Canlı", hint: "YÖK Atlas'tan şimdi" },
          ]}
        />
        <Text size="xs" tone="textMuted">
          {snapshot
            ? `İndirilen: ${snapshot.year} taban puanları · ${snapshot.count.toLocaleString("tr-TR")} program`
            : "İndirilmiş veri yok; canlı arama kullanılıyor."}
        </Text>
        {user?.role === "ADMIN" && (
          <Button
            variant="secondary"
            size="sm"
            loading={options.syncing}
            icon={<RefreshCw size={16} color={colors.primarySoftText} />}
            onPress={() => void api.programs.sync().then(() => setOptions((o) => (o ? { ...o, syncing: true } : o)))}
            style={{ alignSelf: "flex-start" }}
          >
            {options.syncing ? "İndiriliyor…" : "Veriyi güncelle"}
          </Button>
        )}
      </View>

      <View style={{ gap: spacing[3] }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
          <Text size="lg" weight="semibold">
            Puanların
          </Text>
          {resultYear && (
            <Pressable accessibilityRole="link" onPress={() => router.navigate("/tercih")} hitSlop={8}>
              <Text size="sm" weight="medium" tone="primary">
                {resultYear} sonucun · düzenle
              </Text>
            </Pressable>
          )}
        </View>
        {scores.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -layout.pageGutter.mobile }} contentContainerStyle={{ gap: spacing[2], paddingHorizontal: layout.pageGutter.mobile }}>
            {scores.map((s) => {
              const active = filters.scoreType === s.type;
              return (
                <Pressable
                  key={s.type}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityHint="Bu puan türüne göre süz"
                  onPress={() => setFilters((f) => ({ ...f, scoreType: s.type, groupIds: [] }))}
                  style={{
                    minWidth: 136,
                    gap: 2,
                    padding: spacing[3],
                    borderRadius: radius.lg,
                    borderWidth: active ? 2 : 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Text size="xs" weight="medium" tone="textMuted">
                    {RESULT_SCORE_LABELS[s.type]} ({placementCode(s.type)})
                  </Text>
                  <Text size="xl" weight="bold" style={{ fontVariant: ["tabular-nums"] }}>
                    {formatScore(s.placementScore!)}
                  </Text>
                  <Text size="sm" style={{ fontVariant: ["tabular-nums"] }}>
                    <Text size="sm" tone="textMuted">
                      Sıra{" "}
                    </Text>
                    {formatRank(s.placementRank!)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <Card style={{ gap: spacing[2] }}>
            <Text size="sm" tone="textMuted">
              Puanını eklersen programlar senin sıranla karşılaştırılır.
            </Text>
            <Pressable accessibilityRole="link" onPress={() => router.navigate("/tercih")}>
              <Text size="sm" weight="medium" tone="primary">
                Sonucunu ekle
              </Text>
            </Pressable>
          </Card>
        )}
      </View>

      <View style={{ flexDirection: "row", gap: spacing[2], alignItems: "center" }}>
        <Button variant="secondary" icon={<SlidersHorizontal size={18} color={colors.primarySoftText} />} onPress={() => setFiltersOpen(true)} style={{ flex: 1 }}>
          {`Filtreler${filters.scoreType ? ` · ${RESULT_SCORE_CODES[filters.scoreType]}` : ""}${activeCount ? ` · ${activeCount}` : ""}`}
        </Button>
        {myRank ? (
          <Button variant="ghost" onPress={() => setFilters((f) => ({ ...f, ...nearRankRange(myRank) }))}>
            Sırama yakın
          </Button>
        ) : null}
      </View>
      {myRank ? (
        <Text size="xs" tone="textSubtle">
          {filters.scoreType && RESULT_SCORE_LABELS[filters.scoreType]} yerleştirme sıran {formatRank(myRank)}
          {resultYear ? ` (${resultYear} sonucun)` : ""}. Programlar, sonuç yılına en yakın yılın taban sırasıyla karşılaştırılır; o yıl vurgulanır. Karşılaştırma
          yalnızca fikir verir.
        </Text>
      ) : filters.scoreType ? (
        <Text size="xs" tone="textSubtle">
          Bu puan türünde kayıtlı yerleştirme sıran yok; karşılaştırma gösterilmez.
        </Text>
      ) : null}

      {error && (
        <View accessibilityRole="alert" style={{ flexDirection: "row", gap: spacing[2], alignItems: "flex-start", borderRadius: radius.md, backgroundColor: colors.dangerSoft, padding: spacing[3] }}>
          <CircleAlert size={16} color={colors.danger} style={{ marginTop: 2 }} />
          <Text size="sm" tone="danger" style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      )}

      <View style={{ gap: spacing[3] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text size="lg" weight="semibold">
            Programlar
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
            {loading && <ActivityIndicator size="small" color={colors.primary} />}
            {total !== null && (
              <Text size="sm" tone="textMuted" style={{ fontVariant: ["tabular-nums"] }}>
                {total ? `${total.toLocaleString("tr-TR")} program` : "Sonuç yok"}
              </Text>
            )}
          </View>
        </View>
        {items.map((p) => {
          const inList = listCodes.includes(p.code);
          const full = !inList && listCodes.length >= PREFERENCE_MAX;
          return (
            <ProgramCard
              key={p.code}
              program={p}
              myRank={ranks[p.scoreType]}
              resultYear={resultYear}
              actions={
                <Button
                  variant={inList ? "ghost" : "secondary"}
                  size="sm"
                  disabled={inList || full}
                  loading={adding === p.code}
                  icon={inList ? <Check size={16} color={colors.text} /> : <ListPlus size={16} color={colors.primarySoftText} />}
                  onPress={() => void addToList(p.code)}
                  style={{ alignSelf: "flex-start" }}
                >
                  {inList ? "Listede" : full ? `Listen dolu (${PREFERENCE_MAX})` : "Listeme ekle"}
                </Button>
              }
            />
          );
        })}
        {total === 0 && !loading && <Card style={{ alignItems: "center", paddingVertical: spacing[8] }}><Text size="sm" tone="textMuted">Bu filtrelere uyan program yok.</Text></Card>}
        {total !== null && items.length < total && (
          <Button variant="secondary" loading={loading} onPress={() => void search(page + 1)}>
            {`Daha fazla göster (${(total - items.length).toLocaleString("tr-TR")} kaldı)`}
          </Button>
        )}
      </View>

      <Sheet visible={filtersOpen} title="Filtreler" onClose={() => setFiltersOpen(false)}>
        <View style={{ paddingHorizontal: spacing[5], gap: spacing[5] }}>
          <ChoiceRow
            label="Puan türü"
            value={filters.scoreType}
            options={RESULT_SCORE_TYPES.map((t) => ({ value: t, label: `${RESULT_SCORE_LABELS[t]} (${RESULT_SCORE_CODES[t]})` }))}
            onChange={(v) => setFilters((f) => ({ ...f, scoreType: v, groupIds: [] }))}
          />
          <MultiSelect label="Program" options={groups} value={filters.groupIds} onChange={(v) => set("groupIds", v)} />
          <MultiSelect label="Üniversite" options={options.universities.map((u) => ({ value: u.id, label: u.name }))} value={filters.universityIds} onChange={(v) => set("universityIds", v)} />
          <MultiSelect label="Şehir" options={options.cities.map((c) => ({ value: c.code, label: c.name }))} value={filters.cityCodes} onChange={(v) => set("cityCodes", v)} />
          <ChoiceRow
            label="Üniversite türü"
            value={filters.universityType}
            options={UNIVERSITY_TYPES.map((t) => ({ value: t, label: UNIVERSITY_TYPE_LABELS[t] }))}
            onChange={(v) => set("universityType", v)}
          />
          <ChoiceRow label="Burs / ücret" value={filters.scholarshipId} options={SCHOLARSHIPS.map((s) => ({ value: s.id, label: s.label }))} onChange={(v) => set("scholarshipId", v)} />
          <ChoiceRow label="Öğretim türü" value={filters.educationTypeId} options={EDUCATION_TYPES.map((s) => ({ value: s.id, label: s.label }))} onChange={(v) => set("educationTypeId", v)} />
          <ChoiceRow label="Düzey" value={filters.level} options={PROGRAM_LEVELS.map((l) => ({ value: l, label: PROGRAM_LEVEL_LABELS[l] }))} onChange={(v) => set("level", v)} />
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <RankField label="Başarı sırası (en iyi)" value={filters.minRank} onChange={(v) => set("minRank", v)} />
            <RankField label="Başarı sırası (en kötü)" value={filters.maxRank} onChange={(v) => set("maxRank", v)} />
          </View>
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <Button
              variant="ghost"
              icon={<RotateCcw size={16} color={colors.text} />}
              onPress={() => setFilters({ ...EMPTY_PROGRAM_FILTERS, scoreType: defaultType })}
              style={{ flex: 1 }}
            >
              Sıfırla
            </Button>
            <Button onPress={() => setFiltersOpen(false)} style={{ flex: 1 }}>
              {total !== null ? `${total.toLocaleString("tr-TR")} programı göster` : "Göster"}
            </Button>
          </View>
        </View>
      </Sheet>
    </ScrollView>
  );
}

/** Tek seçim: "Tümü" ve seçenekler, çip olarak (alta sarılır). */
function ChoiceRow<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T | null) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 6 }}>
      <Text size="sm" weight="medium" tone="textMuted">
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing[2] }}>
        <Chip label="Tümü" active={value === null} onPress={() => onChange(null)} />
        {options.map((o) => (
          <Chip key={String(o.value)} label={o.label} active={value === o.value} onPress={() => onChange(o.value)} />
        ))}
      </View>
    </View>
  );
}

function RankField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Input
        label={label}
        keyboardType="number-pad"
        value={value === null ? "" : formatRank(value)}
        onChangeText={(t) => {
          const digits = t.replace(/\D/g, "").slice(0, 7);
          onChange(digits ? Number(digits) : null);
        }}
        style={{ textAlign: "right", fontVariant: ["tabular-nums"] }}
      />
    </View>
  );
}
