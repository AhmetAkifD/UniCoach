"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const STORAGE_KEY = "uc-theme";

/** <head> içinde, sayfa boyanmadan önce çalışır; kayıtlı temayı uygular (yanıp sönmeyi önler). */
export const themeInitScript = `try{var t=localStorage.getItem("${STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

function currentTheme(): Theme {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => setTheme(currentTheme()), []);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    setTheme(next);
  }

  const label = theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex size-10 items-center justify-center rounded-md text-text-muted transition-colors duration-fast hover:bg-surface-muted hover:text-text"
    >
      {theme === "dark" ? <Sun className="size-5" strokeWidth={1.75} /> : <Moon className="size-5" strokeWidth={1.75} />}
    </button>
  );
}
