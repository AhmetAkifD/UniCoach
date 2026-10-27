/**
 * pdf.js'i çalıştıran görüntüleyici sayfalarının ortak parçaları (PDF görüntüleyici, soru düzenleyici, sınav sorusu).
 *
 * - pdf.js: cihazda saklıysa sayfaya gömülür (internet yokken de çalışsın), değilse CDN'den yüklenir.
 * - PDF: sunucudan Range istekleriyle (`Authorization: Bearer`) ya da cihazdaki kopyadan okunur. Cihazdaki kopyada
 *   sayfa ihtiyaç duyduğu parçayı uygulamaya sorar (`{ type: "pdfRange", begin, end }`), uygulama dosyadan okuyup
 *   `window.uc.pdfData(begin, base64)` ile verir (components/pdf-page-frame.tsx). Büyük PDF'ler de parça parça okunur.
 */

/** cdnjs'teki pdf.js sürümü (klasik betik; eski WebView'lerde de çalışır). */
export const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

/** Cihazdaki kopyanın parça boyutu: pdf.js parçaları bu sınırlarla ister, uygulama da bu boyutta verir. */
export const LOCAL_CHUNK = 512 * 1024;

/** PDF nereden okunur: sunucu (adres + belirteç) ya da cihazdaki kopya (yalnızca boyutu sayfaya gider). */
export type PdfSource = { url: string; token: string | null } | { size: number };

/** Uygulamanın sayfaya parça istediği mesaj */
export interface PdfRangeRequest {
  type: "pdfRange";
  begin: number;
  end: number;
}

const inline = (code: string) => code.replace(/<\/script/gi, "<\\/script");

/** `<head>` içine: pdf.js (gömülü ya da CDN) ve gömülüyse worker'ın kodu. */
export function pdfjsHead(assets: { lib: string; worker: string } | null): string {
  if (!assets) return `<script src="${PDFJS_CDN}/pdf.min.js"></script>`;
  return `<script>${inline(assets.lib)}</script>\n<script type="text/plain" id="pdfjs-worker">${inline(assets.worker)}</script>`;
}

/**
 * Sayfa betiğine: `openPdf(source)` belgeyi açar (söz verir), `pdfData(begin, base64)` cihazdaki kopyadan gelen
 * parçayı pdf.js'e verir (sayfa `window.uc.pdfData` olarak açar). `post` sayfada tanımlı olmalı.
 */
export const PDFJS_OPEN = `
// Worker başka kökenden doğrudan açılamaz; kodu bu sayfanın kökeninde çalıştırılır (gömülüyse sayfadan, değilse CDN'den).
function setupPdfjsWorker() {
  var embedded = document.getElementById("pdfjs-worker");
  if (embedded) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([embedded.textContent], { type: "text/javascript" }));
    return Promise.resolve();
  }
  return fetch("${PDFJS_CDN}/pdf.worker.min.js").then(function (r) { return r.text(); }).then(function (code) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  }).catch(function () {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "${PDFJS_CDN}/pdf.worker.min.js";
  });
}
var pdfRange = null;
function openPdf(source) {
  return setupPdfjsWorker().then(function () {
    if (source.size) {
      pdfRange = new pdfjsLib.PDFDataRangeTransport(source.size, new Uint8Array(0));
      pdfRange.requestDataRange = function (begin, end) { post({ type: "pdfRange", begin: begin, end: end }); };
      return pdfjsLib.getDocument({ range: pdfRange, length: source.size, disableAutoFetch: true, disableStream: true, rangeChunkSize: ${LOCAL_CHUNK} }).promise;
    }
    return pdfjsLib.getDocument({
      url: source.url,
      httpHeaders: source.token ? { Authorization: "Bearer " + source.token } : {},
      disableAutoFetch: true,
      disableStream: true,
      rangeChunkSize: 1024 * 1024
    }).promise;
  });
}
function pdfData(begin, base64) {
  var raw = atob(base64), bytes = new Uint8Array(raw.length);
  for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  if (pdfRange) pdfRange.onDataRange(begin, bytes);
}
`;
