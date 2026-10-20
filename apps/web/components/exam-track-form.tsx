"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { ApiError, EXAM_TRACK_LABELS, EXAM_TRACKS, type ExamTrack } from "@unicoach/shared";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { browserApi } from "@/lib/api";

/** Profilde hazırlanılan sınavı (YKS/LGS) değiştirir. */
export function ExamTrackForm({ initial }: { initial: ExamTrack | null }) {
  const router = useRouter();
  const [value, setValue] = useState<ExamTrack | null>(initial);
  const [saved, setSaved] = useState<ExamTrack | null>(initial);
  const [error, setError] = useState<string>();
  const [justSaved, setJustSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!value) return setError("YKS veya LGS seç.");
    setError(undefined);
    startTransition(async () => {
      try {
        await browserApi.auth.updateProfile({ examTrack: value });
        setSaved(value);
        setJustSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Kaydedilemedi. Biraz sonra tekrar dene.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label="Hangi sınava hazırlanıyorsun?"
        options={EXAM_TRACKS.map((t) => ({ value: t, label: EXAM_TRACK_LABELS[t] }))}
        value={value}
        onChange={(v) => {
          setValue(v);
          setJustSaved(false);
        }}
        error={error}
      />
      <div className="flex items-center gap-3">
        <Button onClick={save} loading={pending} disabled={value === saved}>
          Kaydet
        </Button>
        {justSaved && value === saved && (
          <span role="status" className="inline-flex items-center gap-1.5 text-sm text-success">
            <CircleCheck className="size-4" aria-hidden /> Kaydedildi
          </span>
        )}
      </div>
    </div>
  );
}
