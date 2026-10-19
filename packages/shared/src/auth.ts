import { z } from "zod";
import type { UserRole } from "./api";

/** Web oturum çerezinin adı. Mobil uygulama çerez yerine `Authorization: Bearer` kullanır. */
export const SESSION_COOKIE = "uc_session";

/**
 * Admin kısayolu: e-posta alanına ve şifreye "admin" yazılarak oluşturulan hesap ADMIN rolü alır.
 * Bu değer e-posta biçim kontrolünden ve şifre kurallarından muaftır. Rol kararı yalnızca API'de verilir.
 */
export const ADMIN_SHORTCUT = "admin";

export function isAdminShortcut(email: string, password: string): boolean {
  return email === ADMIN_SHORTCUT && password === ADMIN_SHORTCUT;
}

/** Şifre kuralları — kayıt formundaki canlı kontrol listesi ve doğrulama aynı listeyi kullanır. */
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 16;

export interface PasswordRule {
  id: "length" | "uppercase" | "digit";
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: "length",
    label: `${PASSWORD_MIN}–${PASSWORD_MAX} karakter`,
    test: (p) => p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX,
  },
  { id: "uppercase", label: "En az 1 büyük harf", test: (p) => /[A-ZÇĞİÖŞÜ]/.test(p) },
  { id: "digit", label: "En az 1 rakam", test: (p) => /\d/.test(p) },
];

const PASSWORD_RULE_ERRORS: Record<PasswordRule["id"], string> = {
  length: `Şifre ${PASSWORD_MIN}–${PASSWORD_MAX} karakter olmalı.`,
  uppercase: "Şifrede en az 1 büyük harf olmalı.",
  digit: "Şifrede en az 1 rakam olmalı.",
};

/** E-posta: biçim kontrolü yapılır; yalnızca "admin" kısayolu muaftır. */
export const emailSchema = z
  .string({ error: "E-posta adresini yaz." })
  .trim()
  .toLowerCase()
  .min(1, { error: "E-posta adresini yaz." })
  .refine((v) => v === ADMIN_SHORTCUT || z.email().safeParse(v).success, {
    error: "Geçerli bir e-posta adresi yaz.",
  });

const nameField = (label: string) =>
  z
    .string({ error: `${label} alanını doldur.` })
    .trim()
    .min(2, { error: `${label} en az 2 karakter olmalı.` })
    .max(40, { error: `${label} en fazla 40 karakter olabilir.` });

/** Giriş akışının ilk adımı ve POST /api/auth/check-email gövdesi. */
export const checkEmailSchema = z.object({ email: emailSchema });

/** Kayıt formu ve POST /api/auth/register gövdesi — web, mobil ve API aynı kuralları kullanır. */
export const registerSchema = z
  .object({
    firstName: nameField("Ad"),
    lastName: nameField("Soyad"),
    email: emailSchema,
    password: z.string({ error: "Bir şifre belirle." }).min(1, { error: "Bir şifre belirle." }),
  })
  .superRefine(({ email, password }, ctx) => {
    if (email === ADMIN_SHORTCUT) {
      if (password !== ADMIN_SHORTCUT) {
        ctx.addIssue({ code: "custom", path: ["password"], message: "Admin hesabının şifresi \"admin\" olmalı." });
      }
      return;
    }
    const failed = PASSWORD_RULES.find((rule) => !rule.test(password));
    if (failed) ctx.addIssue({ code: "custom", path: ["password"], message: PASSWORD_RULE_ERRORS[failed.id] });
  });

/** Giriş akışının şifre adımı ve POST /api/auth/login gövdesi. */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Şifreni yaz." }).min(1, { error: "Şifreni yaz." }),
});

export type CheckEmailInput = z.infer<typeof checkEmailSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface CheckEmailResponse {
  /** Bu e-postayla kayıtlı hesap varsa true → şifre adımı; yoksa kayıt adımı. */
  exists: boolean;
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  STUDENT: "Öğrenci",
  ADMIN: "Admin",
};

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

/** Doğrulama hatası yanıtı (400): alan adı → ilk hata mesajı. */
export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
