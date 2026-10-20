"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Plus, X } from "lucide-react";
import { ApiError, parseYouTubeUrl, type ExamTrack } from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { browserApi } from "@/lib/api";
import { fetchPlaylistVideoIds } from "@/lib/youtube";
import { SubjectSelect } from "./subject-select";

type Phase = "idle" | "reading" | "saving";

/** "Kaynak ekle": YouTube video ya da oynatma listesi bağlantısı + ders. */
export function AddSourceButton({ examTrack, label = "Kaynak ekle" }: { examTrack: ExamTrack | null; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-5" aria-hidden /> {label}
      </Button>
      {open && <AddSourceDialog examTrack={examTrack} onClose={() => setOpen(false)} />}
    </>
  );
}

function AddSourceDialog({ examTrack, onClose }: { examTrack: ExamTrack | null; onClose: () => void }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [subject, setSubject] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [errors, setErrors] = useState<{ url?: string; subject?: string; form?: string }>({});
  const busy = phase !== "idle";

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    // showModal odağı ilk odaklanabilir öğeye (kapat butonu) verir; bağlantı kutusuna taşı.
    urlRef.current?.focus();
    return () => dialog?.close();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = parseYouTubeUrl(url);
    const next = {
      url: parsed ? undefined : "Geçerli bir YouTube video ya da oynatma listesi bağlantısı yapıştır.",
      subject: subject ? undefined : "Bir ders seç.",
    };
    setErrors(next);
    if (!parsed || !subject) return;

    try {
      let videoIds: string[] | undefined;
      if (parsed.kind === "PLAYLIST") {
        setPhase("reading");
        videoIds = await fetchPlaylistVideoIds(parsed.listId);
      }
      setPhase("saving");
      const source = await browserApi.sources.create({
        subject,
        kind: parsed.kind,
        youtubeId: parsed.kind === "PLAYLIST" ? parsed.listId : parsed.videoId,
        videoIds,
      });
      router.push(`/konular/${source.id}`);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? (err.errors?.youtubeId ?? err.errors?.subject ?? err.message)
          : err instanceof Error
            ? err.message
            : "Kaynak eklenemedi.";
      setErrors({ form: message });
      setPhase("idle");
    }
  }

  const status =
    phase === "reading" ? "Oynatma listesi okunuyor…" : phase === "saving" ? "Video başlıkları alınıyor…" : null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      aria-labelledby="add-source-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border bg-surface p-0 text-text shadow-raised backdrop:bg-black/50"
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-5 p-6 text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="add-source-title" className="text-xl font-semibold tracking-tight">
              Kaynak ekle
            </h2>
            <p className="text-sm text-text-muted">
              Bir YouTube videosu ya da oynatma listesi ekle. Liste, YouTube'daki sırasıyla bir grup olarak durur.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Kapat"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text disabled:opacity-50"
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

        <fieldset disabled={busy} className="contents">
          <Input
            name="url"
            inputMode="url"
            placeholder="YouTube bağlantısı"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            error={errors.url}
            ref={urlRef}
          />
          <SubjectSelect value={subject} onChange={setSubject} examTrack={examTrack} error={errors.subject} />
        </fieldset>

        <div className="flex items-center justify-end gap-3">
          {status && (
            <span role="status" className="mr-auto text-sm text-text-muted">
              {status}
            </span>
          )}
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button type="submit" loading={busy}>
            Ekle
          </Button>
        </div>
      </form>
    </dialog>
  );
}
