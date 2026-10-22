import Link from "next/link";
import { LogOut, Search } from "lucide-react";
import { ROLE_LABELS, type AuthUser } from "@unicoach/shared";
import { logoutAction } from "@/app/(auth)/actions";
import { Badge } from "@/components/ui/badge";
import { AppMenu } from "./app-menu";
import { ThemeToggle } from "./theme-toggle";

function initials(user: AuthUser) {
  return [user.firstName, user.lastName]
    .map((part) => part.trim().charAt(0).toLocaleUpperCase("tr"))
    .join("");
}

export function SiteHeader({ user }: { user: AuthUser }) {
  const fullName = `${user.firstName} ${user.lastName}`.trim();

  return (
    <header data-site-header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 md:gap-6 md:px-8">
        <div className="flex items-center gap-2">
          <AppMenu />
          <Link href="/" className="text-lg font-semibold tracking-tight">
            UniCoach
          </Link>
        </div>

        {/* Arama çubuğu: şimdilik pasif, ileride etkinleştirilecek. */}
        <div role="search" className="hidden max-w-xl flex-1 sm:block">
          <label className="relative block">
            <span className="sr-only">Ara</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Konu, soru veya üniversite ara"
              disabled
              title="Arama yakında"
              className="h-10 w-full rounded-md border border-border bg-surface-muted pl-9 pr-3 text-sm text-text placeholder:text-text-subtle disabled:cursor-not-allowed"
            />
          </label>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/profil"
            aria-label="Profil"
            className="ml-1 flex items-center gap-2 rounded-md p-0.5 pr-1.5 transition-colors duration-fast hover:bg-surface-muted"
            title={`${fullName} · ${user.email}`}
          >
            <span
              aria-hidden
              className="inline-flex size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-soft-text"
            >
              {initials(user)}
            </span>
            <span className="hidden max-w-40 truncate text-sm font-medium lg:inline">{fullName}</span>
            {user.role === "ADMIN" && <Badge tone="primary">{ROLE_LABELS.ADMIN}</Badge>}
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Çıkış yap"
              title="Çıkış yap"
              className="inline-flex size-10 items-center justify-center rounded-md text-text-muted transition-colors duration-fast hover:bg-surface-muted hover:text-text"
            >
              <LogOut className="size-5" strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
