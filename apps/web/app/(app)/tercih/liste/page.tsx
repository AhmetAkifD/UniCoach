import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PreferenceList } from "@/components/tercih/preference-list";
import { authedApi } from "@/lib/session";

export const metadata = { title: "Tercih listem · YKS Tercih" };

export default async function PreferenceListPage() {
  const api = await authedApi();
  const [items, results] = await Promise.all([api.preferences.list(), api.results.list()]);
  const latest = results[0] ?? null;

  return (
    <div className="flex flex-col gap-8">
      <Link href="/tercih" className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> YKS Tercih
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Tercih listem</h1>
        <p className="text-text-muted">
          Programları öncelik sırana koy. Puanına ya da koşullarına uymayan programlar listede kalır, yalnızca uyarı
          görürsün.
          {latest &&
            ` ${latest.year} sonucun, her programın sonuç yılına en yakın yılının taban sırasıyla karşılaştırılır; o yıl vurgulanır.`}
        </p>
      </div>
      <PreferenceList initialItems={items} scores={latest?.scores ?? null} resultYear={latest?.year ?? null} />
    </div>
  );
}
