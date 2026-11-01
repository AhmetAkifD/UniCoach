/**
 * PDF görüntüleyici: pdf.js'i çalıştıran küçük bir HTML sayfası. Telefonda WebView'de
 * (components/question-bank/pdf-frame.tsx), web önizlemesinde iframe'de (pdf-frame.web.tsx) açılır;
 * iki yerde de aynı sayfa ve aynı mesajlar kullanılır. Expo Go'da yerel PDF modülü olmadığı için
 * çizim pdf.js ile yapılır (web'deki görüntüleyiciyle aynı kütüphane).
 *
 * Sayfalar alt alta dizilir, yalnızca görünenler (ve yakınındakiler) çizilir; uzaklaşan sayfanın tuvali
 * bırakılır ki büyük PDF'lerde bellek dolmasın. Dosya parça parça okunur: sunucudan Range istekleriyle ya da cihazdaki
 * kopyadan (lib/pdfjs-page.ts).
 */

import { PDFJS_OPEN, pdfjsHead, type PdfSource } from "./pdfjs-page";

export { PDFJS_CDN } from "./pdfjs-page";

/** Sayfadan uygulamaya gelen mesajlar */
export type PdfEvent =
  | { type: "loaded"; pageCount: number }
  /** Ekranın ortasındaki sayfa değişti */
  | { type: "page"; page: number }
  | { type: "error"; message: string };

/** Uygulamadan sayfaya komutlar (sayfadaki `window.uc`) */
export interface PdfFrameHandle {
  goTo(page: number): void;
}

export interface PdfViewerConfig {
  /** PDF'in kaynağı: sunucu (GET /api/books/:id/file, `Authorization: Bearer`) ya da cihazdaki kopya */
  source: PdfSource;
  /** Açılışta gösterilecek sayfa (kalınan sayfa) */
  page: number;
  /** Sayfaların arkasındaki zemin (temaya göre) */
  background: string;
}

export function pdfViewerHtml(config: PdfViewerConfig, pdfjs: { lib: string; worker: string } | null = null): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=5,user-scalable=yes">
<style>
html,body{margin:0;background:${config.background};-webkit-tap-highlight-color:transparent}
#pages{display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 0 24px}
.page{position:relative;width:calc(100vw - 16px);background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);aspect-ratio:1/1.414}
.page canvas{position:absolute;inset:0;width:100%;height:100%}
</style>
${pdfjsHead(pdfjs)}
</head><body><div id="pages"></div>
<script>
var cfg = ${JSON.stringify(config)};
${PDFJS_OPEN}
var doc = null, pages = [], rendered = {}, tasks = {}, current = 0;
function post(m) {
  var s = JSON.stringify(m);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
  else window.parent.postMessage({ uc: s }, "*");
}
window.uc = {
  pdfData: pdfData,
  goTo: function (n) {
    var el = pages[n - 1];
    if (el) el.scrollIntoView({ block: "start" });
  }
};
function render(n) {
  if (rendered[n]) return;
  rendered[n] = true;
  doc.getPage(n).then(function (page) {
    if (!rendered[n]) return;
    var el = pages[n - 1];
    var base = page.getViewport({ scale: 1 });
    el.style.aspectRatio = base.width + " / " + base.height;
    // Yakınlaştırınca bulanıklaşmasın diye ekran yoğunluğunun en az 2 katı çizilir.
    var density = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    var viewport = page.getViewport({ scale: (el.clientWidth / base.width) * density });
    var canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    el.appendChild(canvas);
    tasks[n] = page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport });
    tasks[n].promise.catch(function () {});
  });
}
function release(n) {
  if (!rendered[n]) return;
  rendered[n] = false;
  if (tasks[n]) tasks[n].cancel();
  delete tasks[n];
  var canvas = pages[n - 1].querySelector("canvas");
  if (canvas) { canvas.width = 0; canvas.height = 0; canvas.remove(); }
}
// Ekranın (yakınlaştırılmışsa görünen bölümün) ortasındaki sayfa
function updateCurrent() {
  var vv = window.visualViewport;
  var x = vv ? vv.offsetLeft + vv.width / 2 : window.innerWidth / 2;
  var y = vv ? vv.offsetTop + vv.height / 2 : window.innerHeight / 2;
  var el = document.elementFromPoint(x, y);
  var page = el && el.closest ? el.closest(".page") : null;
  if (!page) return;
  var n = Number(page.dataset.n);
  if (n !== current) { current = n; post({ type: "page", page: n }); }
}
var scheduled = false;
function onScroll() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(function () { scheduled = false; updateCurrent(); });
}
openPdf(cfg.source).then(function (d) {
  doc = d;
  return d.getPage(1);
}).then(function (first) {
  var base = first.getViewport({ scale: 1 });
  var box = document.getElementById("pages");
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var n = Number(e.target.dataset.n);
      if (e.isIntersecting) render(n); else release(n);
    });
  }, { rootMargin: "150% 0px" });
  for (var i = 1; i <= doc.numPages; i++) {
    var el = document.createElement("div");
    el.className = "page";
    el.dataset.n = String(i);
    el.style.aspectRatio = base.width + " / " + base.height;
    box.appendChild(el);
    pages.push(el);
    observer.observe(el);
  }
  post({ type: "loaded", pageCount: doc.numPages });
  var start = Math.min(Math.max(1, cfg.page), doc.numPages);
  if (start > 1) window.uc.goTo(start);
  current = start;
  post({ type: "page", page: start });
  window.addEventListener("scroll", onScroll, { passive: true });
  if (window.visualViewport) window.visualViewport.addEventListener("scroll", onScroll);
}).catch(function (err) {
  var status = err && err.status;
  post({ type: "error", message: typeof pdfjsLib === "undefined"
    ? "PDF görüntüleyicisi yüklenemedi. İnternet bağlantını kontrol et."
    : status === 404 ? "PDF dosyası bulunamadı."
    : "PDF açılamadı." });
});
</script>
</body></html>`;
}
