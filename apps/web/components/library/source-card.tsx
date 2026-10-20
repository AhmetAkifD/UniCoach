import Link from "next/link";
import { CircleCheck, ListVideo, PlayCircle, TriangleAlert } from "lucide-react";
import type { SourceSummary } from "@unicoach/shared";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";

export function SourceCard({ source, color }: { source: SourceSummary; color: string }) {
  const done = source.itemCount > 0 && source.watchedCount === source.itemCount;
  const percent = source.itemCount ? (source.watchedCount / source.itemCount) * 100 : 0;
  const KindIcon = source.kind === "PLAYLIST" ? ListVideo : PlayCircle;

  return (
    <Link href={`/konular/${source.id}`} className="rounded-lg">
      <Card interactive className="flex h-full flex-col gap-3 overflow-hidden p-0">
        <div className="relative aspect-video bg-surface-muted">
          {source.thumbnailUrl && (
            // YouTube küçük resmi; next/image yapılandırması gerektirmemesi için düz img.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={source.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover" />
          )}
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-sm bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white">
            <KindIcon className="size-3.5" aria-hidden />
            {source.kind === "PLAYLIST" ? `${source.itemCount} video` : "Video"}
          </span>
          {done && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
              <CircleCheck className="size-3.5" aria-hidden /> Bitti
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
          <h3 className="line-clamp-2 font-semibold leading-snug">{source.title}</h3>
          {source.author && <p className="text-sm text-text-muted">{source.author}</p>}
          <div className="mt-auto flex flex-col gap-1 pt-1">
            <ProgressBar value={percent} color={color} label={`${source.title} ilerlemesi`} showValue={false} />
            <span className="flex items-center justify-between text-xs text-text-muted tabular-nums">
              {source.watchedCount}/{source.itemCount} izlendi
              {source.truncated && (
                <span className="inline-flex items-center gap-1 text-warning" title="YouTube en fazla 200 video veriyor">
                  <TriangleAlert className="size-3.5" aria-hidden /> İlk 200 video
                </span>
              )}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
