import Link from "next/link";
import { Info, Library, SearchX } from "lucide-react";
import type { SourceSummary } from "@unicoach/shared";
import { AddSourceButton } from "@/components/library/add-source-dialog";
import { LibraryFilters } from "@/components/library/library-filters";
import { SourceCard } from "@/components/library/source-card";
import { Card } from "@/components/ui/card";
import { authedApi, requireUser } from "@/lib/session";
import { subjectColor } from "@/lib/subject-color";
import { subjectFilters } from "@/lib/subject-filters";

export const metadata = { title: "Konu Anlatımı" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ sinav?: string; ders?: string }>;
}) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  const sources: SourceSummary[] = await (await authedApi()).sources.list();
  const { exam, ders, examOptions, dersOptions, groups } = subjectFilters(sources, {
    basePath: "/konular",
    track: user.examTrack,
    query,
  });

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
        groups.map(({ subject, items: sources }) => {
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
