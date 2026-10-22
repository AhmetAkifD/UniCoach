import { Workspace } from "@/components/workspace/workspace";
import { authedApi } from "@/lib/session";

export const metadata = { title: "Çalışma Alanı" };

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ video?: string; pdf?: string; defter?: string }>;
}) {
  const api = await authedApi();
  const [{ video, pdf, defter }, sources, books, notebooks] = await Promise.all([
    searchParams,
    api.sources.list(),
    api.books.list(),
    api.notebooks.list(),
  ]);

  return (
    <Workspace
      sources={sources}
      books={books}
      notebooks={notebooks}
      initial={{
        video: sources.some((s) => s.id === video) ? video! : null,
        pdf: books.some((b) => b.id === pdf) ? pdf! : null,
        notebook: notebooks.some((n) => n.id === defter) ? defter! : null,
      }}
    />
  );
}
