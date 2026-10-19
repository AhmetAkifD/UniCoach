"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import { modules } from "./modules";

/**
 * Logo ikonu = ana menü düğmesi. Üzerine gelince (veya menü açıkken) ikon üç çizgiye döner,
 * tıklayınca modüllerin listelendiği açılır menü gösterilir.
 */
export function AppMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Sayfa değişince menüyü kapat.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Menüyü aç"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="app-menu"
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex size-9 items-center justify-center rounded-md bg-primary text-on-primary transition-colors duration-fast hover:bg-primary-hover"
      >
        <GraduationCap
          className="size-5 group-hover:hidden group-aria-expanded:hidden"
          strokeWidth={1.75}
          aria-hidden
        />
        <Menu className="hidden size-5 group-hover:block group-aria-expanded:block" strokeWidth={1.75} aria-hidden />
      </button>

      {open && (
        <nav
          id="app-menu"
          aria-label="Ana menü"
          className="absolute left-0 top-full z-40 mt-2 w-64 rounded-lg border border-border bg-surface p-1.5 shadow-raised"
        >
          <ul role="menu" className="flex flex-col">
            {modules.map((m) => {
              const Icon = m.icon;
              const active = pathname === m.href;
              return (
                <li key={m.href} role="none">
                  <Link
                    href={m.href}
                    role="menuitem"
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-fast",
                      active ? "bg-primary-soft text-primary-soft-text" : "text-text hover:bg-surface-muted",
                    )}
                  >
                    <Icon className="size-4.5 text-text-muted" strokeWidth={1.75} aria-hidden />
                    {m.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
