import { PDFJS_CDN } from "./pdf-viewer";

/**
 * Sınav sorusu görüntüleyici: pdf.js ile sorunun PDF'teki kutusunu resim olarak çizer (web'deki QuestionImage'ın
 * karşılığı). Soru ekrana sığacak kadar küçültülür (genişlik ve yükseklik), kıstırarak yakınlaştırılır. Sorular
 * arasında okla geçilir; kaydırarak geçiş bilerek yok (yakınlaştırırken yanlışlıkla soru değişmesin).
 */

export interface QuestionBox {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Sayfadan uygulamaya gelen mesajlar */
export type QuestionViewEvent = { type: "loaded" } | { type: "shown" } | { type: "error"; message: string };

export interface QuestionViewConfig {
  url: string;
  token: string | null;
  background: string;
}

/** Uygulamadan sayfaya komutlar (sayfadaki `window.uc`) */
export interface QuestionViewHandle {
  show(q: QuestionBox): void;
  /** Duraklatılmış sınavda soru gizlenir. */
  hide(): void;
}

export function questionViewHtml(config: QuestionViewConfig): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=5,user-scalable=yes">
<style>
html,body{margin:0;height:100%;background:${config.background};-webkit-user-select:none;user-select:none}
#box{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:8px;box-sizing:border-box}
canvas{background:#fff;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,.2);max-width:100%;max-height:100%;display:none}
</style>
<script src="${PDFJS_CDN}/pdf.min.js"></script>
</head><body><div id="box"><canvas id="cv"></canvas></div>
<script>
var cfg = ${JSON.stringify(config)};
var doc = null, task = null, seq = 0, pending = null;
var cv = document.getElementById("cv"), box = document.getElementById("box");
function post(m) {
  var s = JSON.stringify(m);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
  else window.parent.postMessage({ uc: s }, "*");
}
// Soru en fazla bu kadar büyütülür (küçük kutular bulanıklaşmasın); yakınlaştırınca net kalsın diye
// ekran yoğunluğunun 2–3 katı çizilir.
var MAX_SCALE = 2.4;
function show(q) {
  if (!doc) { pending = q; return; }
  var mine = ++seq;
  if (task) task.cancel();
  doc.getPage(q.page).then(function (page) {
    if (mine !== seq) return;
    var availW = box.clientWidth - 16, availH = box.clientHeight - 16;
    var fit = Math.min(availW / q.w, availH / q.h, MAX_SCALE);
    var density = Math.min(3, Math.max(2, window.devicePixelRatio || 1)) * 1.5;
    var s = fit * density;
    var viewport = page.getViewport({ scale: s, offsetX: -q.x * s, offsetY: -q.y * s });
    var next = document.createElement("canvas");
    next.width = Math.ceil(q.w * s);
    next.height = Math.ceil(q.h * s);
    next.style.width = Math.round(q.w * fit) + "px";
    next.style.height = Math.round(q.h * fit) + "px";
    task = page.render({ canvasContext: next.getContext("2d"), viewport: viewport });
    task.promise.then(function () {
      if (mine !== seq) return;
      next.id = "cv";
      next.style.display = "block";
      cv.replaceWith(next);
      cv.width = cv.height = 0;
      cv = next;
      post({ type: "shown" });
    }, function () {});
  });
}
window.uc = {
  show: show,
  hide: function () { seq++; pending = null; cv.style.display = "none"; }
};
fetch("${PDFJS_CDN}/pdf.worker.min.js").then(function (r) { return r.text(); }).then(function (code) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
}).catch(function () {
  pdfjsLib.GlobalWorkerOptions.workerSrc = "${PDFJS_CDN}/pdf.worker.min.js";
}).then(function () {
  return pdfjsLib.getDocument({
    url: cfg.url,
    httpHeaders: cfg.token ? { Authorization: "Bearer " + cfg.token } : {},
    disableAutoFetch: true,
    disableStream: true,
    rangeChunkSize: 1024 * 1024
  }).promise;
}).then(function (d) {
  doc = d;
  post({ type: "loaded" });
  if (pending) { var q = pending; pending = null; show(q); }
}).catch(function () {
  post({ type: "error", message: typeof pdfjsLib === "undefined" ? "Soru görüntüleyicisi yüklenemedi. İnternet bağlantını kontrol et." : "Soru görüntülenemedi." });
});
</script>
</body></html>`;
}
