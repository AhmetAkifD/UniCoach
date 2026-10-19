import Link from "next/link";
import { GraduationCap, UserRound } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

const nav = [
  { href: "/konular", label: "Konu Anlatımı" },
  { href: "/soru-bankasi", label: "Soru Bankası" },
  { href: "/sinavlar", label: "Sınavlar" },
  { href: "/tercih", label: "YKS Tercih" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-flex size-9 items-center justify-center rounded-md bg-primary text-on-primary">
            <GraduationCap className="size-5" strokeWidth={1.75} />
          </span>
          <span className="text-lg">UniCoach</span>
        </Link>

        <nav aria-label="Ana menü" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors duration-fast hover:bg-surface-muted hover:text-text"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <span
            aria-label="Profil"
            className="inline-flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary-soft-text"
          >
            <UserRound className="size-5" strokeWidth={1.75} />
          </span>
        </div>
      </div>
    </header>
  );
}
