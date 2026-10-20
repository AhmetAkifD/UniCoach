import Link from "next/link";
import { FileText } from "lucide-react";
import { formatBytes, type BookSummary } from "@unicoach/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";

export function BookCard({ book, color, showTopic = true }: { book: BookSummary; color: string; showTopic?: boolean }) {
  const percent = book.pageCount ? (book.lastPage / book.pageCount) * 100 : 0;

  return (
    <Link href={`/soru-bankasi/${book.id}`} className="rounded-lg">
      <Card interactive className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
            aria-hidden
          >
            <FileText className="size-5.5" strokeWidth={1.75} />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h3 className="line-clamp-2 font-semibold leading-snug">{book.title}</h3>
            {showTopic && book.topic && (
              <Badge className="self-start" title="Konu">
                {book.topic}
              </Badge>
            )}
          </div>
        </div>
        <div className="mt-auto flex flex-col gap-1 pt-1">
          <ProgressBar value={percent} color={color} label={`${book.title} ilerlemesi`} showValue={false} />
          <span className="flex items-center justify-between text-xs text-text-muted tabular-nums">
            <span>{book.pageCount ? `Sayfa ${book.lastPage}/${book.pageCount}` : "Henüz açılmadı"}</span>
            <span>{formatBytes(book.sizeBytes)}</span>
          </span>
        </div>
      </Card>
    </Link>
  );
}
