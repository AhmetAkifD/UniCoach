import { parseYksResult, ResultParseError, type ParsedYksResult, type ResultTextItem } from "@unicoach/shared";
import { loadPdfJs, pageText } from "./pdf";

/** Sonuç belgesi tek sayfalıktır; bundan büyük dosya büyük ihtimalle yanlış seçilmiştir. */
export const RESULT_PDF_MAX_BYTES = 10 * 1024 * 1024;

/**
 * ÖSYM sonuç belgesini tarayıcıda okur. Dosya hiçbir yere yüklenmez; yalnızca ayrıştırılan
 * puanlar öğrenci onaylayınca API'ye gönderilir.
 */
export async function readResultPdf(file: File): Promise<ParsedYksResult> {
  if (file.size > RESULT_PDF_MAX_BYTES) throw new ResultParseError("Bu dosya bir sonuç belgesi için çok büyük.");
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let doc;
  try {
    doc = await task.promise;
  } catch {
    throw new ResultParseError("PDF açılamadı. Dosya bozuk ya da şifreli olabilir.");
  }
  try {
    // Sayfalar alt alta dizilir; tablo sayfa sonunda bölünse de satırlar sırayla okunur.
    const items: ResultTextItem[] = [];
    let offset = 0;
    for (let p = 1; p <= Math.min(doc.numPages, 4); p++) {
      const page = await pageText(doc, p);
      items.push(...page.items.map((i) => ({ s: i.s, x: i.x, y: i.y + offset, w: i.w })));
      offset += page.height;
    }
    if (items.length < 20) {
      throw new ResultParseError(
        "Belgede okunabilir metin yok. Ekran görüntüsü ya da taranmış belge yerine ÖSYM'nin PDF çıktısını seç.",
      );
    }
    return parseYksResult(items);
  } finally {
    void task.destroy();
  }
}
