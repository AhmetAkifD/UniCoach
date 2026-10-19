import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { modules } from "./modules";

/** Henüz yapılmamış modül sayfaları için geçici ekran. */
export function ComingSoon({ href }: { href: string }) {
  const mod = modules.find((m) => m.href === href)!;
  const Icon = mod.icon;
  return (
    <Card className="mx-auto flex max-w-lg flex-col items-center gap-4 py-12 text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-text">
        <Icon className="size-7" strokeWidth={1.75} />
      </span>
      <Badge tone="primary">Aşama {mod.phase}</Badge>
      <h1 className="text-2xl font-semibold tracking-tight">{mod.title}</h1>
      <p className="text-text-muted">{mod.description}</p>
      <p className="text-sm text-text-subtle">Bu modül yakında burada olacak.</p>
      <Link href="/" className={buttonClasses({ variant: "secondary" })}>
        <ArrowLeft className="size-4" /> Ana sayfaya dön
      </Link>
    </Card>
  );
}
