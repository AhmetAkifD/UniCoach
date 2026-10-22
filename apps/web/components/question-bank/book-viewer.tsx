"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, Download, ListChecks, NotebookPen, Pencil, Trash2 } from "lucide-react";
import { ApiError, findSubject, formatBytes, type BookSummary, type ExamTrack } from "@unicoach/shared";
import { SubjectSelect } from "@/components/library/subject-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDialog } from "@/components/ui/use-dialog";
import { browserApi } from "@/lib/api";
import { BookReader } from "./book-reader";

export function BookViewer({
  book: initial,
  examTrack,
  color,
  topics,
}: {
  book: BookSummary;
  examTrack: ExamTrack | null;
  color: string;
  topics: string[];
}) {
  const router = useRouter();
  const [book, setBook] = useState(initial);
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/soru-bankasi"
        className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden /> Soru Bankası
      </Link>

      <BookHeader
        book={book}
        examTrack={examTrack}
        color={color}
        topics={topics}
        pageCount={book.pageCount ?? 0}
        onChanged={(next) => {
          setBook(next);
          router.refresh();
        }}
        onDeleted={() => {
          router.push("/soru-bankasi");
          router.refresh();
        }}
      />

      <BookReader book={initial} onBookChange={setBook} />
    </div>
  );
}

function BookHeader({
  book,
  examTrack,
  color,
  topics,
  pageCount,
  onChanged,
  onDeleted,
}: {
  book: BookSummary;
  examTrack: ExamTrack | null;
  color: string;
  topics: string[];
  pageCount: number;
  onChanged: (book: BookSummary) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(book.title);
  const [subject, setSubject] = useState(book.subject);
  const [topic, setTopic] = useState(book.topic ?? "");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useDialog();

  function run(action: () => Promise<BookSummary | void>, after: (book?: BookSummary) => void) {
    setError(undefined);
    startTransition(async () => {
      try {
        after((await action()) ?? undefined);
      } catch (err) {
        setError(
          err instanceof ApiError ? (err.errors?.title ?? err.errors?.topic ?? err.message) : "Kaydedilemedi.",
        );
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
            run(() => browserApi.books.update(book.id, { title }), (next) => {
              setEditing(false);
              if (next) onChanged(next);
            });
          }}
        >
          <div className="flex-1">
            <Input
              placeholder="Ad"
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
                setTitle(book.title);
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
          <h1 className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">{book.title}</h1>
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Adını değiştir"
            title="Adını değiştir"
            className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text"
          >
            <Pencil className="size-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
          {findSubject(book.subject)?.label ?? book.subject}
        </span>
        {book.topic && <span>{book.topic}</span>}
        {pageCount > 0 && <span className="tabular-nums">{pageCount} sayfa</span>}
        <span className="tabular-nums">{formatBytes(book.sizeBytes)}</span>
        <Link
          href={`/soru-bankasi/${book.id}/sorular`}
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          <ListChecks className="size-4" aria-hidden />
          {book.questionCount ? `${book.questionCount} soru çıkarıldı` : "Soruları çıkar"}
        </Link>
        {book.questionCount > 0 && (
          <Link
            href={`/sinavlar/yeni?pdf=${book.id}`}
            className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            <ClipboardList className="size-4" aria-hidden /> Sınav oluştur
          </Link>
        )}
        <Link
          href={`/calisma-alani?pdf=${book.id}`}
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          <NotebookPen className="size-4" aria-hidden /> Çalışma alanında aç
        </Link>
      </div>

      <details className="group text-sm">
        <summary className="cursor-pointer select-none text-text-muted hover:text-text">Ayarlar</summary>
        <div className="mt-3 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SubjectSelect
              value={subject}
              examTrack={examTrack}
              disabled={pending}
              onChange={(next) => {
                setSubject(next);
                run(() => browserApi.books.update(book.id, { subject: next }), (b) => b && onChanged(b));
              }}
            />
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => browserApi.books.update(book.id, { topic }), (b) => b && onChanged(b));
              }}
            >
              <div className="flex-1">
                <Input
                  placeholder="Konu (isteğe bağlı)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  maxLength={60}
                  list="book-topics"
                  disabled={pending}
                />
                <datalist id="book-topics">
                  {topics.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <Button type="submit" variant="secondary" disabled={pending || topic.trim() === (book.topic ?? "")}>
                Kaydet
              </Button>
            </form>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={browserApi.books.filePath(book.id)}
              download={`${book.title}.pdf`}
              className="inline-flex h-11 items-center gap-2 rounded-md px-5 font-medium text-text hover:bg-surface-muted"
            >
              <Download className="size-4" aria-hidden /> İndir
            </a>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => {
                void confirm({
                  title: "PDF'i sil",
                  message: "Bu PDF, çıkarılan soruları ve bu PDF'ten çözdüğün sınavlar silinsin mi?",
                  confirmLabel: "Sil",
                  danger: true,
                }).then((ok) => ok && run(() => browserApi.books.remove(book.id), onDeleted));
              }}
            >
              <Trash2 className="size-4" aria-hidden /> PDF'i sil
            </Button>
          </div>
        </div>
        {error && !editing && <p className="mt-2 text-danger">{error}</p>}
      </details>
    </header>
  );
}
