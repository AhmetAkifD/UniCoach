import Link from "next/link";
import { ClipboardList, Clock, Pause, Plus } from "lucide-react";
import { formatNet, type ExamSummary } from "@unicoach/shared";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatClock, formatDate } from "@/lib/exam-format";
import { authedApi } from "@/lib/session";

export const metadata = { title: "Sınavlar" };

export default async function ExamsPage() {
  const exams = await (await authedApi()).exams.list();
  const ongoing = exams.filter((e) => !e.finishedAt);
  const finished = exams.filter((e) => e.finishedAt);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Sınavlar</h1>
          <p className="text-text-muted">Soru Bankası'nda çıkardığın testlerle süreli deneme çöz, netini gör.</p>
        </div>
        {exams.length > 0 && (
          <Link href="/sinavlar/yeni" className={buttonClasses()}>
            <Plus className="size-5" aria-hidden /> Yeni sınav
          </Link>
        )}
      </section>

      {exams.length === 0 && (
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <ClipboardList className="size-10 text-text-subtle" strokeWidth={1.75} aria-hidden />
          <p className="text-lg font-semibold">Henüz sınav çözmedin</p>
          <p className="max-w-md text-sm text-text-muted">
            Soru Bankası'nda soruları çıkardığın bir PDF'ten test seç, süreyi belirle ve başla. Sonunda netini ve
            yanlışlarını görürsün.
          </p>
          <Link href="/sinavlar/yeni" className={buttonClasses({ className: "mt-2" })}>
            <Plus className="size-5" aria-hidden /> İlk sınavını başlat
          </Link>
        </Card>
      )}

      {ongoing.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="ongoing-title">
          <h2 id="ongoing-title" className="text-xl font-semibold tracking-tight">
            Devam eden
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ongoing.map((e) => (
              <Link key={e.id} href={`/sinavlar/${e.id}`} className="rounded-lg">
                <Card interactive className="flex h-full flex-col gap-3 border-primary/40">
                  <div className="flex items-center justify-between gap-2">
                    {e.pausedAt ? (
                      <Badge tone="warning">
                        <Pause className="size-3.5" aria-hidden /> Duraklatıldı
                      </Badge>
                    ) : (
                      <Badge tone="primary">
                        <Clock className="size-3.5" aria-hidden /> Devam ediyor
                      </Badge>
                    )}
                    <span className="text-xs text-text-muted">{formatDate(e.startedAt)}</span>
                  </div>
                  <h3 className="line-clamp-2 font-semibold leading-snug">{e.title}</h3>
                  <p className="text-sm text-text-muted">{e.bookTitle}</p>
                  <p className="mt-auto flex justify-between gap-2 text-sm tabular-nums text-text-muted">
                    <span>
                      {e.answeredCount}/{e.questionCount} cevaplandı
                    </span>
                    {/* Duraklatılmış sınavın kalan süresi donmuştur; işleyen sınavınki sayfa açıldığı anki değerdir. */}
                    {e.deadline && (
                      <span>
                        Kalan {formatClock(Date.parse(e.deadline) - (e.pausedAt ? Date.parse(e.pausedAt) : Date.now()))}
                      </span>
                    )}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section className="flex flex-col gap-4" aria-labelledby="finished-title">
          <h2 id="finished-title" className="text-xl font-semibold tracking-tight">
            Sonuçlar
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {finished.map((e) => (
              <ResultCard key={e.id} exam={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ResultCard({ exam }: { exam: ExamSummary }) {
  return (
    <Link href={`/sinavlar/${exam.id}`} className="rounded-lg">
      <Card interactive className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h3 className="line-clamp-2 font-semibold leading-snug">{exam.title}</h3>
            <p className="truncate text-sm text-text-muted">{exam.bookTitle}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="text-3xl font-bold tabular-nums tracking-tight">{formatNet(exam.net ?? 0)}</span>
            <span className="text-xs text-text-muted">net</span>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 text-sm tabular-nums">
          <span className="flex gap-3">
            <span className="text-success">{exam.correct} D</span>
            <span className="text-danger">{exam.wrong} Y</span>
            <span className="text-text-muted">{exam.blank} B</span>
          </span>
          <span className="text-xs text-text-muted">{formatDate(exam.finishedAt!)}</span>
        </div>
      </Card>
    </Link>
  );
}
