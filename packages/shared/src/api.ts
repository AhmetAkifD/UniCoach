/**
 * API sözleşmesi ve istemci. Web ve mobil uygulama API'ye yalnızca bu istemci
 * üzerinden erişir; yeni uç noktalar önce buraya tip olarak eklenir.
 */
import type {
  AuthResponse,
  AuthUser,
  CheckEmailInput,
  CheckEmailResponse,
  FieldErrors,
  LoginInput,
  RegisterInput,
} from "./auth";

export const USER_ROLES = ["STUDENT", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface HealthResponse {
  status: "ok";
  database: "up" | "down";
  version: string;
  time: string;
}

/** API'nin hata gövdesi. */
export interface ApiErrorBody {
  statusCode: number;
  message: string;
  errors?: FieldErrors;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: FieldErrors,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  /** Örn. web sunucusunda "http://api:4000", tarayıcıda "" (aynı köken), mobilde "http://192.168.1.10:4000". */
  baseUrl: string;
  /** Giriş yapılmışsa oturum belirteci. */
  getToken?: () => string | null | undefined;
  fetch?: typeof fetch;
}

export function createApiClient({ baseUrl, getToken, fetch: fetchImpl = fetch }: ApiClientOptions) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const token = getToken?.();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const res = await fetchImpl(`${baseUrl}/api${path}`, { ...init, headers });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as Partial<ApiErrorBody> | null;
      const message = typeof body?.message === "string" ? body.message : res.statusText;
      throw new ApiError(res.status, message, body?.errors);
    }
    return (await res.json()) as T;
  }

  const post = <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) });

  return {
    request,
    health: (init?: RequestInit) => request<HealthResponse>("/health", init),
    auth: {
      checkEmail: (input: CheckEmailInput) => post<CheckEmailResponse>("/auth/check-email", input),
      register: (input: RegisterInput) => post<AuthResponse>("/auth/register", input),
      login: (input: LoginInput) => post<AuthResponse>("/auth/login", input),
      me: () => request<AuthUser>("/auth/me", { cache: "no-store" }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
