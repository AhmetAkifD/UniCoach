import { Info } from "lucide-react";
import { AddResult } from "@/components/tercih/add-result";
import { SavedResult } from "@/components/tercih/saved-result";
import { authedApi, requireUser } from "@/lib/session";

export const metadata = { title: "YKS Tercih" };

export default async function TercihPage() {
  const [user, results] = await Promise.all([requireUser(), authedApi().then((api) => api.results.list())]);
  const years = results.map((r) => r.year);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">YKS Tercih</h1>
        <p className="text-text-muted">
          Önce sınav sonucunu ekle. Tercih yaparken puanların ve başarı sıraların buradan kullanılacak.
        </p>
      </section>

      {user.examTrack === "LGS" && (
        <p className="flex items-start gap-2 rounded-md bg-info-soft px-3.5 py-3 text-sm text-info">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Tercih modülü YKS içindir. LGS'ye hazırlanıyorsan sınavını profilinden değiştirebilirsin.
        </p>
      )}

      {results.map((r) => (
        <SavedResult key={r.id} result={r} savedYears={years} />
      ))}

      <AddResult savedYears={years} accountName={`${user.firstName} ${user.lastName}`} />
    </div>
  );
}
