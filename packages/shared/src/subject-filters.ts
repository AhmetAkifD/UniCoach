import { SUBJECTS, findSubject, type ExamTrack, type Subject, type SubjectExam } from "./library";

/** İlk filtre satırı. YDT yalnızca o sınava ait öğe varsa gösterilir. */
const EXAM_CHIPS: SubjectExam[] = ["TYT", "AYT", "YDT", "LGS"];

/** Seçili filtre: sınav ve ders anahtarı (null = "Tümü"). */
export interface SubjectFilter {
  exam: SubjectExam | null;
  ders: string | null;
}

export interface SubjectFilterOption {
  /** null = "Tümü"; sınavda küçük harfli kod ("tyt"), derste ders anahtarı ("fizik") */
  value: string | null;
  label: string;
  count: number;
  /** Bu seçeneğe dokununca geçerli olacak filtre (web adrese, mobil state'e yazar). */
  target: SubjectFilter;
}

/** Dersler: önce öğrencinin sınavı, sonra diğeri; her grupta sabit ders sırası. */
function orderedSubjects(track: ExamTrack | null) {
  const first = track ?? "YKS";
  return [...SUBJECTS.filter((s) => s.track === first), ...SUBJECTS.filter((s) => s.track !== first)];
}

/** Adresteki `?sinav=tyt` değerini sınava çevirir. */
export function parseSubjectExam(value: string | null | undefined): SubjectExam | null {
  return EXAM_CHIPS.find((e) => e.toLowerCase() === value) ?? null;
}

/**
 * Konu Anlatımı ve Soru Bankası'nın ortak filtresi: 1. satır sınav, 2. satır ders. Sınav ve ders seçeneklerini,
 * görünür öğeleri ve ders gruplarını hesaplar. Yalnızca öğesi olan dersler seçenek olarak gösterilir.
 */
export function subjectFilters<T extends { subject: string }>(
  items: T[],
  { track, exam: examQuery, ders: dersQuery }: { track: ExamTrack | null; exam: SubjectExam | null; ders: string | null },
) {
  const subjects = orderedSubjects(track);
  const subjectOf = (item: T) => findSubject(item.subject);

  // 1. satır: sınav
  const exam = examQuery;
  const inExam = exam ? items.filter((i) => subjectOf(i)?.exam === exam) : items;

  // 2. satır: yalnızca seçili sınavda öğesi olan dersler
  const dersOrder = [...new Map(subjects.map((s) => [s.ders, s.dersLabel])).entries()];
  const dersCounts = new Map<string, number>();
  for (const i of inExam) {
    const key = subjectOf(i)?.ders;
    if (key) dersCounts.set(key, (dersCounts.get(key) ?? 0) + 1);
  }
  const ders = dersQuery && dersCounts.has(dersQuery) ? dersQuery : null;
  const visible = ders ? inExam.filter((i) => subjectOf(i)?.ders === ders) : inExam;

  const examOptions: SubjectFilterOption[] = [
    { value: null, label: "Tümü", count: items.length, target: { exam: null, ders } },
    ...EXAM_CHIPS.flatMap((e) => {
      const inThis = items.filter((i) => subjectOf(i)?.exam === e);
      if (e === "YDT" && inThis.length === 0 && exam !== "YDT") return [];
      // Sınav değişince ders, yeni sınavda da varsa korunur.
      const keepDers = ders && inThis.some((i) => subjectOf(i)?.ders === ders) ? ders : null;
      return [{ value: e.toLowerCase(), label: e, count: inThis.length, target: { exam: e, ders: keepDers } }];
    }),
  ];
  const dersOptions: SubjectFilterOption[] = [
    { value: null, label: "Tümü", count: inExam.length, target: { exam, ders: null } },
    ...dersOrder
      .filter(([key]) => dersCounts.has(key))
      .map(([key, label]) => ({ value: key, label, count: dersCounts.get(key)!, target: { exam, ders: key } })),
  ];

  const groups: { subject: Subject; items: T[] }[] = subjects
    .map((subject) => ({ subject, items: visible.filter((i) => i.subject === subject.id) }))
    .filter((g) => g.items.length > 0);

  return { exam, ders, examOptions, dersOptions, groups };
}
