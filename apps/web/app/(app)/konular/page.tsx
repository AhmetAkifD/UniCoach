import Link from "next/link";
import { Info, Library, SearchX } from "lucide-react";
import { SUBJECTS, findSubject, type ExamTrack, type SourceSummary, type SubjectExam } from "@unicoach/shared";
import { AddSourceButton } from "@/components/library/add-source-dialog";
import { LibraryFilters, type FilterOption } from "@/components/library/library-filters";
import { SourceCard } from "@/components/library/source-card";
import { Card } from "@/components/ui/card";
import { authedApi, requireUser } from "@/lib/session";
import { subjectColor } from "@/lib/subject-color";

export const metadata = { title: "Konu Anlatımı" };

/** İlk filtre satırı. YDT yalnızca o sınava ait kaynak varsa gösterilir. */
const EXAM_CHIPS: SubjectExam[] = ["TYT", "AYT", "YDT", "LGS"];

/** Dersler: önce öğrencinin sınavı, sonra diğeri; her grupta sabit ders sırası. */
function orderedSubjects(track: ExamTrack | null) {
  const first = track ?? "YKS";
  return [...SUBJECTS.filter((s) => s.track === first), ...SUBJECTS.filter((s) => s.track !== first)];
}

function href(exam: SubjectExam | null, ders: string | null) {
  const params = new URLSearchParams();
  if (exam) params.set("sinav", exam.toLowerCase());
  if (ders) params.set("ders", ders);
  const query = params.toString();
  return query ? `/konular?${query}` : "/konular";
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ sinav?: string; ders?: string }>;
}) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  const sources: SourceSummary[] = await (await authedApi()).sources.list();
  const subjects = orderedSubjects(user.examTrack);
  const subjectOf = (s: SourceSummary) => findSubject(s.subject);

  // 1. satır: sınav
  const exam = EXAM_CHIPS.find((e) => e.toLowerCase() === query.sinav) ?? null;
  const inExam = exam ? sources.filter((s) => subjectOf(s)?.exam === exam) : sources;

  // 2. satır: yalnızca seçili sınavda kaynağı olan dersler
  const dersOrder = [...new Map(subjects.map((s) => [s.ders, s.dersLabel])).entries()];
  const dersCounts = new Map<string, number>();
  for (const s of inExam) {
    const key = subjectOf(s)?.ders;
    if (key) dersCounts.set(key, (dersCounts.get(key) ?? 0) + 1);
  }
  const ders = query.ders && dersCounts.has(query.ders) ? query.ders : null;
  const visible = ders ? inExam.filter((s) => subjectOf(s)?.ders === ders) : inExam;

  const examOptions: FilterOption[] = [
    { value: null, label: "Tümü", count: sources.length, href: href(null, ders) },
    ...EXAM_CHIPS.flatMap((e) => {
      const inThis = sources.filter((s) => subjectOf(s)?.exam === e);
      if (e === "YDT" && inThis.length === 0 && exam !== "YDT") return [];
      // Sınav değişince ders, yeni sınavda da varsa korunur.
      const keepDers = ders && inThis.some((s) => subjectOf(s)?.ders === ders) ? ders : null;
      return [{ value: e.toLowerCase(), label: e, count: inThis.length, href: href(e, keepDers) }];
    }),
  ];
  const dersOptions: FilterOption[] = [
    { value: null, label: "Tümü", count: inExam.length, href: href(exam, null) },
    ...dersOrder
      .filter(([key]) => dersCounts.has(key))
      .map(([key, label]) => ({ value: key, label, count: dersCounts.get(key)!, href: href(exam, key) })),
  ];

  const groups = subjects
    .map((subject) => ({ subject, sources: visible.filter((s) => s.subject === subject.id) }))
    .filter((g) => g.sources.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Konu Anlatımı</h1>
          <p className="text-text-muted">Takip ettiğin YouTube videoları ve oynatma listeleri, derslerine göre.</p>
        </div>
        {sources.length > 0 && <AddSourceButton examTrack={user.examTrack} />}
      </section>

      {!user.examTrack && (
        <div className="flex items-start gap-2 rounded-md bg-info-soft px-3.5 py-3 text-sm text-info">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Hangi sınava hazırlandığını henüz seçmedin.{" "}
            <Link href="/profil" className="font-medium underline underline-offset-2">
              Profilinden seç
            </Link>{" "}
            ki dersler ona göre sıralansın.
          </span>
        </div>
      )}

      {sources.length > 0 && (
        <LibraryFilters exams={examOptions} dersler={dersOptions} exam={exam} ders={ders} />
      )}

      {sources.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <Library className="size-10 text-text-subtle" strokeWidth={1.75} aria-hidden />
          <p className="text-lg font-semibold">Kütüphanen boş</p>
          <p className="max-w-md text-sm text-text-muted">
            Çalıştığın hocanın YouTube oynatma listesini ya da tek bir videoyu ekle. Nerede kaldığını biz hatırlarız.
          </p>
          <div className="mt-2">
            <AddSourceButton examTrack={user.examTrack} label="İlk kaynağını ekle" />
          </div>
        </Card>
      ) : groups.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <SearchX className="size-9 text-text-subtle" strokeWidth={1.75} aria-hidden />
          <p className="font-semibold">Bu filtrede kaynak yok</p>
          <Link href="/konular" scroll={false} className="text-sm font-medium text-primary hover:underline">
            Filtreyi temizle
          </Link>
        </Card>
      ) : (
        groups.map(({ subject, sources }) => {
          const color = subjectColor(subject.id);
          return (
            <section key={subject.id} aria-labelledby={`ders-${subject.id}`} className="flex flex-col gap-4">
              <h2 id={`ders-${subject.id}`} className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
                <span className="size-3 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                {subject.label}
                <span className="text-sm font-normal text-text-muted">{sources.length}</span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sources.map((source) => (
                  <SourceCard key={source.id} source={source} color={color} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
