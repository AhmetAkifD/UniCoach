/** lib/upload.ts ve upload.web.ts'in ortak tipleri (web'de "./upload" upload.web.ts'e çözüldüğü için ayrı dosyada). */

/** Yüklenecek PDF: belge seçicinin döndürdüğü dosya (web önizlemesinde `file` de vardır). */
export interface PickedPdf {
  uri: string;
  name: string;
  size: number;
  file?: File;
}

export interface UploadHandle {
  promise: Promise<import("@unicoach/shared").BookSummary>;
  cancel: () => void;
}

/** Öğrenci yüklemeyi iptal etti. */
export class UploadCancelled extends Error {
  constructor() {
    super("Yükleme iptal edildi.");
  }
}
