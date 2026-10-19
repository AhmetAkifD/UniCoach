"use server";

import { redirect } from "next/navigation";
import {
  ApiError,
  checkEmailSchema,
  fieldErrors,
  loginSchema,
  registerSchema,
  type FieldErrors,
  type LoginInput,
  type RegisterInput,
} from "@unicoach/shared";
import { serverApi } from "@/lib/api";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";

export interface ActionResult {
  /** Forma genel hata (ör. "E-posta veya şifre hatalı"). */
  error?: string;
  fieldErrors?: FieldErrors;
}

function failure(err: unknown): ActionResult {
  if (err instanceof ApiError) {
    return err.errors ? { fieldErrors: err.errors } : { error: err.message };
  }
  console.error(err);
  return { error: "Sunucuya ulaşılamadı. Biraz sonra tekrar dene." };
}

/** 1. adım: e-posta kayıtlı mı? */
export async function checkEmailAction(email: string): Promise<ActionResult & { exists?: boolean; email?: string }> {
  const parsed = checkEmailSchema.safeParse({ email });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  try {
    const { exists } = await serverApi.auth.checkEmail(parsed.data);
    return { exists, email: parsed.data.email };
  } catch (err) {
    return failure(err);
  }
}

/** Kayıt adımı. Oturum açmaz: kullanıcı ardından şifre adımında giriş yapar. */
export async function registerAction(input: RegisterInput): Promise<ActionResult & { ok?: boolean }> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  try {
    await serverApi.auth.register(parsed.data);
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

/** Şifre adımı: başarılıysa oturum çerezini yazar ve ana sayfaya yönlendirir. */
export async function loginAction(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  try {
    const { accessToken } = await serverApi.auth.login(parsed.data);
    await setSessionCookie(accessToken);
  } catch (err) {
    return failure(err);
  }
  redirect("/");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/giris");
}
