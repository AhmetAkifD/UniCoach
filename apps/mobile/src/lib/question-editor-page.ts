import type { PageText, QuestionRect } from "@unicoach/shared";
import { PDFJS_CDN } from "./pdf-viewer";

/**
 * Soru düzenleyicisinin sayfası: pdf.js ile tek bir PDF sayfasını çizer, soru kutularını üstünde gösterir ve
 * parmakla kutu çizme/taşıma/boyutlandırmayı yapar. Soru bulma için sayfanın metin katmanını (web'deki
 * lib/pdf.ts `pageText` ile aynı biçimde) ve taranmış sayfalarda Tesseract OCR sonucunu (web'deki lib/ocr.ts ile
 * aynı ayarlar) döndürür. Soruların kendisi uygulamada tutulur; sayfa yalnızca çizer ve olayları bildirir.
 *
 * Kipler: "pan" (varsayılan) — parmak sayfayı kaydırır ve yakınlaştırır, kutuya dokunmak onu seçer, kutu
 * sürüklenerek taşınır; "draw" — boş yerde sürüklemek yeni kutu çizer.
 */

/** Web'deki tesseract.js sürümü (apps/web/package.json) */
const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js";

export type EditorMode = "pan" | "draw";

/** Sayfada gösterilen kutu */
export interface EditorBox extends QuestionRect {
  key: string;
  number: number;
  answer: string | null;
  tone: "normal" | "selected" | "duplicate";
}

/** Sayfadan uygulamaya gelen mesajlar */
export type EditorPageEvent =
  | { type: "loaded"; pageCount: number }
  /** Sayfa çizildi (boyutlar PDF noktası) */
  | { type: "page"; page: number; width: number; height: number }
  | { type: "select"; key: string | null }
  /** Kutu taşındı ya da boyutlandırıldı */
  | { type: "change"; key: string; rect: QuestionRect }
  /** Yeni kutu çizildi */
  | { type: "draw"; rect: QuestionRect }
  | { type: "error"; message: string }
  /** `read` isteğinin yanıtı */
  | { type: "text"; id: number; data?: PageText; message?: string };

export interface EditorPageConfig {
  url: string;
  token: string | null;
  page: number;
  background: string;
  colors: { primary: string; info: string; danger: string; onPrimary: string };
}

/** Uygulamadan sayfaya komutlar (sayfadaki `window.uc`) */
export interface EditorPageHandle {
  show(page: number): void;
  setBoxes(boxes: EditorBox[]): void;
  setMode(mode: EditorMode): void;
  /** Sayfanın metni; `ocr` true ise sayfa resme çevrilip metin tanımayla okunur. Yanıt `text` olayıyla gelir. */
  read(id: number, page: number, ocr: boolean): void;
}

export function questionEditorHtml(config: EditorPageConfig): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=4,user-scalable=yes">
<style>
html,body{margin:0;background:${config.background};-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
#wrap{padding:8px}
#page{position:relative;width:100%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);aspect-ratio:1/1.414}
#page canvas{position:absolute;inset:0;width:100%;height:100%}
#layer{position:absolute;inset:0;touch-action:pan-x pan-y pinch-zoom}
body.draw #layer{touch-action:none}
.box{position:absolute;border:2px solid var(--c);background:color-mix(in srgb,var(--c) 8%,transparent);box-sizing:border-box;touch-action:none}
.box .tag{position:absolute;left:-2px;top:-2px;background:var(--c);color:#fff;font:600 12px/1 system-ui,sans-serif;padding:3px 5px;border-bottom-right-radius:6px;pointer-events:none}
.box .tag i{font-style:normal;opacity:.8;margin-left:4px}
.h{position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:var(--c);border:2px solid #fff;box-sizing:border-box;touch-action:none}
#ghost{position:absolute;border:2px dashed ${config.colors.primary};background:color-mix(in srgb,${config.colors.primary} 10%,transparent);display:none;pointer-events:none}
</style>
<script src="${PDFJS_CDN}/pdf.min.js"></script>
</head><body>
<div id="wrap"><div id="page"><canvas id="cv"></canvas><div id="layer"><div id="ghost"></div></div></div></div>
<script>
var cfg = ${JSON.stringify(config)};
var colors = { normal: cfg.colors.info, selected: cfg.colors.primary, duplicate: cfg.colors.danger };
var doc = null, current = 0, size = null, boxes = [], mode = "pan", renderTask = null, drag = null, ocrWorker = null;
var pageEl = document.getElementById("page"), layer = document.getElementById("layer"), ghost = document.getElementById("ghost"), cv = document.getElementById("cv");
function post(m) {
  var s = JSON.stringify(m);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
  else window.parent.postMessage({ uc: s }, "*");
}
function scale() { return size ? pageEl.clientWidth / size.w : 1; }
function round(n) { return Math.round(n * 10) / 10; }

// --- Sayfa ---
function show(n) {
  if (!doc) return;
  current = n;
  if (renderTask) renderTask.cancel();
  doc.getPage(n).then(function (page) {
    if (current !== n) return;
    var base = page.getViewport({ scale: 1 });
    size = { w: base.width, h: base.height };
    pageEl.style.aspectRatio = base.width + " / " + base.height;
    drawBoxes();
    var density = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    var viewport = page.getViewport({ scale: (pageEl.clientWidth / base.width) * density });
    cv.width = Math.floor(viewport.width);
    cv.height = Math.floor(viewport.height);
    renderTask = page.render({ canvasContext: cv.getContext("2d"), viewport: viewport });
    renderTask.promise.then(function () {
      post({ type: "page", page: n, width: base.width, height: base.height });
    }, function () {});
  });
}

// --- Kutular ---
function drawBoxes() {
  var k = scale();
  layer.querySelectorAll(".box").forEach(function (el) { el.remove(); });
  boxes.forEach(function (b) {
    var el = document.createElement("div");
    el.className = "box";
    el.dataset.key = b.key;
    el.style.setProperty("--c", colors[b.tone]);
    place(el, b, k);
    var tag = document.createElement("span");
    tag.className = "tag";
    tag.innerHTML = b.number + "<i>" + (b.answer || "?") + "</i>";
    el.appendChild(tag);
    if (b.tone === "selected") {
      ["nw", "ne", "sw", "se"].forEach(function (edge) {
        var h = document.createElement("span");
        h.className = "h";
        h.dataset.edge = edge;
        h.style.left = edge.indexOf("w") >= 0 ? "0" : "100%";
        h.style.top = edge.indexOf("n") >= 0 ? "0" : "100%";
        el.appendChild(h);
      });
    }
    layer.appendChild(el);
  });
}
function place(el, r, k) {
  el.style.left = r.x * k + "px";
  el.style.top = r.y * k + "px";
  el.style.width = r.w * k + "px";
  el.style.height = r.h * k + "px";
}
function point(e) {
  var rect = layer.getBoundingClientRect(), k = scale();
  return {
    x: Math.min(Math.max(0, (e.clientX - rect.left) / k), size.w),
    y: Math.min(Math.max(0, (e.clientY - rect.top) / k), size.h)
  };
}
// Parmak kutunun dışına kaysa da sürükleme sürsün (yakalama başarısız olursa sürükleme yine çalışır).
function capture(e) {
  try { layer.setPointerCapture(e.pointerId); } catch (err) {}
}
function normalize(a, b) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}
layer.addEventListener("pointerdown", function (e) {
  if (!size || drag) return;
  var boxEl = e.target.closest ? e.target.closest(".box") : null;
  var edge = e.target.dataset ? e.target.dataset.edge : null;
  var p = point(e);
  if (boxEl) {
    var b = boxes.find(function (x) { return x.key === boxEl.dataset.key; });
    if (!b) return;
    capture(e);
    drag = { kind: edge ? "resize" : "move", key: b.key, edge: edge, start: p, orig: { x: b.x, y: b.y, w: b.w, h: b.h }, el: boxEl, moved: false, id: e.pointerId };
  } else if (mode === "draw") {
    capture(e);
    drag = { kind: "draw", start: p, moved: false, id: e.pointerId };
  } else {
    drag = { kind: "tap", start: p, moved: false, id: e.pointerId };
  }
});
layer.addEventListener("pointermove", function (e) {
  if (!drag || e.pointerId !== drag.id) return;
  var p = point(e), k = scale();
  if (Math.abs(p.x - drag.start.x) * k > 6 || Math.abs(p.y - drag.start.y) * k > 6) drag.moved = true;
  if (!drag.moved) return;
  if (drag.kind === "draw") {
    ghost.style.display = "block";
    place(ghost, normalize(drag.start, p), k);
  } else if (drag.kind === "move") {
    var o = drag.orig;
    drag.rect = { x: Math.min(Math.max(0, o.x + p.x - drag.start.x), size.w - o.w), y: Math.min(Math.max(0, o.y + p.y - drag.start.y), size.h - o.h), w: o.w, h: o.h };
    place(drag.el, drag.rect, k);
  } else if (drag.kind === "resize") {
    var o = drag.orig, ed = drag.edge;
    var left = ed.indexOf("w") >= 0 ? p.x : o.x, right = ed.indexOf("e") >= 0 ? p.x : o.x + o.w;
    var top = ed.indexOf("n") >= 0 ? p.y : o.y, bottom = ed.indexOf("s") >= 0 ? p.y : o.y + o.h;
    drag.rect = normalize({ x: left, y: top }, { x: right, y: bottom });
    place(drag.el, drag.rect, k);
  }
});
function end(e) {
  if (!drag || e.pointerId !== drag.id) return;
  var d = drag;
  drag = null;
  ghost.style.display = "none";
  if (d.kind === "tap") {
    if (!d.moved && e.type === "pointerup") post({ type: "select", key: null });
  } else if (d.kind === "draw") {
    if (d.moved && e.type === "pointerup") {
      var r = normalize(d.start, point(e));
      post({ type: "draw", rect: { x: round(r.x), y: round(r.y), w: round(r.w), h: round(r.h) } });
    }
  } else if (!d.moved) {
    post({ type: "select", key: d.key });
  } else if (d.rect) {
    var b = boxes.find(function (x) { return x.key === d.key; });
    if (b) { b.x = d.rect.x; b.y = d.rect.y; b.w = d.rect.w; b.h = d.rect.h; }
    post({ type: "change", key: d.key, rect: { x: round(d.rect.x), y: round(d.rect.y), w: Math.max(1, round(d.rect.w)), h: Math.max(1, round(d.rect.h)) } });
  }
}
layer.addEventListener("pointerup", end);
layer.addEventListener("pointercancel", end);
window.addEventListener("resize", function () { if (size) drawBoxes(); });

// --- Metin ve OCR ---
function pageText(n) {
  return doc.getPage(n).then(function (page) {
    var viewport = page.getViewport({ scale: 1 });
    return page.getTextContent().then(function (content) {
      var items = [];
      content.items.forEach(function (item) {
        if (!("str" in item) || !item.str.trim()) return;
        var t = item.transform, a = t[0], b = t[1], c = t[2], d = t[3], e = t[4], f = t[5];
        // Yalnızca yatay metin; eğik filigranlar atlanır.
        if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01) return;
        var h = item.height || Math.abs(d);
        // pdf.js koordinatları sol alttan, taban çizgisinde; sol üstten üst kenara çevrilir.
        items.push({ s: item.str, x: e, y: viewport.height - f - h, w: item.width || Math.abs(a) * item.str.length * 0.5, h: h });
      });
      return { page: n, width: viewport.width, height: viewport.height, items: items };
    });
  });
}
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  return new Promise(function (resolve, reject) {
    var s = document.createElement("script");
    s.src = "${TESSERACT_CDN}";
    s.onload = resolve;
    s.onerror = function () { reject(new Error("Metin tanıma yüklenemedi.")); };
    document.head.appendChild(s);
  });
}
// Taranmış sayfa ≈216 dpi'ye (3 kat) çevrilip okunur; daha küçüğünde Türkçe harfler bozuluyor.
var OCR_SCALE = 3;
function ocrText(n) {
  return loadTesseract().then(function () {
    if (!ocrWorker) ocrWorker = Tesseract.createWorker("tur");
    return Promise.all([ocrWorker, doc.getPage(n)]);
  }).then(function (r) {
    var worker = r[0], page = r[1];
    var base = page.getViewport({ scale: 1 }), viewport = page.getViewport({ scale: OCR_SCALE });
    var canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    return page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise.then(function () {
      return worker.recognize(canvas, {}, { blocks: true });
    }).then(function (res) {
      var words = [];
      (res.data.blocks || []).forEach(function (b) { b.paragraphs.forEach(function (p) { p.lines.forEach(function (l) { words.push.apply(words, l.words); }); }); });
      var items = words.filter(function (w) { return w.text.trim() && w.confidence > 20; }).map(function (w) {
        return { s: w.text.trim(), x: w.bbox.x0 / OCR_SCALE, y: w.bbox.y0 / OCR_SCALE, w: (w.bbox.x1 - w.bbox.x0) / OCR_SCALE, h: (w.bbox.y1 - w.bbox.y0) / OCR_SCALE };
      });
      canvas.width = canvas.height = 0;
      return { page: n, width: base.width, height: base.height, items: items, ocr: true };
    });
  });
}

window.uc = {
  show: show,
  setBoxes: function (list) { boxes = list; drawBoxes(); },
  setMode: function (m) { mode = m; document.body.classList.toggle("draw", m === "draw"); },
  read: function (id, n, ocr) {
    if (!doc) return post({ type: "text", id: id, message: "PDF açılmadı." });
    (ocr ? ocrText(n) : pageText(n)).then(function (data) {
      post({ type: "text", id: id, data: data });
    }, function (err) {
      post({ type: "text", id: id, message: (err && err.message) || "Sayfa okunamadı." });
    });
  }
};

// Worker başka kökenden doğrudan açılamaz; betik indirilip bu sayfanın kökeninde çalıştırılır (bkz. pdf-viewer.ts).
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
  post({ type: "loaded", pageCount: d.numPages });
  show(Math.min(Math.max(1, cfg.page), d.numPages));
}).catch(function () {
  post({ type: "error", message: typeof pdfjsLib === "undefined" ? "PDF görüntüleyicisi yüklenemedi. İnternet bağlantını kontrol et." : "PDF açılamadı." });
});
</script>
</body></html>`;
}
