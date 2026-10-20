"use client";

import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, FileText, Plus, Upload, X } from "lucide-react";
import { ApiError, BOOK_MAX_BYTES, formatBytes, type ExamTrack } from "@unicoach/shared";
import { SubjectSelect } from "@/components/library/subject-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";
import { uploadBookFile } from "@/lib/upload";

type Errors = { file?: string; subject?: string; title?: string; topic?: string; form?: string };

/** "PDF yükle": soru kitabı PDF'i + ders + isteğe bağlı konu. */
export function UploadBookButton({
  examTrack,
  topics,
  label = "PDF yükle",
}: {
  examTrack: ExamTrack | null;
  /** Önceden kullanılan konu etiketleri (öneri olarak gösterilir). */
  topics: string[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-5" aria-hidden /> {label}
      </Button>
      {open && <UploadBookDialog examTrack={examTrack} topics={topics} onClose={() => setOpen(false)} />}
    </>
  );
}

function titleFromFileName(name: string) {
  return name.replace(/\.pdf$/i, "").replace(/[_]+/g, " ").trim().slice(0, 120);
}

function UploadBookDialog({
  examTrack,
  topics,
  onClose,
}: {
  examTrack: ExamTrack | null;
  topics: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const topicListId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [sent, setSent] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const busy = sent !== null;
  const tooLarge = file ? file.size > BOOK_MAX_BYTES : false;

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      abortRef.current?.abort();
      dialog?.close();
    };
  }, []);

  function pick(next: File | undefined) {
    if (!next) return;
    const isPdf = next.type === "application/pdf" || /\.pdf$/i.test(next.name);
    setErrors({ file: isPdf ? undefined : "Yalnızca PDF dosyası yükleyebilirsin." });
    if (!isPdf) return;
    setFile(next);
    setTitle((current) => current || titleFromFileName(next.name));
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!busy) pick(e.dataTransfer.files[0]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {
      file: !file ? "Bir PDF seç." : tooLarge ? `PDF en fazla ${formatBytes(BOOK_MAX_BYTES)} olabilir.` : undefined,
      subject: subject ? undefined : "Bir ders seç.",
      title: title.trim() ? undefined : "Bir ad yaz.",
    };
    setErrors(next);
    if (next.file || next.subject || next.title || !file) return;

    let bookId: string | null = null;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setSent(0);
      const book = await browserApi.books.create({ subject, title, topic, sizeBytes: file.size });
      bookId = book.id;
      await uploadBookFile(book.id, file, setSent, controller.signal);
      router.push(`/soru-bankasi/${book.id}`);
      router.refresh();
    } catch (err) {
      // Dosyası gelmeyen kayıt kalmasın.
      if (bookId) void browserApi.books.remove(bookId).catch(() => undefined);
      if (err instanceof DOMException && err.name === "AbortError") return;
      setErrors(
        err instanceof ApiError && err.errors
          ? { subject: err.errors.subject, title: err.errors.title, topic: err.errors.topic, form: err.errors.sizeBytes }
          : { form: err instanceof Error ? err.message : "PDF yüklenemedi." },
      );
      setSent(null);
    }
  }

  function cancel() {
    if (busy) abortRef.current?.abort();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
      aria-labelledby="upload-book-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border bg-surface p-0 text-text shadow-raised backdrop:bg-black/50"
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-5 p-6 text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="upload-book-title" className="text-xl font-semibold tracking-tight">
              PDF yükle
            </h2>
            <p className="text-sm text-text-muted">
              Soru kitabının PDF'ini yükle. En fazla {formatBytes(BOOK_MAX_BYTES)} olabilir; kaldığın sayfayı biz hatırlarız.
            </p>
          </div>
          <button
            type="button"
            onClick={cancel}
            aria-label="Kapat"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text"
          >
            <X className="size-5" />
          </button>
        </div>

        {errors.form && (
          <div role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-3 text-sm text-danger">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {errors.form}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex items-center gap-3 rounded-lg border border-dashed px-4 py-4 text-left transition-colors duration-fast",
              dragging ? "border-primary bg-primary-soft" : "border-border-strong hover:border-primary",
              (errors.file || tooLarge) && "border-danger",
              "disabled:pointer-events-none",
            )}
          >
            {file ? (
              <FileText className="size-8 shrink-0 text-primary" strokeWidth={1.75} aria-hidden />
            ) : (
              <Upload className="size-8 shrink-0 text-text-subtle" strokeWidth={1.75} aria-hidden />
            )}
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{file ? file.name : "PDF seç ya da buraya sürükle"}</span>
              <span className={cn("text-sm tabular-nums", tooLarge ? "text-danger" : "text-text-muted")}>
                {file
                  ? tooLarge
                    ? `${formatBytes(file.size)} · sınır ${formatBytes(BOOK_MAX_BYTES)}`
                    : formatBytes(file.size)
                  : `En fazla ${formatBytes(BOOK_MAX_BYTES)}`}
              </span>
            </span>
          </button>
          {errors.file && <p className="text-sm text-danger">{errors.file}</p>}
        </div>

        <fieldset disabled={busy} className="contents">
          <Input
            placeholder="Ad"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            maxLength={120}
          />
          <SubjectSelect value={subject} onChange={setSubject} examTrack={examTrack} error={errors.subject} />
          <Input
            placeholder="Konu (isteğe bağlı)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            error={errors.topic}
            maxLength={60}
            list={topics.length ? topicListId : undefined}
          />
          {topics.length > 0 && (
            <datalist id={topicListId}>
              {topics.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          )}
        </fieldset>

        {busy && file && (
          <div role="status" className="flex flex-col gap-1.5">
            <ProgressBar value={(sent / file.size) * 100} label="Yükleme ilerlemesi" showValue={false} />
            <span className="flex justify-between text-sm text-text-muted tabular-nums">
              <span>
                {formatBytes(sent)} / {formatBytes(file.size)}
              </span>
              <span>%{Math.floor((sent / file.size) * 100)}</span>
            </span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="ghost" onClick={cancel}>
            Vazgeç
          </Button>
          <Button type="submit" loading={busy} disabled={tooLarge}>
            Yükle
          </Button>
        </div>
      </form>
    </dialog>
  );
}
