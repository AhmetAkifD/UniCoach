"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, CircleAlert, ListPlus, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import {
  ApiError,
  EDUCATION_TYPES,
  formatRank,
  formatScore,
  PROGRAM_LEVEL_LABELS,
  PROGRAM_LEVELS,
  PREFERENCE_MAX,
  comparisonYear,
  rankComparison,
  placementCode,
  RESULT_SCORE_CODES,
  RESULT_SCORE_LABELS,
  RESULT_SCORE_TYPES,
  SCHOLARSHIPS,
  UNIVERSITY_TYPE_LABELS,
  UNIVERSITY_TYPES,
  EMPTY_PROGRAM_FILTERS,
  defaultProgramScoreType,
  nearRankRange,
  programGroupOptions,
  programMetaLine,
  type ProgramFilters,
  type ProgramFilterOptions,
  type ProgramPage,
  type ProgramSource,
  type ResultScoreType,
  type YksScore,
} from "@unicoach/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MultiSelect } from "@/components/ui/multi-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/exam-format";
import { ProgramYears } from "./program-years";

const PAGE_SIZE = 25;

type Filters = ProgramFilters;
const EMPTY = EMPTY_PROGRAM_FILTERS;

function Select<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T | null;
  onChange: (value: T | null) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text-muted">{label}</span>
      <select
        value={value === null ? "" : String(value)}
        onChange={(e) => {
          const found = options.find((o) => String(o.value) === e.target.value);
          onChange(found ? found.value : null);
        }}
        className="h-10 rounded-md border border-border-strong bg-surface px-3 text-sm text-text"
      >
        <option value="">Tümü</option>
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function RankInput({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text-muted">{label}</span>
      <input
        inputMode="numeric"
        value={value === null ? "" : formatRank(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 7);
          onChange(digits ? Number(digits) : null);
        }}
        className="h-10 rounded-md border border-border-strong bg-surface px-3 text-right text-sm tabular-nums text-text"
      />
    </label>
  );
}

/**
 * Program arama: YÖK Atlas'ın filtreleriyle. Kaynak "İndirilmiş veri" (API'nin veritabanı) ya da
 * "Canlı" (her aramada YÖK Atlas) olabilir; ikisi de aynı sonucu aynı biçimde döndürür.
 */
export function ProgramExplorer({
  initialOptions,
  ranks,
  scores,
  resultYear,
  isAdmin,
  initialListCodes,
}: {
  initialOptions: ProgramFilterOptions;
  /** Öğrencinin puan türü başına yerleştirme sırası (son sonucundan) */
  ranks: Partial<Record<ResultScoreType, number>>;
  /** Son sonucun puanları (yerleştirme puanı olanlar) */
  scores: YksScore[];
  resultYear: number | null;
  isAdmin: boolean;
  /** Tercih listesindeki program kodları */
  initialListCodes: number[];
}) {
  const [options, setOptions] = useState(initialOptions);
  const [source, setSource] = useState<ProgramSource>(initialOptions.snapshot ? "local" : "live");
  const defaultType = defaultProgramScoreType(ranks);
  const [filters, setFilters] = useState<Filters>({ ...EMPTY, scoreType: defaultType });
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ProgramPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const requestId = useRef(0);
  const [listCodes, setListCodes] = useState(initialListCodes);
  const [adding, setAdding] = useState<number | null>(null);

  // Program, puana uymasa da eklenir; uyumsuzluk tercih listesinde uyarı olarak görünür.
  async function addToList(code: number) {
    setAdding(code);
    setError(null);
    try {
      const list = await browserApi.preferences.add(code);
      setListCodes(list.map((i) => i.program.code));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Program listene eklenemedi.");
    } finally {
      setAdding(null);
    }
  }

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  };

  const search = useCallback(() => {
    const id = ++requestId.current;
    setError(null);
    startLoading(async () => {
      try {
        const res = await browserApi.programs.search({ ...filters, source, page, size: PAGE_SIZE });
        if (id === requestId.current) setResult(res);
      } catch (err) {
        if (id === requestId.current) setError(err instanceof ApiError ? err.message : "Programlar yüklenemedi.");
      }
    });
  }, [filters, source, page]);

  // Filtre değişince kısa bir gecikmeyle ara (sıra kutusuna yazarken her tuşta istek gitmesin).
  useEffect(() => {
    const t = setTimeout(search, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Admin indirmeyi başlattıysa bitene kadar durumu yokla.
  useEffect(() => {
    if (!options.syncing) return;
    const t = setInterval(async () => {
      const next = await browserApi.programs.filters().catch(() => null);
      if (next && !next.syncing) {
        setOptions(next);
        if (source === "local") search();
      }
    }, 3000);
    return () => clearInterval(t);
  }, [options.syncing, source, search]);

  async function startSync() {
    await browserApi.programs.sync();
    setOptions((o) => ({ ...o, syncing: true }));
  }

  const groups = useMemo(() => programGroupOptions(options.groups, filters.scoreType), [options.groups, filters.scoreType]);
  const myRank = filters.scoreType ? ranks[filters.scoreType] : undefined;
  const snapshot = options.snapshot;

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="md:w-96">
            <SegmentedControl<ProgramSource>
              label="Veri kaynağı"
              value={source}
              onChange={(v) => {
                setSource(v);
                setPage(0);
              }}
              options={[
                {
                  value: "local",
                  label: "İndirilmiş veri",
                  hint: snapshot ? `${formatDate(snapshot.syncedAt)}` : "Henüz indirilmedi",
                },
                { value: "live", label: "Canlı", hint: "YÖK Atlas'tan şimdi" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-2 text-sm text-text-muted md:items-end">
            {snapshot ? (
              <span>
                İndirilen: {snapshot.year} taban puanları · {snapshot.count.toLocaleString("tr-TR")} program
              </span>
            ) : (
              <span>İndirilmiş veri yok; canlı arama kullanılıyor.</span>
            )}
            {isAdmin && (
              <Button variant="secondary" size="sm" onClick={() => void startSync()} loading={options.syncing}>
                <RefreshCw className="size-4" aria-hidden /> {options.syncing ? "İndiriliyor…" : "Veriyi güncelle"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select<ResultScoreType>
            label="Puan türü"
            value={filters.scoreType}
            onChange={(v) => {
              setFilters((f) => ({ ...f, scoreType: v, groupIds: [] }));
              setPage(0);
            }}
            options={RESULT_SCORE_TYPES.map((t) => ({ value: t, label: `${RESULT_SCORE_LABELS[t]} (${RESULT_SCORE_CODES[t]})` }))}
          />
          <MultiSelect label="Program" options={groups} value={filters.groupIds} onChange={(v) => set("groupIds", v)} />
          <MultiSelect
            label="Üniversite"
            options={options.universities.map((u) => ({ value: u.id, label: u.name }))}
            value={filters.universityIds}
            onChange={(v) => set("universityIds", v)}
          />
          <MultiSelect
            label="Şehir"
            options={options.cities.map((c) => ({ value: c.code, label: c.name }))}
            value={filters.cityCodes}
            onChange={(v) => set("cityCodes", v)}
          />
          <Select
            label="Üniversite türü"
            value={filters.universityType}
            onChange={(v) => set("universityType", v)}
            options={UNIVERSITY_TYPES.map((t) => ({ value: t, label: UNIVERSITY_TYPE_LABELS[t] }))}
          />
          <Select
            label="Burs / ücret"
            value={filters.scholarshipId}
            onChange={(v) => set("scholarshipId", v)}
            options={SCHOLARSHIPS.map((s) => ({ value: s.id, label: s.label }))}
          />
          <Select
            label="Öğretim türü"
            value={filters.educationTypeId}
            onChange={(v) => set("educationTypeId", v)}
            options={EDUCATION_TYPES.map((s) => ({ value: s.id, label: s.label }))}
          />
          <Select
            label="Düzey"
            value={filters.level}
            onChange={(v) => set("level", v)}
            options={PROGRAM_LEVELS.map((l) => ({ value: l, label: PROGRAM_LEVEL_LABELS[l] }))}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 grid-cols-2 gap-4 sm:max-w-md">
            <RankInput label="Başarı sırası (en iyi)" value={filters.minRank} onChange={(v) => set("minRank", v)} />
            <RankInput label="Başarı sırası (en kötü)" value={filters.maxRank} onChange={(v) => set("maxRank", v)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {myRank && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFilters((f) => ({ ...f, ...nearRankRange(myRank) }));
                  setPage(0);
                }}
              >
                Sırama yakın olanlar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters({ ...EMPTY, scoreType: defaultType });
                setPage(0);
              }}
            >
              <RotateCcw className="size-4" aria-hidden /> Filtreleri sıfırla
            </Button>
          </div>
        </div>
        {myRank ? (
          <p className="text-xs text-text-subtle">
            {filters.scoreType && RESULT_SCORE_LABELS[filters.scoreType]} yerleştirme sıran {formatRank(myRank)}
            {resultYear ? ` (${resultYear} sonucun)` : ""}. Programlar, sonuç yılına en yakın yılın taban sırasıyla
            karşılaştırılır; tabloda o yıl vurgulanır. Karşılaştırma yalnızca fikir verir.
          </p>
        ) : filters.scoreType ? (
          <p className="text-xs text-text-subtle">Bu puan türünde kayıtlı yerleştirme sıran yok; karşılaştırma gösterilmez.</p>
        ) : null}
      </Card>

      <section className="flex flex-col gap-3" aria-labelledby="my-scores-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="my-scores-title" className="text-xl font-semibold tracking-tight">
            Puanların ve sıraların
          </h2>
          {resultYear && (
            <Link href="/tercih" className="text-sm font-medium text-primary hover:underline">
              {resultYear} YKS sonucun · düzenle
            </Link>
          )}
        </div>
        {scores.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {scores.map((s) => {
              const active = filters.scoreType === s.type;
              return (
                <button
                  key={s.type}
                  type="button"
                  aria-pressed={active}
                  title="Bu puan türüne göre süz"
                  onClick={() => {
                    setFilters((f) => ({ ...f, scoreType: s.type, groupIds: [] }));
                    setPage(0);
                  }}
                  className={cn(
                    "flex flex-col gap-1 rounded-lg border bg-surface p-4 text-left shadow-card transition-colors duration-fast",
                    active ? "border-primary ring-1 ring-primary" : "border-border hover:border-border-strong",
                  )}
                >
                  <span className="text-sm font-medium text-text-muted">
                    {RESULT_SCORE_LABELS[s.type]} <span className="font-normal">({placementCode(s.type)})</span>
                  </span>
                  <span className="text-2xl font-bold tabular-nums tracking-tight">{formatScore(s.placementScore!)}</span>
                  <span className="text-sm tabular-nums">
                    <span className="text-text-muted">Sıra </span>
                    <span className="font-semibold">{formatRank(s.placementRank!)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <Card className="flex flex-col items-start gap-2 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between">
            Puanını eklersen programlar senin sıranla karşılaştırılır.
            <Link href="/tercih" className="font-medium text-primary hover:underline">
              Sonucunu ekle
            </Link>
          </Card>
        )}
      </section>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-3 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="programs-title" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="programs-title" className="text-xl font-semibold tracking-tight">
            Programlar
          </h2>
          <span className="flex items-center gap-2 text-sm text-text-muted tabular-nums">
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {result &&
              (result.total
                ? `${(result.page * result.size + 1).toLocaleString("tr-TR")}–${Math.min(result.total, (result.page + 1) * result.size).toLocaleString("tr-TR")} / ${result.total.toLocaleString("tr-TR")}`
                : "Sonuç yok")}
          </span>
        </div>

        {result && result.items.length > 0 && (
          <Card className={cn("overflow-x-auto p-0 transition-opacity", loading && "opacity-60")}>
            <table className="w-full min-w-[54rem] text-sm">
              <thead className="text-left text-text-muted">
                <tr className="border-b border-border">
                  <th className="px-5 py-3 font-medium">Program</th>
                  <th className="px-3 py-3 text-right font-medium">Kontenjan</th>
                  <th className="px-3 py-3 text-right font-medium">Yıllara göre taban puan · başarı sırası</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Tercih listesi</span>
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {result.items.map((p) => {
                  const cmp = rankComparison(ranks[p.scoreType], p, resultYear);
                  const refYear = ranks[p.scoreType] ? comparisonYear(p, resultYear)?.year ?? null : null;
                  const inList = listCodes.includes(p.code);
                  return (
                    <tr key={p.code} className="border-b border-border align-top last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-text-muted">{p.universityName}</span>
                          <span className="text-xs text-text-subtle">
                            {programMetaLine(p)}
                          </span>
                          {cmp && (
                            <Badge tone={cmp.tone} className="self-start">
                              {cmp.label}
                              {cmp.year && ` (${cmp.year})`}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">{p.quota ?? "–"}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end">
                          <ProgramYears program={p} highlightYear={refYear} />
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant={inList ? "ghost" : "secondary"}
                          size="sm"
                          disabled={inList || (listCodes.length >= PREFERENCE_MAX && !inList)}
                          loading={adding === p.code}
                          onClick={() => void addToList(p.code)}
                          title={!inList && listCodes.length >= PREFERENCE_MAX ? `Listende en fazla ${PREFERENCE_MAX} program olabilir` : undefined}
                          className="whitespace-nowrap"
                        >
                          {inList ? <Check className="size-4" aria-hidden /> : <ListPlus className="size-4" aria-hidden />}
                          {inList ? "Listede" : "Listeme ekle"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        {result && result.total === 0 && !loading && (
          <Card className="py-10 text-center text-sm text-text-muted">Bu filtrelere uyan program yok.</Card>
        )}

        {result && result.total > PAGE_SIZE && (
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-4" aria-hidden /> Önceki
            </Button>
            <span className="text-sm text-text-muted tabular-nums">
              {page + 1} / {Math.ceil(result.total / PAGE_SIZE)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={(page + 1) * PAGE_SIZE >= result.total || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Sonraki <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
