/**
 * API sözleşmesi ve istemci. Web ve mobil uygulama API'ye yalnızca bu istemci
 * üzerinden erişir; yeni uç noktalar önce buraya tip olarak eklenir.
 */
import type {
  AuthResponse,
  AuthUser,
  ChangePasswordInput,
  CheckEmailInput,
  CheckEmailResponse,
  DeleteAccountInput,
  FieldErrors,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from "./auth";
import type {
  CreateSourceInput,
  ProgressInput,
  SourceDetail,
  SourceItem,
  SourceSummary,
  UpdateSourceInput,
} from "./library";
import type {
  BookProgressInput,
  BookQuestion,
  BookSummary,
  CreateBookInput,
  SaveBookQuestionsInput,
  UpdateBookInput,
} from "./question-bank";
import type { CreateExamInput, ExamAnswerInput, ExamDetail, ExamQuestion, ExamSummary, ExtendExamInput } from "./exam-session";
import type { SaveYksResultInput, YksResult } from "./yks-result";
import type { ProgramFilterOptions, ProgramPage, ProgramSearchInput } from "./programs";
import type { PreferenceItem } from "./preferences";
import type {
  AddNotePageInput,
  NotebookDetail,
  NotebookInput,
  NotebookSummary,
  NotePage,
  NotePageRef,
  SaveNotePageInput,
} from "./notebooks";
import type { SyncPullResponse } from "./sync";

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
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  const send = <T>(method: string, path: string, body?: unknown) =>
    request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const post = <T>(path: string, body: unknown) => send<T>("POST", path, body);

  return {
    request,
    health: (init?: RequestInit) => request<HealthResponse>("/health", init),
    auth: {
      checkEmail: (input: CheckEmailInput) => post<CheckEmailResponse>("/auth/check-email", input),
      register: (input: RegisterInput) => post<AuthResponse>("/auth/register", input),
      login: (input: LoginInput) => post<AuthResponse>("/auth/login", input),
      me: () => request<AuthUser>("/auth/me", { cache: "no-store" }),
      updateProfile: (input: UpdateProfileInput) => send<AuthUser>("PATCH", "/auth/me", input),
      changePassword: (input: ChangePasswordInput) => send<void>("PUT", "/auth/me/password", input),
      /** Hesabı ve bütün verilerini (kaynaklar, PDF'ler, sınavlar, defterler…) siler. */
      deleteAccount: (input: DeleteAccountInput) => send<void>("DELETE", "/auth/me", input),
      /**
       * Profil fotoğrafı. Yükleme bu istemciyle gönderilmez: gövde ham JPEG'dir (`Content-Type: image/jpeg`),
       * web `fetch` ile (mobil kendi dosya API'siyle) `avatarPath` adresine `PUT` eder.
       */
      removeAvatar: () => send<AuthUser>("DELETE", "/auth/me/avatar"),
      avatarPath: `${baseUrl}/api/auth/me/avatar`,
    },
    sources: {
      list: () => request<SourceSummary[]>("/sources", { cache: "no-store" }),
      get: (id: string) => request<SourceDetail>(`/sources/${encodeURIComponent(id)}`, { cache: "no-store" }),
      create: (input: CreateSourceInput) => post<SourceSummary>("/sources", input),
      update: (id: string, input: UpdateSourceInput) =>
        send<SourceSummary>("PATCH", `/sources/${encodeURIComponent(id)}`, input),
      remove: (id: string) => send<void>("DELETE", `/sources/${encodeURIComponent(id)}`),
      saveProgress: (id: string, itemId: string, input: ProgressInput) =>
        send<SourceItem>(
          "PUT",
          `/sources/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/progress`,
          input,
        ),
    },
    /**
     * Soru Bankası. Dosyanın kendisi bu istemciyle gönderilmez: yükleme ilerlemesi gösterilebilsin diye
     * web XHR ile (mobil kendi dosya API'siyle) `filePath(id)` adresine `PUT`, gövde ham PDF olarak gönderir.
     */
    books: {
      list: () => request<BookSummary[]>("/books", { cache: "no-store" }),
      get: (id: string) => request<BookSummary>(`/books/${encodeURIComponent(id)}`, { cache: "no-store" }),
      create: (input: CreateBookInput) => post<BookSummary>("/books", input),
      update: (id: string, input: UpdateBookInput) => send<BookSummary>("PATCH", `/books/${encodeURIComponent(id)}`, input),
      remove: (id: string) => send<void>("DELETE", `/books/${encodeURIComponent(id)}`),
      saveProgress: (id: string, input: BookProgressInput) =>
        send<BookSummary>("PUT", `/books/${encodeURIComponent(id)}/progress`, input),
      questions: (id: string) =>
        request<BookQuestion[]>(`/books/${encodeURIComponent(id)}/questions`, { cache: "no-store" }),
      saveQuestions: (id: string, input: SaveBookQuestionsInput) =>
        send<BookQuestion[]>("PUT", `/books/${encodeURIComponent(id)}/questions`, input),
      /** PDF dosyasının adresi (GET: indirme/Range ile okuma, PUT: yükleme). */
      filePath: (id: string) => `${baseUrl}/api/books/${encodeURIComponent(id)}/file`,
    },
    /** Geçmiş Sınavlar: Soru Bankası'nda çıkarılan testlerden süreli deneme. */
    exams: {
      list: () => request<ExamSummary[]>("/exams", { cache: "no-store" }),
      get: (id: string) => request<ExamDetail>(`/exams/${encodeURIComponent(id)}`, { cache: "no-store" }),
      create: (input: CreateExamInput) => post<ExamDetail>("/exams", input),
      answer: (id: string, questionId: string, input: ExamAnswerInput) =>
        send<ExamQuestion>("PUT", `/exams/${encodeURIComponent(id)}/answers/${encodeURIComponent(questionId)}`, input),
      finish: (id: string) => send<ExamDetail>("POST", `/exams/${encodeURIComponent(id)}/finish`),
      pause: (id: string) => send<ExamDetail>("POST", `/exams/${encodeURIComponent(id)}/pause`),
      /** Devam ettirir; sorular kaynaktan (Soru Bankası) yeniden okunur, düzeltmeler sınava yansır. */
      resume: (id: string) => send<ExamDetail>("POST", `/exams/${encodeURIComponent(id)}/resume`),
      extend: (id: string, input: ExtendExamInput) => send<ExamDetail>("POST", `/exams/${encodeURIComponent(id)}/extend`, input),
      /** Bitmiş sınavı kaynaktaki düzeltmelerle yeniden hesaplar. */
      sync: (id: string) => send<ExamDetail>("POST", `/exams/${encodeURIComponent(id)}/sync`),
      remove: (id: string) => send<void>("DELETE", `/exams/${encodeURIComponent(id)}`),
    },
    /** YKS Tercih: sınav sonuçları (yıl başına bir kayıt; aynı yıl yeniden kaydedilince üzerine yazılır). */
    results: {
      list: () => request<YksResult[]>("/results", { cache: "no-store" }),
      save: (year: number, input: SaveYksResultInput) => send<YksResult>("PUT", `/results/${year}`, input),
      remove: (year: number) => send<void>("DELETE", `/results/${year}`),
    },
    /** YKS Tercih: üniversite programları; `source` ile indirilmiş veri ya da canlı YÖK Atlas. */
    programs: {
      filters: () => request<ProgramFilterOptions>("/programs/filters", { cache: "no-store" }),
      search: (input: ProgramSearchInput) => post<ProgramPage>("/programs/search", input),
      /** Yalnızca admin; indirme arka planda sürer. */
      sync: () => send<void>("POST", "/programs/sync"),
    },
    /** YKS Tercih listesi (en fazla 24); değiştiren her çağrı listenin son hâlini döndürür. */
    preferences: {
      list: () => request<PreferenceItem[]>("/preferences", { cache: "no-store" }),
      add: (code: number) => post<PreferenceItem[]>("/preferences", { code }),
      reorder: (codes: number[]) => send<PreferenceItem[]>("PUT", "/preferences/order", { codes }),
      remove: (code: number) => send<PreferenceItem[]>("DELETE", `/preferences/${code}`),
    },
    /** Çalışma alanı: not defterleri ve sayfaları (sayfa içeriği tek tek okunur ve kaydedilir). */
    notebooks: {
      list: () => request<NotebookSummary[]>("/notebooks", { cache: "no-store" }),
      get: (id: string) => request<NotebookDetail>(`/notebooks/${encodeURIComponent(id)}`, { cache: "no-store" }),
      create: (input: NotebookInput) => post<NotebookDetail>("/notebooks", input),
      update: (id: string, input: NotebookInput) => send<NotebookDetail>("PATCH", `/notebooks/${encodeURIComponent(id)}`, input),
      remove: (id: string) => send<void>("DELETE", `/notebooks/${encodeURIComponent(id)}`),
      page: (id: string, pageId: string) =>
        request<NotePage>(`/notebooks/${encodeURIComponent(id)}/pages/${encodeURIComponent(pageId)}`, { cache: "no-store" }),
      addPage: (id: string, input: AddNotePageInput) => post<NotebookDetail>(`/notebooks/${encodeURIComponent(id)}/pages`, input),
      savePage: (id: string, pageId: string, input: SaveNotePageInput) =>
        send<NotePageRef>("PUT", `/notebooks/${encodeURIComponent(id)}/pages/${encodeURIComponent(pageId)}`, input),
      removePage: (id: string, pageId: string) =>
        send<NotebookDetail>("DELETE", `/notebooks/${encodeURIComponent(id)}/pages/${encodeURIComponent(pageId)}`),
      /** Sayfa kaydının adresi (sayfadan çıkarken keepalive ile göndermek için) */
      pagePath: (id: string, pageId: string) =>
        `${baseUrl}/api/notebooks/${encodeURIComponent(id)}/pages/${encodeURIComponent(pageId)}`,
    },
    /** Cihazlar arası eşitleme (mobil çevrimdışı kopya) */
    sync: {
      pull: (since: number) => request<SyncPullResponse>(`/sync/pull?since=${since}`, { cache: "no-store" }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
