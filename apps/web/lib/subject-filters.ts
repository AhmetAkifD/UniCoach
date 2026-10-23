import { parseSubjectExam, subjectFilters as filter, type ExamTrack, type SubjectFilter } from "@unicoach/shared";
import type { FilterOption } from "@/components/library/library-filters";

/**
 * Konu Anlatımı ve Soru Bankası'nın ortak filtresi (?sinav=…&ders=…). Hesap packages/shared'dadır (mobil de
 * kullanır); burada her seçeneğe bağlantısı eklenir.
 */
export function subjectFilters<T extends { subject: string }>(
  items: T[],
  {
    basePath,
    track,
    query,
  }: { basePath: string; track: ExamTrack | null; query: { sinav?: string; ders?: string } },
) {
  const href = ({ exam, ders }: SubjectFilter) => {
    const params = new URLSearchParams();
    if (exam) params.set("sinav", exam.toLowerCase());
    if (ders) params.set("ders", ders);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const result = filter(items, { track, exam: parseSubjectExam(query.sinav), ders: query.ders ?? null });
  const withHref = (options: typeof result.examOptions): FilterOption[] =>
    options.map(({ target, ...o }) => ({ ...o, href: href(target) }));
  return { ...result, examOptions: withHref(result.examOptions), dersOptions: withHref(result.dersOptions) };
}
