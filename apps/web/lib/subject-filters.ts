import { SUBJECTS, findSubject, type ExamTrack, type Subject, type SubjectExam } from "@unicoach/shared";
import type { FilterOption } from "@/components/library/library-filters";

/** İlk filtre satırı. YDT yalnızca o sınava ait öğe varsa gösterilir. */
const EXAM_CHIPS: SubjectExam[] = ["TYT", "AYT", "YDT", "LGS"];

/** Dersler: önce öğrencinin sınavı, sonra diğeri; her grupta sabit ders sırası. */
function orderedSubjects(track: ExamTrack | null) {
  const first = track ?? "YKS";
  return [...SUBJECTS.filter((s) => s.track === first), ...SUBJECTS.filter((s) => s.track !== first)];
}

/**
 * Konu Anlatımı ve Soru Bankası'nın ortak filtresi (?sinav=…&ders=…): sınav ve ders çiplerini,
 * görünür öğeleri ve ders gruplarını hesaplar. Yalnızca öğesi olan dersler çip olarak gösterilir.
 */
export function subjectFilters<T extends { subject: string }>(
  items: T[],
  {
    basePath,
    track,
    query,
  }: { basePath: string; track: ExamTrack | null; query: { sinav?: string; ders?: string } },
) {
  const subjects = orderedSubjects(track);
  const subjectOf = (item: T) => findSubject(item.subject);
  const href = (exam: SubjectExam | null, ders: string | null) => {
    const params = new URLSearchParams();
    if (exam) params.set("sinav", exam.toLowerCase());
    if (ders) params.set("ders", ders);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // 1. satır: sınav
  const exam = EXAM_CHIPS.find((e) => e.toLowerCase() === query.sinav) ?? null;
  const inExam = exam ? items.filter((i) => subjectOf(i)?.exam === exam) : items;

  // 2. satır: yalnızca seçili sınavda öğesi olan dersler
  const dersOrder = [...new Map(subjects.map((s) => [s.ders, s.dersLabel])).entries()];
  const dersCounts = new Map<string, number>();
  for (const i of inExam) {
    const key = subjectOf(i)?.ders;
    if (key) dersCounts.set(key, (dersCounts.get(key) ?? 0) + 1);
  }
  const ders = query.ders && dersCounts.has(query.ders) ? query.ders : null;
  const visible = ders ? inExam.filter((i) => subjectOf(i)?.ders === ders) : inExam;

  const examOptions: FilterOption[] = [
    { value: null, label: "Tümü", count: items.length, href: href(null, ders) },
    ...EXAM_CHIPS.flatMap((e) => {
      const inThis = items.filter((i) => subjectOf(i)?.exam === e);
      if (e === "YDT" && inThis.length === 0 && exam !== "YDT") return [];
      // Sınav değişince ders, yeni sınavda da varsa korunur.
      const keepDers = ders && inThis.some((i) => subjectOf(i)?.ders === ders) ? ders : null;
      return [{ value: e.toLowerCase(), label: e, count: inThis.length, href: href(e, keepDers) }];
    }),
  ];
  const dersOptions: FilterOption[] = [
    { value: null, label: "Tümü", count: inExam.length, href: href(exam, null) },
    ...dersOrder
      .filter(([key]) => dersCounts.has(key))
      .map(([key, label]) => ({ value: key, label, count: dersCounts.get(key)!, href: href(exam, key) })),
  ];

  const groups: { subject: Subject; items: T[] }[] = subjects
    .map((subject) => ({ subject, items: visible.filter((i) => i.subject === subject.id) }))
    .filter((g) => g.items.length > 0);

  return { exam, ders, examOptions, dersOptions, groups };
}
