import Link from "next/link";
import { ArrowRight, Target, TrendingUp } from "lucide-react";
import { formatNet, type ExamSummary, type ExamTodayStats, type SourceSummary } from "@unicoach/shared";
import { TopicProgressCard } from "@/components/library/topic-progress-card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { modules } from "@/components/modules";
import { authedApi, getSession } from "@/lib/session";

/** Son biten deneme (ana sayfa kartı); API'ye ulaşılamazsa boş. */
async function getLastExam(): Promise<ExamSummary | null> {
  try {
    return (await (await authedApi()).exams.list()).find((e) => e.finishedAt) ?? null;
  } catch {
    return null;
  }
}

/** Bugün çözülen soru sayısı (ana sayfa kartı); API'ye ulaşılamazsa null. */
async function getToday(): Promise<ExamTodayStats | null> {
  try {
    return await (await authedApi()).exams.today();
  } catch {
    return null;
  }
}

/** Konu Anlatımı kaynakları ("Konu ilerlemen" kartı); API'ye ulaşılamazsa null. */
async function getSources(): Promise<SourceSummary[] | null> {
  try {
    return await (await authedApi()).sources.list();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  // Layout oturumu zaten doğruladı; getSession istek başına önbelleklenir.
  const [user, lastExam, sources, today] = await Promise.all([
    getSession(),
    getLastExam(),
    getSources(),
    getToday(),
  ]);
  const firstName = user?.firstName ?? "";

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Merhaba {firstName} 👋</h1>
          <p className="text-text-muted">Bugün hangi konuya çalışmak istersin?</p>
        </div>
        <Link href="/soru-bankasi" className={buttonClasses({ size: "lg" })}>
          Soru Çöz <ArrowRight className="size-5" />
        </Link>
      </section>

      <section aria-label="Özet" className="grid gap-4 sm:grid-cols-2">
        <Link href={lastExam ? `/sinavlar/${lastExam.id}` : "/sinavlar"} className="rounded-lg">
          <StatCard
            label="Son deneme"
            value={lastExam ? formatNet(lastExam.net ?? 0) : "—"}
            hint={
              lastExam
                ? `${lastExam.title} · ${lastExam.correct} D, ${lastExam.wrong} Y`
                : "Henüz deneme çözmedin."
            }
            icon={<TrendingUp className="size-5" />}
          />
        </Link>
        <Link href="/sinavlar" className="rounded-lg">
          <StatCard
            label="Bugün çözülen soru sayısı"
            value={today ? String(today.solved) : "—"}
            hint={!today ? "Sunucuya ulaşılamadı." : today.solved ? "Sınavlarda cevapladığın sorular." : "Bugün henüz soru çözmedin."}
            icon={<Target className="size-5" />}
          />
        </Link>
      </section>

      <TopicProgressCard sources={sources} />

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Modüller</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <Link key={m.href} href={m.href} className="rounded-lg">
                <Card interactive className="flex h-full flex-col gap-3">
                  <span className="inline-flex size-11 items-center justify-center rounded-md bg-primary-soft text-primary-soft-text">
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <h3 className="text-lg font-semibold">{m.title}</h3>
                  {!m.ready && (
                    <Badge tone="primary" className="mt-auto self-start">
                      Yakında · Aşama {m.phase}
                    </Badge>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
