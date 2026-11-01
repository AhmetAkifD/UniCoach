"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, CircleAlert, CircleCheck } from "lucide-react";
import type { HealthResponse } from "@unicoach/shared";
import { Badge } from "@/components/ui/badge";
import { browserApi } from "@/lib/api";
import { cn } from "@/lib/cn";

/**
 * Üst bardaki "Sistem durumu" düğmesi: üzerine gelince altında API ve veritabanı durumunu gösteren panel açılır;
 * tıklayınca panel yeniden tıklanana kadar açık kalır. Durum her açılışta yeniden sorulur.
 */
export function SystemStatus() {
  // undefined: soruluyor, null: API'ye ulaşılamadı
  const [health, setHealth] = useState<HealthResponse | null | undefined>(undefined);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || pinned;

  const check = useCallback(async () => {
    try {
      setHealth(await browserApi.health({ cache: "no-store", signal: AbortSignal.timeout(3000) }));
    } catch {
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  useEffect(() => {
    if (open) void check();
  }, [open, check]);

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pinned]);

  const ok = health ? health.database === "up" : health === undefined ? null : false;

  return (
    <div className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="system-status-panel"
        onClick={() => setPinned((v) => !v)}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-text-muted transition-colors duration-fast hover:bg-surface-muted hover:text-text",
          pinned && "bg-surface-muted text-text",
        )}
      >
        <span className="relative">
          <Activity className="size-5" strokeWidth={1.75} aria-hidden />
          <span
            aria-hidden
            className={cn(
              "absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-surface",
              ok === null ? "bg-text-subtle" : ok ? "bg-success" : "bg-danger",
            )}
          />
        </span>
        <span className="hidden md:inline">Sistem durumu</span>
      </button>

      {open && (
        // pt-2: fare düğmeden panele geçerken boşluğa düşüp paneli kapatmasın.
        <div id="system-status-panel" className="absolute right-0 top-full z-40 pt-2">
          <div role="status" className="flex w-64 flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-raised">
            <p className="text-sm font-semibold">Sistem durumu</p>
            <StatusRow label="API" ok={health === undefined ? null : health !== null} />
            <StatusRow label="Veritabanı" ok={health === undefined ? null : health?.database === "up"} />
            <p className="text-xs text-text-subtle">
              {health === undefined
                ? "Kontrol ediliyor…"
                : health
                  ? `Sürüm ${health.version}`
                  : "API'ye ulaşılamadı. docker compose ile başlattığından emin ol."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean | null }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-muted">{label}</span>
      {ok === null ? (
        <Badge tone="neutral">Kontrol ediliyor</Badge>
      ) : ok ? (
        <Badge tone="success">
          <CircleCheck className="size-3.5" /> Çalışıyor
        </Badge>
      ) : (
        <Badge tone="danger">
          <CircleAlert className="size-3.5" /> Bağlantı yok
        </Badge>
      )}
    </div>
  );
}
