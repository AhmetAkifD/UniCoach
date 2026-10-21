import { notFound } from "next/navigation";
import { ApiError, type BookQuestion, type BookSummary } from "@unicoach/shared";
import { QuestionEditor } from "@/components/question-bank/question-editor";
import { authedApi } from "@/lib/session";

export const metadata = { title: "Soruları çıkar" };

export default async function QuestionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ soru?: string; sinav?: string }>;
}) {
  const [{ id }, { soru, sinav }] = await Promise.all([params, searchParams]);
  const api = await authedApi();
  let book: BookSummary;
  let questions: BookQuestion[];
  try {
    [book, questions] = await Promise.all([api.books.get(id), api.books.questions(id)]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  return <QuestionEditor book={book} initial={questions} focusId={soru} examId={sinav} />;
}
