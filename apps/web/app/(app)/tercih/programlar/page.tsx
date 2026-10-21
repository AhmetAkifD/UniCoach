import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ResultScoreType } from "@unicoach/shared";
import { ProgramExplorer } from "@/components/tercih/program-explorer";
import { authedApi, requireUser } from "@/lib/session";

export const metadata = { title: "Programlar · YKS Tercih" };

export default async function ProgramsPage() {
  const user = await requireUser();
  const api = await authedApi();
  const [options, results] = await Promise.all([api.programs.filters(), api.results.list()]);
  // En yeni sonucun yerleştirme sıraları karşılaştırmada kullanılır.
  const latest = results[0] ?? null;
  const ranks: Partial<Record<ResultScoreType, number>> = {};
  for (const s of latest?.scores ?? []) if (s.placementRank) ranks[s.type] = s.placementRank;

  return (
    <div className="flex flex-col gap-8">
      <Link href="/tercih" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> YKS Tercih
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Programları keşfet</h1>
        <p className="text-text-muted">
          Taban puanlar ve başarı sıraları YÖK Atlas'tan. Programları puan türüne, şehre ve üniversiteye göre süz.
        </p>
      </div>
      <ProgramExplorer
        initialOptions={options}
        ranks={ranks}
        resultYear={latest?.year ?? null}
        isAdmin={user.role === "ADMIN"}
      />
    </div>
  );
}
