"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CircleCheck, NotebookPen, Pencil, Play, Trash2, TriangleAlert, X } from "lucide-react";
import { ApiError, PLAYLIST_MAX_ITEMS, findSubject, type ExamTrack, type SourceDetail } from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDialog } from "@/components/ui/use-dialog";
import { ProgressBar } from "@/components/ui/progress-bar";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/youtube";
import { SubjectSelect } from "./subject-select";
import { useSourcePlayer } from "./use-source-player";

export function SourcePlayer({
  source,
  examTrack,
  color,
}: {
  source: SourceDetail;
  examTrack: ExamTrack | null;
  color: string;
}) {
  const router = useRouter();
  const { items, current, playIndex, save, playerRef, error, setError, stage } = useSourcePlayer(source);

  // Çalan video listede görünür kalsın. scrollIntoView sayfayı da kaydırdığı için yalnızca liste kutusu kaydırılır.
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const row = document.getElementById(`item-${items[current]?.id}`);
    if (!list || !row) return;
    const visible = row.offsetTop >= list.scrollTop && row.offsetTop + row.offsetHeight <= list.scrollTop + list.clientHeight;
    if (!visible) list.scrollTop = row.offsetTop - list.clientHeight / 3;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const watchedCount = items.filter((it) => it.watchedAt).length;
  const currentItem = items[current];
  const nextItem = items[current + 1];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/konular" className="inline-flex items-center gap-1.5 self-start text-sm text-text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden /> Konu Anlatımı
      </Link>

      <SourceHeader
        source={source}
        examTrack={examTrack}
        color={color}
        watched={watchedCount}
        total={items.length}
        onChanged={() => router.refresh()}
        onDeleted={() => {
          router.push("/konular");
          router.refresh();
        }}
      />

      {source.truncated && (
        <div className="flex items-start gap-2 rounded-md bg-warning-soft px-3.5 py-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          YouTube oynatma listelerinin yalnızca ilk {PLAYLIST_MAX_ITEMS} videosunu veriyor; listenin devamı burada
          görünmeyebilir.
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-3 text-sm text-danger">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError(undefined)} aria-label="Kapat">
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-3">
          {stage}
          {currentItem && (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-sm text-text-muted tabular-nums">
                  {current + 1}. video / {items.length}
                </span>
                <h2 className="text-lg font-semibold leading-snug">{currentItem.title}</h2>
                {nextItem && <p className="text-sm text-text-muted">Sıradaki: {nextItem.title}</p>}
              </div>
              <Button
                variant={currentItem.watchedAt ? "secondary" : "ghost"}
                size="sm"
                onClick={() =>
                  void save(currentItem, {
                    positionSec: Math.floor(playerRef.current?.getCurrentTime() ?? currentItem.positionSec),
                    watched: !currentItem.watchedAt,
                  })
                }
              >
                <CircleCheck className="size-4" aria-hidden />
                {currentItem.watchedAt ? "İzlendi" : "İzlendi olarak işaretle"}
              </Button>
            </div>
          )}
        </div>

        <Card className="flex max-h-[70vh] flex-col overflow-hidden p-0 lg:max-h-[calc(100vh-10rem)]">
          <div className="border-b border-border px-4 py-3 text-sm font-medium">
            Videolar <span className="text-text-muted tabular-nums">· {watchedCount}/{items.length} izlendi</span>
          </div>
          <ol ref={listRef} className="relative flex-1 overflow-y-auto p-1.5">
            {items.map((item, index) => {
              const active = index === current;
              return (
                <li
                  key={item.id}
                  id={`item-${item.id}`}
                  className={cn(
                    "group flex items-center gap-2 rounded-md pr-1.5 transition-colors duration-fast",
                    active ? "bg-primary-soft" : "hover:bg-surface-muted",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => playIndex(index)}
                    aria-current={active ? "true" : undefined}
                    className="flex min-w-0 flex-1 items-start gap-3 px-2.5 py-2 text-left"
                  >
                    <span
                      className={cn(
                        "mt-0.5 w-7 shrink-0 text-right text-xs tabular-nums",
                        active ? "text-primary-soft-text" : "text-text-subtle",
                      )}
                    >
                      {active ? <Play className="ml-auto size-3.5" aria-label="Çalıyor" /> : index + 1}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span
                        className={cn(
                          "line-clamp-2 text-sm leading-snug",
                          active ? "font-medium text-primary-soft-text" : item.watchedAt ? "text-text-muted" : "text-text",
                        )}
                      >
                        {item.title}
                      </span>
                      {(item.durationSec || item.positionSec > 0) && (
                        <span className="text-xs text-text-subtle tabular-nums">
                          {!item.watchedAt && item.positionSec > 0 && item.durationSec
                            ? `${formatDuration(item.positionSec)} / ${formatDuration(item.durationSec)}`
                            : item.durationSec
                              ? formatDuration(item.durationSec)
                              : null}
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void save(item, { positionSec: item.positionSec, watched: !item.watchedAt })}
                    aria-label={item.watchedAt ? `${index + 1}. videonun izlendi işaretini kaldır` : `${index + 1}. videoyu izlendi işaretle`}
                    aria-pressed={!!item.watchedAt}
                    title={item.watchedAt ? "İzlendi işaretini kaldır" : "İzlendi işaretle"}
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors duration-fast",
                      item.watchedAt
                        ? "border-success bg-success text-on-primary"
                        : "border-border-strong text-transparent hover:text-text-subtle",
                    )}
                  >
                    <Check className="size-4" strokeWidth={2.5} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>
    </div>
  );
}

function SourceHeader({
  source,
  examTrack,
  color,
  watched,
  total,
  onChanged,
  onDeleted,
}: {
  source: SourceDetail;
  examTrack: ExamTrack | null;
  color: string;
  watched: number;
  total: number;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(source.title);
  const [subject, setSubject] = useState(source.subject);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useDialog();

  function run(action: () => Promise<unknown>, after: () => void) {
    setError(undefined);
    startTransition(async () => {
      try {
        await action();
        after();
      } catch (err) {
        setError(err instanceof ApiError ? (err.errors?.title ?? err.message) : "Kaydedilemedi.");
      }
    });
  }

  return (
    <header className="flex flex-col gap-4">
      {dialog}
      {editing ? (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => browserApi.sources.update(source.id, { title }), () => {
              setEditing(false);
              onChanged();
            });
          }}
        >
          <div className="flex-1">
            <Input
              placeholder="Grup adı"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={error}
              autoFocus
              maxLength={120}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={pending}>
              Kaydet
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setTitle(source.title);
                setEditing(false);
                setError(undefined);
              }}
            >
              Vazgeç
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-2">
          <h1 className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">{source.title}</h1>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Grup adını değiştir"
            title="Grup adını değiştir"
            className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text"
          >
            <Pencil className="size-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          {findSubject(source.subject)?.label ?? source.subject}
        </span>
        {source.author && <span>{source.author}</span>}
        <span className="tabular-nums">
          {watched}/{total} video izlendi
        </span>
        <Link
          href={`/calisma-alani?video=${source.id}`}
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          <NotebookPen className="size-4" aria-hidden /> Çalışma alanında aç
        </Link>
      </div>
      <ProgressBar value={total ? (watched / total) * 100 : 0} color={color} label="Kaynak ilerlemesi" />

      <details className="group text-sm">
        <summary className="cursor-pointer select-none text-text-muted hover:text-text">Ayarlar</summary>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex-1">
            <SubjectSelect
              value={subject}
              examTrack={examTrack}
              disabled={pending}
              onChange={(next) => {
                setSubject(next);
                run(() => browserApi.sources.update(source.id, { subject: next }), onChanged);
              }}
            />
          </div>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              void confirm({
                title: "Kaynağı sil",
                message: "Bu kaynak ve izleme ilerlemesi kütüphanenden silinsin mi?",
                confirmLabel: "Sil",
                danger: true,
              }).then((ok) => ok && run(() => browserApi.sources.remove(source.id), onDeleted));
            }}
          >
            <Trash2 className="size-4" aria-hidden /> Kaynağı sil
          </Button>
        </div>
        {error && !editing && <p className="mt-2 text-danger">{error}</p>}
      </details>
    </header>
  );
}
