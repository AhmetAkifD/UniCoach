import { File } from "expo-file-system";
import { ApiError, type ApiErrorBody, type BookSummary } from "@unicoach/shared";
import { api, getApiToken } from "./api";
import { UploadCancelled, type PickedPdf, type UploadHandle } from "./upload-types";

export { UploadCancelled, type PickedPdf, type UploadHandle };

/**
 * PDF'i ham gövde olarak PUT /api/books/:id/file adresine gönderir (web'deki lib/upload.ts'in karşılığı).
 * Dosya bellekte toplanmaz, diskten akar; `onProgress` gönderilen bayt sayısıyla çağrılır.
 * expo-file-system'in yeni API'si kullanılır ve dosya belge seçicinin verdiği `content://` adresinden okunur:
 * Expo Go uygulamaya yalnızca kendi klasörlerini açtığı için seçicinin önbelleğe kopyası okunamıyor.
 */
export function uploadBookFile(id: string, pdf: PickedPdf, onProgress: (sentBytes: number) => void): UploadHandle {
  const token = getApiToken();
  const task = new File(pdf.uri).createUploadTask(api.books.filePath(id), {
    httpMethod: "PUT",
    mimeType: "application/pdf",
    headers: {
      "Content-Type": "application/pdf",
      Accept: "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    onProgress: (p) => onProgress(p.bytesSent),
  });
  let cancelled = false;
  const promise = task.uploadAsync().then(
    (res) => {
      let body: unknown = null;
      try {
        body = JSON.parse(res.body);
      } catch {
        // Gövde JSON değilse aşağıdaki genel ileti kullanılır.
      }
      if (res.status >= 200 && res.status < 300) return body as BookSummary;
      const message = (body as Partial<ApiErrorBody> | null)?.message;
      throw new ApiError(res.status, typeof message === "string" ? message : "PDF yüklenemedi.");
    },
    (err: unknown) => {
      if (cancelled) throw new UploadCancelled();
      throw err instanceof Error ? new ApiError(0, "Bağlantı koptu, PDF yüklenemedi.") : err;
    },
  );
  return {
    promise,
    cancel: () => {
      cancelled = true;
      task.cancel();
    },
  };
}
