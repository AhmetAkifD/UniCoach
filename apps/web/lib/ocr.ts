import type { Worker } from "tesseract.js";
import type { PDFDocumentProxy } from "./pdf";
import type { PageText } from "./question-detect";

/** Taranmış sayfa bu ölçekte (≈216 dpi) resme çevrilip okunur; daha küçüğünde Türkçe harfler bozuluyor. */
const OCR_SCALE = 3;

let workerPromise: Promise<Worker> | null = null;

/**
 * Tesseract (ücretsiz, tarayıcıda çalışır). İlk kullanımda Türkçe dil verisi (~5 MB) indirilir.
 * Okunan metin yalnızca öneridir; öğrenci düzenleyicide düzeltir.
 */
function getWorker(): Promise<Worker> {
  workerPromise ??= import("tesseract.js").then(({ createWorker }) => createWorker("tur"));
  return workerPromise;
}

export async function terminateOcr() {
  const worker = await workerPromise;
  workerPromise = null;
  await worker?.terminate();
}

/** Metin katmanı olmayan sayfayı OCR ile okur; kelimeleri PDF noktası cinsinden soru bulucunun biçimine çevirir. */
export async function ocrPageText(doc: PDFDocumentProxy, pageNumber: number): Promise<PageText> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: OCR_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvas, viewport }).promise;

  const worker = await getWorker();
  const { data } = await worker.recognize(canvas, {}, { blocks: true });
  const words = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)));
  const items = words
    .filter((w) => w.text.trim() && w.confidence > 20)
    .map((w) => ({
      s: w.text.trim(),
      x: w.bbox.x0 / OCR_SCALE,
      y: w.bbox.y0 / OCR_SCALE,
      w: (w.bbox.x1 - w.bbox.x0) / OCR_SCALE,
      h: (w.bbox.y1 - w.bbox.y0) / OCR_SCALE,
    }));
  canvas.width = canvas.height = 0;
  return { page: pageNumber, width: base.width, height: base.height, items };
}
