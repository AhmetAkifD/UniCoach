"use client";

import { useState } from "react";
import { THEME_LABELS, THEMES, type ThemePreference } from "@unicoach/shared";
import { applyTheme } from "@/components/theme-toggle";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { browserApi } from "@/lib/api";

/** Tema: seçilince hemen uygulanır ve hesaba kaydedilir (başka cihazda da aynı tema gelir). */
export function ThemeForm({ initial }: { initial: ThemePreference }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string>();

  async function change(next: ThemePreference) {
    const previous = value;
    setValue(next);
    setError(undefined);
    applyTheme(next);
    try {
      await browserApi.auth.updateProfile({ theme: next });
    } catch {
      setValue(previous);
      applyTheme(previous);
      setError("Tema kaydedilemedi. Biraz sonra tekrar dene.");
    }
  }

  return (
    <SegmentedControl
      label="Tema"
      options={THEMES.map((t) => ({
        value: t,
        label: THEME_LABELS[t],
        hint: t === "system" ? "Cihazının ayarı" : undefined,
      }))}
      value={value}
      onChange={(v) => void change(v)}
      error={error}
    />
  );
}
