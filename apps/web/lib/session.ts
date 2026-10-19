import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, createApiClient, SESSION_COOKIE, type AuthUser } from "@unicoach/shared";

const API_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // API belirteciyle aynı: 7 gün

/** Sunucu tarafında, oturum çerezindeki belirteçle API'ye giden istemci. */
export async function authedApi() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return createApiClient({ baseUrl: API_URL, getToken: () => token });
}

/** Geçerli kullanıcı; giriş yapılmamışsa veya oturum geçersizse null. İstek başına bir kez çağrılır. */
export const getSession = cache(async (): Promise<AuthUser | null> => {
  if (!(await cookies()).has(SESSION_COOKIE)) return null;
  try {
    return await (await authedApi()).auth.me();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
});

/** Giriş gerektiren sayfalarda kullanılır. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getSession();
  if (!user) redirect("/giris");
  return user;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    // Yerelde http üzerinden çalıştığımız için varsayılan kapalı; HTTPS'te COOKIE_SECURE=true yapın.
    secure: process.env.COOKIE_SECURE === "true",
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
