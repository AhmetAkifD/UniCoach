import Link from "next/link";
import { ArrowRight, BookOpenCheck, PlayCircle } from "lucide-react";
import { findSubject, libraryProgress, type SourceSummary } from "@unicoach/shared";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { subjectColor } from "@/lib/subject-color";

/** Kartta gösterilen en fazla ders sayısı (gerisi Konu Anlatımı sayfasında) */
const SUBJECTS_SHOWN = 6;

/**
 * Ana sayfadaki "Konu ilerlemen" kartı: Konu Anlatımı'ndaki bütün videolardan izlenen oranı, en son çalışılan
 * kaynağa "Kaldığın yerden devam et" bağlantısı ve derslere göre ilerleme. Hesap `libraryProgress`te (mobil de kullanır).
 */
export function TopicProgressCard({ sources }: { sources: SourceSummary[] | null }) {
  const progress = sources ? libraryProgress(sources) : null;

  if (!progress || !progress.total) {
    return (
      <Card className="flex flex-col gap-4 lg:col-span-2">
        <h2 className="text-lg font-semibold">Konu ilerlemen</h2>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <BookOpenCheck className="size-8 text-text-subtle" strokeWidth={1.75} aria-hidden />
          <p className="font-medium">{sources ? "Henüz video eklemedin" : "İlerlemen yüklenemedi"}</p>
          <p className="max-w-sm text-sm text-text-muted">
            {sources
              ? "Konu Anlatımı'na YouTube videolarını ya da oynatma listelerini ekle; izledikçe ilerlemen burada görünecek."
              : "Sayfayı yenileyip tekrar dene."}
          </p>
          {sources && (
            <Link href="/konular" className={buttonClasses({ variant: "secondary", className: "mt-2" })}>
              Konu Anlatımı'na git <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </Card>
    );
  }

  const { resume } = progress;
  const shown = progress.subjects.slice(0, SUBJECTS_SHOWN);
  return (
    <Card className="flex flex-col gap-5 lg:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Konu ilerlemen</h2>
          <p className="text-sm text-text-muted tabular-nums">
            {progress.watched} / {progress.total} video izlendi
          </p>
        </div>
        <span className="text-3xl font-bold tracking-tight tabular-nums">%{progress.percent}</span>
      </div>

      {resume && (
        <Link
          href={`/konular/${resume.id}`}
          className="group flex items-center gap-4 rounded-md border border-border p-3 transition-colors duration-fast hover:bg-surface-muted"
        >
          <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-sm bg-surface-muted">
            {resume.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resume.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover" />
            )}
            <PlayCircle className="absolute inset-0 m-auto size-8 text-white drop-shadow" aria-hidden />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium text-primary">Kaldığın yerden devam et</span>
            <span className="line-clamp-1 font-medium">{resume.title}</span>
            <span className="text-xs text-text-muted tabular-nums">
              {findSubject(resume.subject)?.label ?? resume.subject} · {resume.watchedCount}/{resume.itemCount} izlendi
            </span>
          </div>
          <ArrowRight className="size-5 shrink-0 text-text-subtle transition-transform duration-fast group-hover:translate-x-0.5" aria-hidden />
        </Link>
      )}

      <ul className="flex flex-col gap-3" aria-label="Derslere göre ilerleme">
        {shown.map((s) => (
          <li key={s.subject} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: subjectColor(s.subject) }} aria-hidden />
              <span className="truncate">{s.label}</span>
            </span>
            <ProgressBar value={s.percent} color={subjectColor(s.subject)} label={`${s.label} ilerlemesi`} showValue={false} />
            <span className="w-16 text-right text-text-muted tabular-nums">
              {s.watched}/{s.total}
            </span>
          </li>
        ))}
      </ul>

      <Link href="/konular" className="mt-auto self-start text-sm font-medium text-primary hover:underline">
        {progress.subjects.length > shown.length ? `Tüm dersler (${progress.subjects.length})` : "Konu Anlatımı'na git"}
      </Link>
    </Card>
  );
}
