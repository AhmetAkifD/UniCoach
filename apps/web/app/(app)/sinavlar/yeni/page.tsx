import Link from "next/link";
import { ArrowLeft, BookOpenText } from "lucide-react";
import { NewExamForm } from "@/components/exams/new-exam-form";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authedApi, requireUser } from "@/lib/session";

export const metadata = { title: "Yeni sınav" };

export default async function NewExamPage({ searchParams }: { searchParams: Promise<{ pdf?: string }> }) {
  const [user, { pdf }] = await Promise.all([requireUser(), searchParams]);
  const books = (await (await authedApi()).books.list()).filter((b) => b.questionCount > 0);

  return (
    <div className="flex flex-col gap-8">
      <Link href="/sinavlar" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Geçmiş Sınavlar
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Yeni sınav</h1>
        <p className="text-text-muted">Soru Bankası'nda çıkardığın testlerden süreli bir deneme kur.</p>
      </div>
      {books.length ? (
        <NewExamForm books={books} initialBookId={pdf} examTrack={user.examTrack} />
      ) : (
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <BookOpenText className="size-10 text-text-subtle" strokeWidth={1.75} aria-hidden />
          <p className="text-lg font-semibold">Önce soruları çıkar</p>
          <p className="max-w-md text-sm text-text-muted">
            Sınav, Soru Bankası'ndaki PDF'lerden çıkardığın sorularla kurulur. Bir PDF aç ve "Soruları çıkar"a gir.
          </p>
          <Link href="/soru-bankasi" className={buttonClasses({ variant: "secondary" })}>
            Soru Bankası'na git
          </Link>
        </Card>
      )}
    </div>
  );
}
