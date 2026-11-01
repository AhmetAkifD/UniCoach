import type { ResultTextItem } from "@unicoach/shared";
import { PDFJS_CDN } from "./pdf-viewer";

/**
 * ÖSYM sonuç belgesini cihazda okuma (web'deki lib/yks-result-pdf.ts'in karşılığı). Belge hiçbir yere yüklenmez:
 * dosyanın baytları görünmeyen bir pdf.js sayfasına verilir, sayfa metin parçalarını geri gönderir, ayrıştırma
 * (`parseYksResult`) uygulamada yapılır.
 */

/** Sonuç belgesi tek sayfalıktır; bundan büyük dosya büyük ihtimalle yanlış seçilmiştir. */
export const RESULT_PDF_MAX_BYTES = 10 * 1024 * 1024;

/** Sayfadan uygulamaya gelen mesajlar */
export type ResultPdfEvent = { type: "ready" } | { type: "items"; items: ResultTextItem[] } | { type: "error"; message: string };

/** Uygulamadan sayfaya: `window.uc.read(base64)` */
export function resultPdfHtml(): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><script src="${PDFJS_CDN}/pdf.min.js"></script></head><body>
<script>
function post(m) {
  var s = JSON.stringify(m);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
  else window.parent.postMessage({ uc: s }, "*");
}
var ready = fetch("${PDFJS_CDN}/pdf.worker.min.js").then(function (r) { return r.text(); }).then(function (code) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
}).catch(function () {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "${PDFJS_CDN}/pdf.worker.min.js";
});
ready.then(function () { post({ type: "ready" }); });
// Sayfalar alt alta dizilir; tablo sayfa sonunda bölünse de satırlar sırayla okunur (web'deki readResultPdf ile aynı).
function pageItems(doc, n, offset) {
  return doc.getPage(n).then(function (page) {
    var viewport = page.getViewport({ scale: 1 });
    return page.getTextContent().then(function (content) {
      var items = [];
      content.items.forEach(function (item) {
        if (!("str" in item) || !item.str.trim()) return;
        var t = item.transform;
        if (Math.abs(t[1]) > 0.01 || Math.abs(t[2]) > 0.01) return;
        var h = item.height || Math.abs(t[3]);
        items.push({ s: item.str, x: t[4], y: viewport.height - t[5] - h + offset, w: item.width || Math.abs(t[0]) * item.str.length * 0.5 });
      });
      return { items: items, height: viewport.height };
    });
  });
}
window.uc = {
  read: function (base64) {
    ready.then(function () {
      var raw = atob(base64), bytes = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      return pdfjsLib.getDocument({ data: bytes }).promise.catch(function () {
        throw new Error("PDF açılamadı. Dosya bozuk ya da şifreli olabilir.");
      });
    }).then(function (doc) {
      var all = [], offset = 0, n = 1, last = Math.min(doc.numPages, 4);
      function next() {
        if (n > last) return all;
        return pageItems(doc, n, offset).then(function (r) {
          all = all.concat(r.items); offset += r.height; n++;
          return next();
        });
      }
      return next();
    }).then(function (items) {
      post({ type: "items", items: items });
    }, function (err) {
      post({ type: "error", message: (err && err.message) || "Belge okunamadı." });
    });
  }
};
</script></body></html>`;
}

export { toBase64 } from "./base64";
