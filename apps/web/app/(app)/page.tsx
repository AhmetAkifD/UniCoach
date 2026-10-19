import Link from "next/link";
import { ArrowRight, BookOpenCheck, CircleCheck, CircleAlert, Flame, Target, TrendingUp } from "lucide-react";
import type { HealthResponse } from "@unicoach/shared";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { modules } from "@/components/modules";
import { serverApi } from "@/lib/api";
import { getSession } from "@/lib/session";

async function getHealth(): Promise<HealthResponse | null> {
  try {
    return await serverApi.health({ cache: "no-store", signal: AbortSignal.timeout(2000) });
  } catch {
    return null;
  }
}

export default async function HomePage() {
  // Layout oturumu zaten doğruladı; getSession istek başına önbelleklenir.
  const [user, health] = await Promise.all([getSession(), getHealth()]);
  const firstName = user?.firstName ?? "";

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Merhaba {firstName} 👋</h1>
          <p className="text-text-muted">Bugün hangi konuya çalışmak istersin? Küçük adımlar, büyük netler.</p>
        </div>
        <Link href="/soru-bankasi" className={buttonClasses({ size: "lg" })}>
          Soru Çöz <ArrowRight className="size-5" />
        </Link>
      </section>

      <section aria-label="Özet" className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Son deneme" value="—" hint="Henüz deneme çözmedin." icon={<TrendingUp className="size-5" />} />
        <StatCard label="Çalışma serisi" value="—" hint="İlk çalışmanla seri başlar." icon={<Flame className="size-5" />} />
        <StatCard label="Bugünkü hedef" value="—" hint="Henüz soru çözmedin." icon={<Target className="size-5" />} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col gap-4 lg:col-span-2">
          <h2 className="text-lg font-semibold">Konu ilerlemen</h2>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
            <BookOpenCheck className="size-8 text-text-subtle" strokeWidth={1.75} aria-hidden />
            <p className="font-medium">Henüz ilerleme yok</p>
            <p className="max-w-sm text-sm text-text-muted">
              Konu anlatımlarını izleyip soru çözdükçe ilerlemen burada görünecek.
            </p>
          </div>
        </Card>

        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Sistem durumu</h2>
          <StatusRow label="API" ok={health !== null} />
          <StatusRow label="Veritabanı" ok={health?.database === "up"} />
          <p className="mt-auto text-xs text-text-subtle">
            {health ? `Sürüm ${health.version}` : "API'ye ulaşılamadı. docker compose ile başlattığından emin ol."}
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Modüller</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <Link key={m.href} href={m.href} className="rounded-lg">
                <Card interactive className="flex h-full flex-col gap-3">
                  <span className="inline-flex size-11 items-center justify-center rounded-md bg-primary-soft text-primary-soft-text">
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <h3 className="text-lg font-semibold">{m.title}</h3>
                  <p className="text-sm text-text-muted">{m.description}</p>
                  <Badge tone="primary" className="mt-auto self-start">
                    Yakında · Aşama {m.phase}
                  </Badge>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-muted">{label}</span>
      {ok ? (
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
