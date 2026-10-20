import { notFound } from "next/navigation";
import { ApiError, type BookSummary } from "@unicoach/shared";
import { BookViewer } from "@/components/question-bank/book-viewer";
import { authedApi, requireUser } from "@/lib/session";
import { subjectColor } from "@/lib/subject-color";

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const api = await authedApi();
  let book: BookSummary;
  let books: BookSummary[];
  try {
    [book, books] = await Promise.all([api.books.get(id), api.books.list()]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const topics = [...new Set(books.flatMap((b) => (b.topic ? [b.topic] : [])))].sort((a, b) => a.localeCompare(b, "tr"));
  return <BookViewer book={book} examTrack={user.examTrack} color={subjectColor(book.subject)} topics={topics} />;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return { title: (await (await authedApi()).books.get(id)).title };
  } catch {
    return { title: "Soru Bankası" };
  }
}
