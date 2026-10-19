/**
 * API sözleşmesi ve istemci. Web ve mobil uygulama API'ye yalnızca bu istemci
 * üzerinden erişir; yeni uç noktalar önce buraya tip olarak eklenir.
 */

export const USER_ROLES = ["STUDENT", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface HealthResponse {
  status: "ok";
  database: "up" | "down";
  version: string;
  time: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  /** Örn. web sunucusunda "http://api:4000", tarayıcıda "" (aynı köken), mobilde "http://192.168.1.10:4000". */
  baseUrl: string;
  /** Giriş yapılmışsa oturum belirteci (Aşama 1). */
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
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new ApiError(res.status, body?.message ?? res.statusText);
    }
    return (await res.json()) as T;
  }

  return {
    request,
    health: (init?: RequestInit) => request<HealthResponse>("/health", init),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
