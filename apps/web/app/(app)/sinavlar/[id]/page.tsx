import { notFound } from "next/navigation";
import { ApiError, type ExamDetail } from "@unicoach/shared";
import { ExamResult } from "@/components/exams/exam-result";
import { ExamRunner } from "@/components/exams/exam-runner";
import { authedApi } from "@/lib/session";

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let exam: ExamDetail;
  try {
    exam = await (await authedApi()).exams.get(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  // Bitmemiş sınav çözülür; bitince (süre dolunca da) aynı adreste sonuç gösterilir.
  return exam.finishedAt ? <ExamResult exam={exam} /> : <ExamRunner key={exam.id} exam={exam} />;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const exam = await (await authedApi()).exams.get(id);
    return { title: exam.finishedAt ? `Sonuç · ${exam.title}` : exam.title };
  } catch {
    return { title: "Sınav" };
  }
}
