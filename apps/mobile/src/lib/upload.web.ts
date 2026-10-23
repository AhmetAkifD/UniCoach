import { ApiError, type ApiErrorBody, type BookSummary } from "@unicoach/shared";
import { api, getApiToken } from "./api";
import { UploadCancelled, type PickedPdf, type UploadHandle } from "./upload-types";

export { UploadCancelled, type PickedPdf, type UploadHandle };

/** Web önizlemesi: belge seçicinin `File` nesnesi XHR ile gönderilir (yükleme ilerlemesi için fetch yerine). */
export function uploadBookFile(id: string, pdf: PickedPdf, onProgress: (sentBytes: number) => void): UploadHandle {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<BookSummary>((resolve, reject) => {
    xhr.open("PUT", api.books.filePath(id));
    xhr.setRequestHeader("Content-Type", "application/pdf");
    xhr.setRequestHeader("Accept", "application/json");
    const token = getApiToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(xhr.response as BookSummary);
      const body = xhr.response as Partial<ApiErrorBody> | null;
      reject(new ApiError(xhr.status, typeof body?.message === "string" ? body.message : "PDF yüklenemedi."));
    };
    xhr.onerror = () => reject(new ApiError(0, "Bağlantı koptu, PDF yüklenemedi."));
    xhr.onabort = () => reject(new UploadCancelled());
    xhr.send(pdf.file ?? null);
  });
  return { promise, cancel: () => xhr.abort() };
}
