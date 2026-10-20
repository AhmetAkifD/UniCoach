import { notFound } from "next/navigation";
import { ApiError, type SourceDetail } from "@unicoach/shared";
import { SourcePlayer } from "@/components/library/source-player";
import { authedApi, requireUser } from "@/lib/session";
import { subjectColor } from "@/lib/subject-color";

export default async function SourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  let source: SourceDetail;
  try {
    source = await (await authedApi()).sources.get(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  return <SourcePlayer source={source} examTrack={user.examTrack} color={subjectColor(source.subject)} />;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const source = await (await authedApi()).sources.get(id);
    return { title: source.title };
  } catch {
    return { title: "Konu Anlatımı" };
  }
}
