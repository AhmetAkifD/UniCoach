import type * as PdfJs from "pdfjs-dist";

export type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

let pdfjsPromise: Promise<typeof PdfJs> | null = null;

/** pdf.js yalnızca tarayıcıda, ilk ihtiyaçta yüklenir; ayrıştırma ayrı bir worker'da çalışır. */
export function loadPdfJs(): Promise<typeof PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return pdfjs;
  });
  return pdfjsPromise;
}

/**
 * Büyük PDF'ler tamamı indirilmeden açılır: Range istekleriyle yalnızca gösterilen sayfaların verisi alınır.
 * Oturum çerezi aynı kökene kendiliğinden gider.
 */
export async function openPdf(url: string) {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({
    url,
    disableAutoFetch: true,
    disableStream: true,
    rangeChunkSize: 1024 * 1024,
  });
}
