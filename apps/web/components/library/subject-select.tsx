"use client";

import { useId } from "react";
import { EXAM_TRACK_LABELS, SUBJECTS, findSubject, type ExamTrack } from "@unicoach/shared";
import { cn } from "@/lib/cn";

/**
 * Ders seçimi. Öğrencinin sınavının dersleri önce listelenir; diğer sınavın dersleri de seçilebilir,
 * o durumda yalnızca küçük bir hatırlatma gösterilir (engellenmez).
 */
export function SubjectSelect({
  value,
  onChange,
  examTrack,
  error,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  examTrack: ExamTrack | null;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const tracks: ExamTrack[] = examTrack === "LGS" ? ["LGS", "YKS"] : ["YKS", "LGS"];
  const selected = findSubject(value);
  const otherTrack = selected && examTrack && selected.track !== examTrack;

  return (
    <div className="flex flex-col gap-1.5">
      <select
        id={id}
        aria-label="Ders"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        className={cn(
          "h-11 rounded-md border bg-surface px-3 text-base text-text",
          !value && "text-text-subtle",
          error ? "border-danger" : "border-border-strong",
        )}
      >
        <option value="" disabled>
          Ders seç
        </option>
        {tracks.map((track) => (
          <optgroup key={track} label={EXAM_TRACK_LABELS[track]}>
            {SUBJECTS.filter((s) => s.track === track).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : otherTrack ? (
        <p className="text-sm text-warning">
          Bu ders {EXAM_TRACK_LABELS[selected.track]} dersi; sen {EXAM_TRACK_LABELS[examTrack]} sınavına hazırlanıyorsun.
          Yine de ekleyebilirsin.
        </p>
      ) : null}
    </div>
  );
}
