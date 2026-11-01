import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/** Giriş akışı: logo ekranın sol üstünde; form ekranın sağına yapışık, tam yükseklikte panelde (geniş ekranda genişliğin üçte biri). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh justify-end">
      <Link
        href="/"
        className="absolute left-6 top-5 z-10 flex items-center gap-2 font-semibold tracking-tight sm:left-8"
      >
        <span className="inline-flex size-9 items-center justify-center rounded-md bg-primary text-on-primary">
          <GraduationCap className="size-5" strokeWidth={1.75} />
        </span>
        <span className="text-lg">UniCoach</span>
      </Link>
      <aside className="flex min-h-dvh w-full flex-col border-border bg-surface sm:max-w-md sm:border-l sm:shadow-raised lg:w-1/3 lg:max-w-none">
        <div className="flex justify-end px-6 pt-5 sm:px-10">
          <ThemeToggle />
        </div>
        <main className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-10">{children}</main>
      </aside>
    </div>
  );
}
