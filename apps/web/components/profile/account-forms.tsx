"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Trash2 } from "lucide-react";
import { ApiError, passwordProblem, type AuthUser } from "@unicoach/shared";
import { logoutAction } from "@/app/(auth)/actions";
import { PasswordChecklist } from "@/components/password-checklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDialog } from "@/components/ui/use-dialog";
import { browserApi } from "@/lib/api";

function Saved() {
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-sm text-success">
      <CircleCheck className="size-4" aria-hidden /> Kaydedildi
    </span>
  );
}

/** Ad ve soyad */
export function NameForm({ user }: { user: AuthUser }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const changed = firstName.trim() !== user.firstName || lastName.trim() !== user.lastName;

  function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      try {
        await browserApi.auth.updateProfile({ firstName, lastName });
        setSaved(true);
        router.refresh();
      } catch (err) {
        setErrors(err instanceof ApiError ? { ...err.errors, form: err.errors ? undefined : err.message } : { form: "Kaydedilemedi." });
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Ad"
          value={firstName}
          onChange={(e) => {
            setFirstName(e.target.value);
            setSaved(false);
          }}
          error={errors.firstName}
          autoComplete="given-name"
          maxLength={40}
        />
        <Input
          label="Soyad"
          value={lastName}
          onChange={(e) => {
            setLastName(e.target.value);
            setSaved(false);
          }}
          error={errors.lastName}
          autoComplete="family-name"
          maxLength={40}
        />
      </div>
      {errors.form && (
        <p role="alert" className="text-sm text-danger">
          {errors.form}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} disabled={!changed}>
          Kaydet
        </Button>
        {saved && !changed && <Saved />}
      </div>
    </form>
  );
}

/** Şifre değiştirme: şu anki şifre + yeni şifre (kurallar canlı gösterilir) + tekrarı */
export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!current) found.currentPassword = "Şu anki şifreni yaz.";
    const problem = passwordProblem(next);
    if (!next) found.newPassword = "Yeni şifreni yaz.";
    else if (problem) found.newPassword = problem;
    if (next && repeat !== next) found.repeat = "Şifreler aynı değil.";
    setErrors(found);
    if (Object.keys(found).length) return;
    startTransition(async () => {
      try {
        await browserApi.auth.changePassword({ currentPassword: current, newPassword: next });
        setCurrent("");
        setNext("");
        setRepeat("");
        setSaved(true);
      } catch (err) {
        if (err instanceof ApiError && err.errors) setErrors(err.errors);
        else if (err instanceof ApiError && err.status === 400) setErrors({ currentPassword: err.message });
        else setErrors({ form: "Şifre değiştirilemedi." });
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Input
        label="Şu anki şifre"
        type="password"
        value={current}
        onChange={(e) => {
          setCurrent(e.target.value);
          setSaved(false);
        }}
        error={errors.currentPassword}
        autoComplete="current-password"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Yeni şifre"
          type="password"
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            setSaved(false);
          }}
          error={errors.newPassword}
          autoComplete="new-password"
        />
        <Input
          label="Yeni şifre (tekrar)"
          type="password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          error={errors.repeat}
          autoComplete="new-password"
        />
      </div>
      {next && <PasswordChecklist password={next} />}
      {errors.form && (
        <p role="alert" className="text-sm text-danger">
          {errors.form}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending} disabled={!current && !next}>
          Şifreyi değiştir
        </Button>
        {saved && (
          <span role="status" className="inline-flex items-center gap-1.5 text-sm text-success">
            <CircleCheck className="size-4" aria-hidden /> Şifren değişti
          </span>
        )}
      </div>
    </form>
  );
}

/** Hesabı silme: onay + şifre; sonra oturum kapanır. */
export function DeleteAccount() {
  const { confirm, prompt, alert, dialog } = useDialog();
  const [pending, setPending] = useState(false);

  async function run() {
    const ok = await confirm({
      title: "Hesabını sil",
      message:
        "Hesabın ve bütün verilerin silinecek: video kaynakların, PDF'lerin ve çıkardığın sorular, sınavların, YKS sonucun, tercih listen ve defterlerin. Bu geri alınamaz.",
      confirmLabel: "Devam et",
      danger: true,
    });
    if (!ok) return;
    const password = await prompt({
      title: "Şifreni yaz",
      message: "Hesabını silmek için şifreni doğrula.",
      placeholder: "Şifre",
      inputType: "password",
      confirmLabel: "Hesabımı sil",
      danger: true,
    });
    if (!password) return;
    setPending(true);
    try {
      await browserApi.auth.deleteAccount({ password });
      await logoutAction();
    } catch (err) {
      setPending(false);
      await alert({ title: "Hesap silinemedi", message: err instanceof ApiError ? err.message : "Biraz sonra tekrar dene." });
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {dialog}
      <p className="text-sm text-text-muted">Hesabın ve bütün verilerin kalıcı olarak silinir.</p>
      <Button variant="danger" size="sm" loading={pending} onClick={() => void run()}>
        <Trash2 className="size-4" aria-hidden /> Hesabımı sil
      </Button>
    </div>
  );
}
