import { Check, X } from "lucide-react";
import { radius, semantic, subjectColors, typography, type SemanticColor } from "@unicoach/design";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatCard } from "@/components/ui/stat-card";

export const metadata = { title: "Tasarım sistemi" };

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const badgeTones: BadgeTone[] = ["neutral", "primary", "success", "warning", "danger", "info"];

/** Canlı tasarım rehberi — kurallar docs/DESIGN.md'de. Tema düğmesiyle koyu temayı da kontrol edin. */
export default function DesignPage() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <Badge tone="primary" className="self-start">
          Modern & sakin
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Tasarım sistemi</h1>
        <p className="text-text-muted">
          Web ve mobil aynı token'ları kullanır. Kaynak: <code className="font-mono text-sm">packages/design</code>
        </p>
      </header>

      <Section title="Anlamsal renkler">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {(Object.keys(semantic.light) as SemanticColor[]).map((k) => (
            <div key={k} className="overflow-hidden rounded-md border border-border bg-surface">
              <div className="h-14" style={{ backgroundColor: `var(--uc-${kebab(k)})` }} />
              <div className="p-2 text-xs">
                <div className="font-medium">{k}</div>
                <div className="font-mono text-text-muted">
                  {semantic.light[k]} / {semantic.dark[k]}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Ders renkleri">
        <div className="flex flex-wrap gap-2">
          {Object.entries(subjectColors).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm">
              <span className="size-3 rounded-full" style={{ backgroundColor: v }} />
              {k}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Tipografi">
        <Card className="flex flex-col gap-3">
          {Object.entries(typography.fontSize)
            .reverse()
            .map(([k, [size]]) => (
              <div key={k} className="flex items-baseline gap-4">
                <span className="w-16 shrink-0 font-mono text-xs text-text-muted">
                  {k} · {size}
                </span>
                <span style={{ fontSize: size }} className="truncate font-semibold tracking-tight">
                  Net hesabı, taban puan ve başarı sırası
                </span>
              </div>
            ))}
        </Card>
      </Section>

      <Section title="Butonlar">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Birincil</Button>
          <Button variant="secondary">İkincil</Button>
          <Button variant="ghost">Hayalet</Button>
          <Button variant="danger">Sil</Button>
          <Button loading>Kaydediliyor</Button>
          <Button size="sm">Küçük</Button>
          <Button size="lg">Büyük</Button>
        </div>
      </Section>

      <Section title="Rozetler ve ilerleme">
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {badgeTones.map((t) => (
              <Badge key={t} tone={t}>
                {t}
              </Badge>
            ))}
          </div>
          <ProgressBar value={72} label="Örnek ilerleme" />
          <ProgressBar value={41} color={subjectColors.fizik} label="Fizik ilerleme" />
        </Card>
      </Section>

      <Section title="Kartlar">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="TYT net" value="84,5" hint="Son deneme" />
          <Card interactive className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">Etkileşimli kart</h3>
            <p className="text-sm text-text-muted">Üzerine gel: gölge yükselir.</p>
          </Card>
          <Card className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">Soru şıkları</h3>
            <OptionPreview letter="A" state="idle" text="12" />
            <OptionPreview letter="B" state="selected" text="16" />
            <OptionPreview letter="C" state="correct" text="18" />
            <OptionPreview letter="D" state="wrong" text="24" />
          </Card>
        </div>
      </Section>

      <Section title="Köşe yarıçapları">
        <div className="flex flex-wrap gap-4">
          {Object.entries(radius).map(([k, v]) => (
            <div key={k} className="flex flex-col items-center gap-1 text-xs text-text-muted">
              <div className="size-16 border-2 border-primary bg-primary-soft" style={{ borderRadius: v }} />
              {k} · {v === 9999 ? "tam" : `${v}px`}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

/** Aşama 3'te gerçek OptionButton bileşenine dönüşecek önizleme. */
function OptionPreview({
  letter,
  state,
  text,
}: {
  letter: string;
  state: "idle" | "selected" | "correct" | "wrong";
  text: string;
}) {
  const styles = {
    idle: "border-border bg-surface",
    selected: "border-primary bg-primary-soft text-primary-soft-text",
    correct: "border-success bg-success-soft text-success",
    wrong: "border-danger bg-danger-soft text-danger",
  }[state];
  return (
    <div className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${styles}`}>
      <span className="inline-flex size-7 items-center justify-center rounded-full border border-current font-semibold">
        {letter}
      </span>
      <span className="flex-1">{text}</span>
      {state === "correct" && <Check className="size-4" />}
      {state === "wrong" && <X className="size-4" />}
    </div>
  );
}
