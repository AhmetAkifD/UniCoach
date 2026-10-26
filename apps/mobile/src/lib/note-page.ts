import { NOTE_PAGE_HEIGHT, NOTE_PAGE_WIDTH, type NotePageContent } from "@unicoach/shared";

/**
 * Defter sayfası (web'deki NoteCanvas'ın karşılığı): WebView'de çalışan küçük bir sayfa. Kâğıt ve kaydedilmiş
 * çizgiler alttaki tuvalde, o an çizilen çizgi üstteki tuvalde, metin kutuları HTML olarak en üstte. Çizim kuralları
 * web'dekiyle aynı (çizgili kâğıt, marker saydamlığı, silginin bütün çizgiyi silmesi, 1000×1414 sayfa düzlemi).
 *
 * Dokunma: kalem/marker/silgide tek parmak çizer ya da siler; metin aracında tek parmak kaydırır, dokunmak metin
 * kutusu açar. İki parmak her araçta sayfayı kaydırır ve kıstırarak yakınlaştırır (1–4×).
 *
 * Sayfa içeriği uygulamada tutulur (geri al/yinele, kayıt); sayfa her tamamlanan işlemi `change` ile tek adım olarak
 * bildirir. `key` (defter/sayfa) olayla geri gelir: sayfa değişirken açık kalan metin doğru sayfaya kaydedilsin.
 */

export type NoteToolName = "pen" | "marker" | "eraser" | "text";

export interface NoteToolState {
  tool: NoteToolName;
  penColor: string;
  penWidth: number;
  markerColor: string;
  markerWidth: number;
  textColor: string;
  textSize: number;
}

/** Sayfadan uygulamaya gelen mesajlar */
export type NotePageEvent = { type: "ready" } | { type: "change"; key: string; content: NotePageContent };

/** Uygulamadan sayfaya komutlar (sayfadaki `window.uc`) */
export interface NotePageHandle {
  /** Yeni sayfa ya da geri al/yinele; açık metin kutusu kaydedilmeden kapanır. */
  load(key: string, content: NotePageContent): void;
  setTools(tools: NoteToolState): void;
  /** Açık metin kutusunu kaydeder (değiştiyse `change` gelir). */
  commitText(): void;
}

export function notePageHtml(config: { background: string; tools: NoteToolState }): string {
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
html,body{margin:0;height:100%;background:${config.background};overflow:hidden;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;font-family:system-ui,-apple-system,Roboto,sans-serif}
#scroll{position:fixed;inset:0;overflow:hidden;touch-action:none}
#page{position:relative;margin:8px auto;background:#fff;border-radius:6px;box-shadow:0 1px 3px rgba(0,0,0,.18);overflow:hidden}
canvas{position:absolute;left:0;top:0;width:100%;height:100%}
.t{position:absolute;white-space:pre-wrap;word-break:break-word;line-height:1.3;pointer-events:none}
textarea.t{pointer-events:auto;resize:none;overflow:hidden;border:0;padding:0;margin:0;background:rgba(255,255,255,.85);outline:2px solid rgba(79,70,229,.55);border-radius:2px;font-family:inherit;-webkit-user-select:text;user-select:text}
textarea.t::placeholder{color:rgba(0,0,0,.3)}
</style>
</head><body><div id="scroll"><div id="page"><canvas id="base"></canvas><canvas id="live"></canvas><div id="texts"></div></div></div>
<script>
var W = ${NOTE_PAGE_WIDTH}, H = ${NOTE_PAGE_HEIGHT};
var LINE_GAP = 44, FIRST_LINE = 120, MARGIN_X = 90, ERASER_RADIUS = 14, MARKER_ALPHA = 0.38;
var tools = ${JSON.stringify(config.tools)};
var content = { strokes: [], texts: [] }, key = "";
var zoom = 1, cssW = 0, scale = 0, ratio = 1;
var scroller = document.getElementById("scroll"), pageEl = document.getElementById("page");
var base = document.getElementById("base"), live = document.getElementById("live"), textsEl = document.getElementById("texts");
var liveStroke = null, erasing = null, draft = null, editingEl = null;

function post(m) {
  var s = JSON.stringify(m);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
  else window.parent.postMessage({ uc: s }, "*");
}
function emit(next) { content = next; post({ type: "change", key: key, content: next }); }
function newId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function round(n) { return Math.round(n * 10) / 10; }

// --- Boyut ---
function fitWidth() { return Math.max(100, scroller.clientWidth - 16); }
function layout(redraw) {
  cssW = Math.round(fitWidth() * zoom);
  scale = cssW / W;
  pageEl.style.width = cssW + "px";
  pageEl.style.height = Math.round(H * scale) + "px";
  pageEl.style.margin = zoom > 1 ? "8px" : "8px auto";
  if (redraw !== false) { drawBase(); clearLive(); renderTexts(); }
}
function prepare(cv) {
  var cssH = H * scale;
  // Çok yakınlaştırınca tuval belleği taşmasın: piksel yoğunluğu sınırlanır.
  ratio = Math.min(window.devicePixelRatio || 1, 4096 / cssW, 5792 / cssH);
  var w = Math.floor(cssW * ratio), h = Math.floor(cssH * ratio);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  var ctx = cv.getContext("2d");
  ctx.setTransform(scale * ratio, 0, 0, scale * ratio, 0, 0);
  return ctx;
}

// --- Çizim ---
function tracePath(ctx, p) {
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  if (p.length === 2) { ctx.lineTo(p[0] + 0.01, p[1]); return; }
  for (var i = 2; i < p.length - 2; i += 2) ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
  ctx.lineTo(p[p.length - 2], p[p.length - 1]);
}
function drawStroke(ctx, s) {
  ctx.save();
  ctx.strokeStyle = s.color; ctx.lineWidth = s.width; ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (s.tool === "marker") ctx.globalAlpha = MARKER_ALPHA;
  tracePath(ctx, s.points); ctx.stroke(); ctx.restore();
}
function drawPaper(ctx) {
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#dbe4f0"; ctx.lineWidth = 1.2; ctx.beginPath();
  for (var y = FIRST_LINE; y < H - 20; y += LINE_GAP) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  ctx.strokeStyle = "#f5c2c2"; ctx.beginPath(); ctx.moveTo(MARGIN_X, 0); ctx.lineTo(MARGIN_X, H); ctx.stroke();
}
function drawBase() {
  if (!cssW) return;
  var ctx = prepare(base);
  drawPaper(ctx);
  var hidden = erasing || {};
  // Önce marker'lar (yazının altında kalsın), sonra kalem.
  content.strokes.forEach(function (s) { if (s.tool === "marker" && !hidden[s.id]) drawStroke(ctx, s); });
  content.strokes.forEach(function (s) { if (s.tool === "pen" && !hidden[s.id]) drawStroke(ctx, s); });
}
function clearLive() { if (cssW) prepare(live).clearRect(0, 0, W, H); }
function drawLive() {
  if (!liveStroke) return;
  var ctx = prepare(live);
  ctx.clearRect(0, 0, W, H);
  drawStroke(ctx, liveStroke);
}

// --- Metin ---
function textStyle(el, t) {
  el.style.left = t.x * scale + "px"; el.style.top = t.y * scale + "px";
  el.style.width = t.w * scale + "px"; el.style.color = t.color; el.style.fontSize = t.size * scale + "px";
}
function renderTexts() {
  textsEl.innerHTML = "";
  editingEl = null;
  var list = content.texts.slice();
  if (draft && !list.some(function (t) { return t.id === draft.id; })) list.push(draft);
  list.forEach(function (t) {
    if (draft && t.id === draft.id) {
      var ta = document.createElement("textarea");
      ta.className = "t"; ta.rows = 1; ta.placeholder = "Yaz…"; ta.value = draft.text;
      textStyle(ta, draft);
      var fit = function () { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; };
      ta.addEventListener("input", function () { draft.text = ta.value; fit(); });
      // Klavye kapatılınca kaydedilir; kutu yeniden çizildiği için gelen blur'lar yok sayılır.
      ta.addEventListener("blur", function () { setTimeout(function () { if (editingEl === ta) commitDraft(); }, 0); });
      textsEl.appendChild(ta);
      editingEl = ta;
      fit();
      // Dokunmanın içinde odaklanır: Android klavyeyi yalnızca kullanıcı hareketiyle gelen odakta açar.
      ta.focus();
      return;
    }
    var el = document.createElement("div");
    el.className = "t"; el.dataset.id = t.id; el.textContent = t.text;
    textStyle(el, t);
    if (erasing && erasing[t.id]) el.style.opacity = "0";
    textsEl.appendChild(el);
  });
}
function commitDraft() {
  var current = draft;
  if (!current) return;
  draft = null;
  var texts = content.texts, old = null;
  for (var i = 0; i < texts.length; i++) if (texts[i].id === current.id) old = texts[i];
  var trimmed = current.text.replace(/\\s+$/, ""), next = null;
  if (!trimmed) { if (old) next = texts.filter(function (t) { return t.id !== current.id; }); }
  else if (!old) next = texts.concat([Object.assign({}, current, { text: trimmed })]);
  else if (old.text !== trimmed) next = texts.map(function (t) { return t.id === current.id ? Object.assign({}, current, { text: trimmed }) : t; });
  if (next) emit({ strokes: content.strokes, texts: next });
  renderTexts();
}
function textAt(x, y) {
  var hit = null;
  content.texts.forEach(function (t) {
    var el = textsEl.querySelector('[data-id="' + t.id + '"]');
    if (!el) return;
    var h = el.offsetHeight / scale;
    if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + h) hit = t;
  });
  return hit;
}
function startText(x, y) {
  var existing = textAt(x, y);
  if (existing) { draft = Object.assign({}, existing); renderTexts(); return; }
  var w = Math.max(120, Math.min(560, W - x - 24));
  draft = { id: newId(), x: x, y: y - tools.textSize * 0.7, w: w, text: "", color: tools.textColor, size: tools.textSize };
  renderTexts();
}

// --- Silgi ---
function hitsStroke(s, x, y, radius) {
  var r = radius + s.width / 2, r2 = r * r, p = s.points;
  if (p.length === 2) return Math.pow(p[0] - x, 2) + Math.pow(p[1] - y, 2) <= r2;
  for (var i = 0; i < p.length - 2; i += 2) {
    var ax = p[i], ay = p[i + 1], dx = p[i + 2] - ax, dy = p[i + 3] - ay, len = dx * dx + dy * dy;
    var t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
    if (Math.pow(ax + t * dx - x, 2) + Math.pow(ay + t * dy - y, 2) <= r2) return true;
  }
  return false;
}
function eraseAt(x, y) {
  var changed = false;
  content.strokes.forEach(function (s) { if (!erasing[s.id] && hitsStroke(s, x, y, ERASER_RADIUS)) { erasing[s.id] = 1; changed = true; } });
  content.texts.forEach(function (t) {
    var el = textsEl.querySelector('[data-id="' + t.id + '"]');
    if (!el || erasing[t.id]) return;
    var h = el.offsetHeight / scale, r = ERASER_RADIUS;
    if (x >= t.x - r && x <= t.x + t.w + r && y >= t.y - r && y <= t.y + h + r) { erasing[t.id] = 1; el.style.opacity = "0"; changed = true; }
  });
  if (changed) drawBase();
}

// --- Dokunma ---
function toPage(touch) {
  var rect = pageEl.getBoundingClientRect();
  return { x: round((touch.clientX - rect.left) / scale), y: round((touch.clientY - rect.top) / scale) };
}
var gesture = null; // { kind: "pinch" | "pan" | "tap", ... }
function cancelTool() {
  if (liveStroke) { liveStroke = null; clearLive(); }
  if (erasing) { erasing = null; drawBase(); renderTexts(); }
}
function pinchInfo(e) {
  var a = e.touches[0], b = e.touches[1];
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2, d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
}
scroller.addEventListener("touchstart", function (e) {
  if (e.target && e.target.tagName === "TEXTAREA") return;
  // Metin aracında dokunma engellenmez: dokunmanın tıklaması yeni açılan kutuya düşer ve klavyeyi açar
  // (Android, betikle verilen odakta klavyeyi açmıyor). Kaydırma yine elle yapılır (touch-action: none).
  if (tools.tool !== "text" || e.touches.length >= 2) e.preventDefault();
  if (e.touches.length >= 2) {
    cancelTool();
    var p = pinchInfo(e);
    gesture = { kind: "pinch", x: p.x, y: p.y, d: p.d, zoom: zoom };
    return;
  }
  var t = e.touches[0];
  if (tools.tool === "text") {
    gesture = { kind: "tap", x: t.clientX, y: t.clientY, sx: scroller.scrollLeft, sy: scroller.scrollTop };
    return;
  }
  var pt = toPage(t);
  if (tools.tool === "eraser") { erasing = {}; eraseAt(pt.x, pt.y); gesture = { kind: "erase" }; return; }
  var marker = tools.tool === "marker";
  liveStroke = { id: newId(), tool: marker ? "marker" : "pen", color: marker ? tools.markerColor : tools.penColor, width: marker ? tools.markerWidth : tools.penWidth, points: [pt.x, pt.y] };
  gesture = { kind: "draw" };
  drawLive();
}, { passive: false });

scroller.addEventListener("touchmove", function (e) {
  if (!gesture) return;
  e.preventDefault();
  if (gesture.kind === "pinch" && e.touches.length >= 2) {
    var p = pinchInfo(e);
    var nextZoom = Math.max(1, Math.min(4, gesture.zoom * (p.d / gesture.d)));
    // Parmakların altındaki nokta yerinde kalsın.
    var rect = pageEl.getBoundingClientRect();
    var fx = (gesture.x - rect.left) / cssW, fy = (gesture.y - rect.top) / (H * scale);
    if (nextZoom !== zoom) { zoom = nextZoom; layout(false); }
    var r2 = pageEl.getBoundingClientRect();
    scroller.scrollLeft += r2.left + fx * cssW - p.x;
    scroller.scrollTop += r2.top + fy * H * scale - p.y;
    gesture.x = p.x; gesture.y = p.y;
    return;
  }
  var t = e.touches[0];
  if (gesture.kind === "tap" || gesture.kind === "pan") {
    var dx = t.clientX - gesture.x, dy = t.clientY - gesture.y;
    if (gesture.kind === "tap" && dx * dx + dy * dy > 64) gesture.kind = "pan";
    if (gesture.kind === "pan") { scroller.scrollLeft = gesture.sx - dx; scroller.scrollTop = gesture.sy - dy; }
    return;
  }
  var pt = toPage(t);
  if (gesture.kind === "erase" && erasing) { eraseAt(pt.x, pt.y); return; }
  if (gesture.kind === "draw" && liveStroke) {
    var s = liveStroke.points, lx = s[s.length - 2], ly = s[s.length - 1];
    if (Math.pow(pt.x - lx, 2) + Math.pow(pt.y - ly, 2) < 2.25) return;
    if (s.length < 8000) s.push(pt.x, pt.y);
    drawLive();
  }
}, { passive: false });

function end(e) {
  if (!gesture) return;
  var g = gesture;
  if (g.kind === "pinch") {
    // Bir parmak kalırsa çizime geçilmez; ikisi de kalkınca netleştirilir.
    if (e.touches.length) return;
    gesture = null;
    drawBase(); clearLive(); renderTexts();
    return;
  }
  gesture = null;
  if (g.kind === "tap") {
    var t = e.changedTouches[0], pt = toPage(t);
    if (draft) commitDraft();
    startText(pt.x, pt.y);
    return;
  }
  if (g.kind === "erase" && erasing) {
    var hit = erasing;
    erasing = null;
    var removed = Object.keys(hit).length;
    if (removed) emit({ strokes: content.strokes.filter(function (s) { return !hit[s.id]; }), texts: content.texts.filter(function (t) { return !hit[t.id]; }) });
    drawBase(); renderTexts();
    return;
  }
  if (g.kind === "draw" && liveStroke) {
    var stroke = liveStroke;
    liveStroke = null;
    emit({ strokes: content.strokes.concat([stroke]), texts: content.texts });
    drawBase();
    requestAnimationFrame(clearLive);
  }
}
scroller.addEventListener("touchend", end);
scroller.addEventListener("touchcancel", end);

var lastWidth = 0;
window.addEventListener("resize", function () {
  // Klavye açılınca yalnızca yükseklik değişir; sayfa yeniden çizilmez, yazılan kutu görünür kalır.
  if (scroller.clientWidth === lastWidth) {
    if (editingEl) editingEl.scrollIntoView({ block: "center", inline: "nearest" });
    return;
  }
  lastWidth = scroller.clientWidth;
  layout();
});

window.uc = {
  load: function (k, c) {
    key = k; content = c; draft = null; liveStroke = null; erasing = null; gesture = null;
    layout();
  },
  setTools: function (t) {
    if (t.tool !== "text" && draft) commitDraft();
    tools = t;
  },
  commitText: function () { if (draft) { if (editingEl) editingEl.blur(); commitDraft(); } },
};
lastWidth = scroller.clientWidth;
layout();
post({ type: "ready" });
</script></body></html>`;
}
