import { useImperativeHandle, useRef } from "react";
import { api, getApiToken, syncEngine } from "@/lib/api";
import { offlineBook, readBookRange } from "@/lib/offline-files";
import { LOCAL_CHUNK, type PdfRangeRequest, type PdfSource } from "@/lib/pdfjs-page";
import { PageFrame, type PageFrameHandle, type PageFrameProps } from "./page-frame";

/** Bir PDF'in kaynağı: cihazda indirilmiş kopyası varsa o (internet ve sunucu gerekmez), yoksa sunucu. */
export function bookPdfSource(bookId: string): { source: PdfSource; file: { uri: string; size: number } | null } {
  const file = offlineBook(bookId);
  return file ? { source: { size: file.size }, file } : { source: { url: api.books.filePath(bookId), token: getApiToken() }, file: null };
}

/** PDF açılamadıysa: sunucuya ulaşılamıyor ve PDF cihazda değilse ne yapılacağı söylenir. */
export function pdfErrorText(file: unknown, message: string): string {
  return !file && syncEngine.getState().connection === "offline"
    ? "Bu PDF bu cihaza indirilmemiş. Çevrimdışı açmak için sunucuya bağlıyken PDF bilgilerinden \"Çevrimdışı kullan\"ı aç."
    : message;
}

/**
 * pdf.js sayfası çalıştıran görünüm (PageFrame) + cihazdaki PDF'ten parça verme: sayfa `pdfRange` isteyince dosyadan
 * `LOCAL_CHUNK` boyutlu parçalar okunur ve `uc.pdfData` ile verilir. Diğer mesajlar `onMessage`'a gider.
 */
export function PdfPageFrame({ file, onMessage, ref, ...props }: PageFrameProps & { file: { uri: string } | null }) {
  const frameRef = useRef<PageFrameHandle>(null);
  useImperativeHandle(ref, () => ({ call: (method, ...args) => frameRef.current?.call(method, ...args) }));

  async function serve({ begin, end }: PdfRangeRequest) {
    if (!file) return;
    // pdf.js parçaları LOCAL_CHUNK sınırlarıyla ister ve öyle bekler; büyük istek parça parça verilir.
    for (let at = begin; at < end; at += LOCAL_CHUNK) {
      const piece = await readBookRange(file.uri, at, Math.min(end, at + LOCAL_CHUNK)).catch(() => null);
      if (piece === null) return;
      frameRef.current?.call("pdfData", at, piece);
    }
  }

  return (
    <PageFrame
      {...props}
      ref={frameRef}
      onMessage={(m) => {
        if ((m as { type?: string }).type === "pdfRange") void serve(m as PdfRangeRequest);
        else onMessage(m);
      }}
    />
  );
}
