"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Pencil, RotateCw } from "lucide-react";
import {
  ADMIN_SHORTCUT,
  checkEmailSchema,
  fieldErrors,
  loginSchema,
  registerSchema,
  type FieldErrors,
} from "@unicoach/shared";
import { checkEmailAction, loginAction, registerAction, type ActionResult } from "@/app/(auth)/actions";
import { PasswordChecklist } from "@/components/password-checklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * E-posta öncelikli giriş akışı:
 *   e-posta → (kayıtlıysa) şifre → ana sayfa
 *   e-posta → (değilse) kayıt → şifre → ana sayfa
 * E-posta yalnızca bu bileşenin belleğinde tutulur (URL'de veya tarayıcı deposunda değil);
 * sayfa yenilenirse akış e-posta adımından yeniden başlar.
 */
type Step =
  | { name: "email" }
  | { name: "password"; email: string; notice?: string }
  | { name: "register"; email: string };

/** `apiReachable`: sayfa açılırken (sunucuda) API'ye ulaşılabildi mi? Ulaşılamadıysa uyarı hemen gösterilir. */
export function AuthFlow({ apiReachable = true }: { apiReachable?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "email" });
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function go(next: Step) {
    setErrors({});
    setFormError(undefined);
    setStep(next);
  }

  function apply(result: ActionResult | undefined) {
    setErrors(result?.fieldErrors ?? {});
    setFormError(result?.error);
  }

  function submitEmail(e: FormEvent) {
    e.preventDefault();
    const parsed = checkEmailSchema.safeParse({ email });
    if (!parsed.success) return apply({ fieldErrors: fieldErrors(parsed.error) });
    startTransition(async () => {
      const res = await checkEmailAction(parsed.data.email);
      if (res.exists === undefined || !res.email) return apply(res);
      go(res.exists ? { name: "password", email: res.email } : { name: "register", email: res.email });
    });
  }

  const heading = step.name === "register" ? "Hesabını oluştur" : "UniCoach'a giriş yap";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>

      {step.name === "password" && step.notice && (
        <Notice tone="success">{step.notice}</Notice>
      )}
      {!apiReachable && (
        <Notice tone="danger">
          <span className="flex flex-1 flex-wrap items-center justify-between gap-2">
            Sunucuya ulaşılamadı. Biraz sonra tekrar dene.
            <button
              type="button"
              onClick={() => startTransition(() => router.refresh())}
              className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
            >
              <RotateCw className={pending ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden /> Tekrar dene
            </button>
          </span>
        </Notice>
      )}
      {formError && apiReachable && <Notice tone="danger">{formError}</Notice>}

      {step.name === "email" && (
        <form onSubmit={submitEmail} noValidate className="flex flex-col gap-4">
          {/* API'ye ulaşılamıyorsa form kilitlenir; "Tekrar dene" sayfayı yeniden kontrol eder. */}
          <fieldset disabled={!apiReachable} className="contents">
            <Input
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="E-posta adresi"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoFocus
            />
            <Button type="submit" size="lg" loading={pending && apiReachable} className="w-full">
              Devam et
            </Button>
          </fieldset>
        </form>
      )}

      {step.name === "password" && (
        <PasswordStep
          key={step.email}
          email={step.email}
          pending={pending}
          errors={errors}
          onChangeEmail={() => go({ name: "email" })}
          onSubmit={(password) => {
            const parsed = loginSchema.safeParse({ email: step.email, password });
            if (!parsed.success) return apply({ fieldErrors: fieldErrors(parsed.error) });
            startTransition(async () => apply(await loginAction(parsed.data)));
          }}
        />
      )}

      {step.name === "register" && (
        <RegisterStep
          email={step.email}
          pending={pending}
          errors={errors}
          onChangeEmail={() => go({ name: "email" })}
          onSubmit={(values) => {
            const parsed = registerSchema.safeParse({ ...values, email: step.email });
            if (!parsed.success) return apply({ fieldErrors: fieldErrors(parsed.error) });
            startTransition(async () => {
              const res = await registerAction(parsed.data);
              if (!res.ok) return apply(res);
              go({ name: "password", email: step.email, notice: "Hesabın oluşturuldu. Şimdi şifrenle giriş yap." });
            });
          }}
        />
      )}
    </div>
  );
}

function PasswordStep({
  email,
  pending,
  errors,
  onChangeEmail,
  onSubmit,
}: {
  email: string;
  pending: boolean;
  errors: FieldErrors;
  onChangeEmail: () => void;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(password);
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      <EmailChip email={email} onChange={onChangeEmail} />
      {/* Tarayıcının şifre yöneticisi doğru hesabı eşleştirsin diye gizli kullanıcı adı alanı. */}
      <input type="email" name="email" value={email} autoComplete="username" readOnly hidden />
      <Input
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Şifre"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        autoFocus
      />
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Giriş yap
      </Button>
    </form>
  );
}

function RegisterStep({
  email,
  pending,
  errors,
  onChangeEmail,
  onSubmit,
}: {
  email: string;
  pending: boolean;
  errors: FieldErrors;
  onChangeEmail: () => void;
  onSubmit: (values: { firstName: string; lastName: string; password: string }) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  // Kural listesi yalnızca şifre yazılırken görünür; admin kısayolunda kurallar geçerli değildir.
  const showChecklist = passwordFocused && password.length > 0 && email !== ADMIN_SHORTCUT;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ firstName, lastName, password });
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      <EmailChip email={email} onChange={onChangeEmail} />
      <input type="email" name="email" value={email} autoComplete="username" readOnly hidden />
      <div className="grid grid-cols-2 gap-3">
        <Input
          name="firstName"
          autoComplete="given-name"
          placeholder="Ad"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          error={errors.firstName}
          autoFocus
        />
        <Input
          name="lastName"
          autoComplete="family-name"
          placeholder="Soyad"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          error={errors.lastName}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          error={errors.password}
          {...(showChecklist && !errors.password ? { "aria-describedby": "password-rules" } : {})}
        />
        {showChecklist && <PasswordChecklist id="password-rules" password={password} />}
      </div>
      <Button type="submit" size="lg" loading={pending} className="w-full">
        Hesap oluştur
      </Button>
    </form>
  );
}

function EmailChip({ email, onChange }: { email: string; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-surface-muted px-3.5 py-2.5 text-sm">
      <span className="truncate font-medium">{email}</span>
      <button
        type="button"
        onClick={onChange}
        className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline"
      >
        <Pencil className="size-3.5" aria-hidden /> Değiştir
      </button>
    </div>
  );
}

function Notice({ tone, children }: { tone: "success" | "danger"; children: React.ReactNode }) {
  const Icon = tone === "success" ? CircleCheck : CircleAlert;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={
        tone === "success"
          ? "flex items-start gap-2 rounded-md bg-success-soft px-3.5 py-3 text-sm text-success"
          : "flex items-start gap-2 rounded-md bg-danger-soft px-3.5 py-3 text-sm text-danger"
      }
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      {children}
    </div>
  );
}
