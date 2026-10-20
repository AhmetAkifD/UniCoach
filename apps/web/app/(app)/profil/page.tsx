import { ROLE_LABELS } from "@unicoach/shared";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ExamTrackForm } from "@/components/exam-track-form";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Profil</h1>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-lg font-semibold">
              {user.firstName} {user.lastName}
            </span>
            <span className="text-sm text-text-muted">{user.email}</span>
          </div>
          <Badge tone={user.role === "ADMIN" ? "primary" : "neutral"}>{ROLE_LABELS[user.role]}</Badge>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Sınavın</h2>
          <p className="text-sm text-text-muted">
            Konu Anlatımı'nda ders listesi buna göre öne çıkar. Diğer sınavın derslerine de kaynak ekleyebilirsin.
          </p>
        </div>
        <ExamTrackForm initial={user.examTrack} />
      </Card>
    </div>
  );
}
