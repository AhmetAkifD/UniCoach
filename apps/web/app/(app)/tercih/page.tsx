import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DeleteResultButton } from "@/components/tercih/delete-result-button";
import { ResultImport } from "@/components/tercih/result-import";
import { ResultSummary } from "@/components/tercih/result-summary";
import { formatDate } from "@/lib/exam-format";
import { authedApi, requireUser } from "@/lib/session";

export const metadata = { title: "YKS Tercih" };

export default async function TercihPage() {
  const [user, results] = await Promise.all([requireUser(), authedApi().then((api) => api.results.list())]);

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
        <section key={r.id} className="flex flex-col gap-4" aria-labelledby={`result-${r.year}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id={`result-${r.year}`} className="text-xl font-semibold tracking-tight">
                {r.year} YKS sonucun
              </h2>
              <Badge tone={r.source === "document" ? "success" : "neutral"}>
                {r.source === "document" ? "Belgeden okundu" : "Elle girildi"}
              </Badge>
              <span className="text-xs text-text-muted">Güncellendi: {formatDate(r.updatedAt)}</span>
            </div>
            <DeleteResultButton year={r.year} />
          </div>
          <ResultSummary result={r} />
        </section>
      ))}

      <ResultImport
        savedYears={results.map((r) => r.year)}
        accountName={`${user.firstName} ${user.lastName}`}
      />
    </div>
  );
}
