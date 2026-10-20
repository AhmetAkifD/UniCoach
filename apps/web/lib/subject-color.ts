import { subjectColors, type SubjectColorKey } from "@unicoach/design";
import { findSubject } from "@unicoach/shared";

/** Ders kimliğinden (ör. "ayt-fizik") ders rengini döndürür. */
export function subjectColor(subjectId: string): string {
  const key = findSubject(subjectId)?.color as SubjectColorKey | undefined;
  return (key && subjectColors[key]) ?? subjectColors.matematik;
}
