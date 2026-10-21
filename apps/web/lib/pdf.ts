import type * as PdfJs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

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

/** Sayfanın metin katmanı, soru bulma için (yalnızca yatay metin; eğik filigranlar atlanır). */
export async function pageText(doc: PDFDocumentProxy, pageNumber: number) {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = content.items.flatMap((item) => {
    if (!("str" in item) || !item.str.trim()) return [];
    const [a, b, c, d, e, f] = item.transform as number[];
    if (Math.abs(b!) > 0.01 || Math.abs(c!) > 0.01) return [];
    const h = item.height || Math.abs(d!);
    // pdf.js koordinatları sol alttan, taban çizgisinde; sol üstten üst kenara çevrilir.
    return [{ s: item.str, x: e!, y: viewport.height - f! - h, w: item.width || Math.abs(a!) * item.str.length * 0.5, h }];
  });
  return { page: pageNumber, width: viewport.width, height: viewport.height, items };
}
