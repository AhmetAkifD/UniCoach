import { ROLE_LABELS } from "@unicoach/shared";
import { ExamTrackForm } from "@/components/exam-track-form";
import { DeleteAccount, NameForm, PasswordForm } from "@/components/profile/account-forms";
import { AvatarEditor } from "@/components/profile/avatar-editor";
import { PairPhone } from "@/components/profile/pair-phone";
import { ThemeForm } from "@/components/profile/theme-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Profil" };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export default async function ProfilePage() {
  const user = await requireUser();
  const joined = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(user.createdAt));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Profil</h1>

      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-xl font-semibold">
              {user.firstName} {user.lastName}
            </span>
            <span className="truncate text-sm text-text-muted">{user.email}</span>
            <span className="text-xs text-text-subtle">{joined} tarihinden beri üye</span>
          </div>
          <Badge tone={user.role === "ADMIN" ? "primary" : "neutral"}>{ROLE_LABELS[user.role]}</Badge>
        </div>
        <AvatarEditor user={user} />
      </Card>

      <Section title="Hesap">
        <Card className="flex flex-col gap-4">
          <h3 className="font-semibold">Ad ve soyad</h3>
          <NameForm user={user} />
        </Card>
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-semibold">Şifre</h3>
            <p className="text-sm text-text-muted">Değiştirmek için şu anki şifreni de yaz.</p>
          </div>
          <PasswordForm />
        </Card>
      </Section>

      <Section title="Tercihler" description="Hesabına kaydedilir; başka bir cihazdan girince de aynı ayarlar gelir.">
        <Card className="flex flex-col gap-6">
          <ThemeForm initial={user.theme} />
          <div className="flex flex-col gap-1.5 border-t border-border pt-5">
            <ExamTrackForm initial={user.examTrack} />
            <p className="text-xs text-text-subtle">
              Konu Anlatımı'nda ders listesi buna göre öne çıkar. Diğer sınavın derslerine de kaynak ekleyebilirsin.
            </p>
          </div>
        </Card>
      </Section>

      <Section title="Telefonu eşle" description="Mobil uygulama bu bilgisayardaki sunucuya bağlanır; sunucuya ulaşamadığında da kendi kopyasıyla çalışır.">
        <Card>
          <PairPhone />
        </Card>
      </Section>

      <Section title="Hesabı sil">
        {/* Card'ın kenar rengi sınıfla ezilemediği için (cn birleştirmez) kırmızı kenarlı kutu ayrı yazıldı. */}
        <div className="rounded-lg border border-danger/40 bg-surface p-5 shadow-card">
          <DeleteAccount />
        </div>
      </Section>
    </div>
  );
}
