import Link from "next/link";
import { BookOpenText, Info, SearchX } from "lucide-react";
import { bookTopics, groupByTopic } from "@unicoach/shared";
import { LibraryFilters } from "@/components/library/library-filters";
import { BookCard } from "@/components/question-bank/book-card";
import { UploadBookButton } from "@/components/question-bank/upload-book-dialog";
import { Card } from "@/components/ui/card";
import { authedApi, requireUser } from "@/lib/session";
import { subjectColor } from "@/lib/subject-color";
import { subjectFilters } from "@/lib/subject-filters";

export const metadata = { title: "Soru Bankası" };

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<{ sinav?: string; ders?: string }>;
}) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  const books = await (await authedApi()).books.list();
  const { exam, ders, examOptions, dersOptions, groups } = subjectFilters(books, {
    basePath: "/soru-bankasi",
    track: user.examTrack,
    query,
  });
  const topics = bookTopics(books);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Soru Bankası</h1>
          <p className="text-text-muted">Kaynaklarını derslere ayrılmış şekilde görüntüle.</p>
        </div>
        {books.length > 0 && <UploadBookButton examTrack={user.examTrack} topics={topics} />}
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

      {books.length > 0 && <LibraryFilters exams={examOptions} dersler={dersOptions} exam={exam} ders={ders} />}

      {books.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <BookOpenText className="size-10 text-text-subtle" strokeWidth={1.75} aria-hidden />
          <p className="text-lg font-semibold">Soru bankan boş</p>
          <p className="max-w-md text-sm text-text-muted">
            Çözdüğün soru kitaplarının PDF'lerini yükle. Hepsi derslerine göre burada durur, kaldığın sayfadan açılır.
          </p>
          <div className="mt-2">
            <UploadBookButton examTrack={user.examTrack} topics={topics} label="İlk PDF'ini yükle" />
          </div>
        </Card>
      ) : groups.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-12 text-center">
          <SearchX className="size-9 text-text-subtle" strokeWidth={1.75} aria-hidden />
          <p className="font-semibold">Bu filtrede PDF yok</p>
          <Link href="/soru-bankasi" scroll={false} className="text-sm font-medium text-primary hover:underline">
            Filtreyi temizle
          </Link>
        </Card>
      ) : (
        groups.map(({ subject, items }) => {
          const color = subjectColor(subject.id);
          const topicGroups = groupByTopic(items);
          const showTopics = topicGroups.some(([topic]) => topic !== null);
          return (
            <section key={subject.id} aria-labelledby={`ders-${subject.id}`} className="flex flex-col gap-4">
              <h2 id={`ders-${subject.id}`} className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
                <span className="size-3 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                {subject.label}
                <span className="text-sm font-normal text-text-muted">{items.length}</span>
              </h2>
              {topicGroups.map(([topic, list]) => (
                <div key={topic ?? "konusuz"} className="flex flex-col gap-3">
                  {showTopics && (
                    <h3 className="text-sm font-medium text-text-muted">{topic ?? "Konu belirtilmemiş"}</h3>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {list.map((book) => (
                      <BookCard key={book.id} book={book} color={color} showTopic={!showTopics} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}
