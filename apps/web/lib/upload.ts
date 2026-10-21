import { ApiError, type ApiErrorBody, type BookSummary } from "@unicoach/shared";
import { browserApi } from "./api";

/**
 * PDF'i ham gövde olarak PUT /api/books/:id/file adresine gönderir. fetch yükleme ilerlemesi vermediği için XHR kullanılır.
 * `onProgress` gönderilen bayt sayısıyla çağrılır.
 */
export function uploadBookFile(
  id: string,
  file: File,
  onProgress: (sentBytes: number) => void,
  signal?: AbortSignal,
): Promise<BookSummary> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", browserApi.books.filePath(id));
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.setRequestHeader("Accept", "application/json");
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(xhr.response as BookSummary);
      const body = xhr.response as Partial<ApiErrorBody> | null;
      reject(new ApiError(xhr.status, typeof body?.message === "string" ? body.message : "PDF yüklenemedi."));
    };
    xhr.onerror = () => reject(new ApiError(0, "Bağlantı koptu, PDF yüklenemedi."));
    xhr.onabort = () => reject(new DOMException("Yükleme iptal edildi.", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}
