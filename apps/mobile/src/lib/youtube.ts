import { PLAYLIST_MAX_ITEMS } from "@unicoach/shared";

/**
 * YouTube oynatıcısı: IFrame Player API'yi çalıştıran küçük bir HTML sayfası. Telefonda WebView'de
 * (components/library/youtube-frame.tsx), web önizlemesinde iframe'de (youtube-frame.web.tsx) açılır;
 * iki yerde de aynı sayfa ve aynı mesajlar kullanılır. API anahtarı gerekmez.
 * https://developers.google.com/youtube/iframe_api_reference
 */

/** Oynatıcı durumları (YT.PlayerState) */
export const PlayerState = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

/** Sayfadan uygulamaya gelen mesajlar */
export type YouTubeEvent =
  | { type: "ready" }
  | { type: "state"; state: number; time: number; duration: number }
  /** Oynarken saniyede bir */
  | { type: "time"; time: number; duration: number }
  /** Liste okuma modunda (listId): YouTube sırasıyla video ID'leri */
  | { type: "playlist"; ids: string[] }
  /** YouTube'un tam ekran düğmesi: oynatıcı tam ekrana girdi/çıktı */
  | { type: "fullscreen"; on: boolean }
  | { type: "error"; message: string };

/** Uygulamadan sayfaya komutlar (sayfadaki `window.uc`) */
export interface YouTubeFrameHandle {
  load(videoId: string, startSeconds: number): void;
  play(): void;
  pause(): void;
}

export interface PlayerConfig {
  videoId?: string;
  start?: number;
  /** Verilirse oynatıcı sessizce listeyi açar ve getPlaylist() sonucunu gönderir. */
  listId?: string;
  /**
   * Sayfanın kökeni. YouTube, yerleştirilmiş oynatıcıyı açan sayfanın adresini (Referer) ister; adres yoksa
   * "Hata 153" verir. Bu yüzden WebView'e HTML bir https köküyle (`baseUrl`) verilir.
   */
  origin: string;
}

/** Telefonda WebView sayfasının kökü (sunucusu yok; yalnızca Referer ve `origin` için). */
export const PLAYER_ORIGIN = "https://unicoach.app";

const ERROR_MESSAGES: Record<number, string> = {
  2: "Video bağlantısı geçersiz.",
  5: "Bu video oynatılamıyor.",
  100: "Video bulunamadı (kaldırılmış ya da gizli olabilir).",
  101: "Video sahibi başka sitelerde oynatılmasına izin vermiyor.",
  150: "Video sahibi başka sitelerde oynatılmasına izin vermiyor.",
  153: "YouTube oynatıcısı açılamadı (Hata 153).",
};

export function playerHtml(config: PlayerConfig): string {
  const listMode = !!config.listId;
  return `<!doctype html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<meta name="referrer" content="strict-origin-when-cross-origin">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#p{position:absolute;inset:0;width:100%;height:100%}</style>
</head><body><div id="p"></div>
<script>
var cfg = ${JSON.stringify(config)};
var errors = ${JSON.stringify(ERROR_MESSAGES)};
var player = null, ticker = null;
function post(m) {
  var s = JSON.stringify(m);
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
  else window.parent.postMessage({ uc: s }, "*");
}
function snap() {
  return { time: (player && player.getCurrentTime()) || 0, duration: (player && player.getDuration()) || 0 };
}
window.uc = {
  load: function (id, start) { if (player) player.loadVideoById({ videoId: id, startSeconds: start }); },
  play: function () { if (player) player.playVideo(); },
  pause: function () { if (player) player.pauseVideo(); }
};
// YouTube'un tam ekran düğmesi sayfanın tam ekran API'sini kullanır (Android WebView'de allowsFullscreenVideo).
function onFullscreen() {
  post({ type: "fullscreen", on: !!(document.fullscreenElement || document.webkitFullscreenElement) });
}
document.addEventListener("fullscreenchange", onFullscreen);
document.addEventListener("webkitfullscreenchange", onFullscreen);
function readPlaylist(p) {
  var started = Date.now(), last = -1, stable = 0;
  var timer = setInterval(function () {
    var ids = p.getPlaylist() || [];
    stable = ids.length > 0 && ids.length === last ? stable + 1 : 0;
    last = ids.length;
    if (stable >= 3 || ids.length >= ${PLAYLIST_MAX_ITEMS} || Date.now() - started > 15000) {
      clearInterval(timer);
      if (ids.length) post({ type: "playlist", ids: ids });
      else post({ type: "error", message: "Oynatma listesi okunamadı. Liste gizli ya da boş olabilir." });
    }
  }, 400);
}
function onYouTubeIframeAPIReady() {
  var vars = { playsinline: 1, rel: 0, iv_load_policy: 3, origin: cfg.origin, widget_referrer: cfg.origin };
  if (cfg.listId) { vars.listType = "playlist"; vars.list = cfg.listId; vars.mute = 1; }
  else if (cfg.start) vars.start = Math.floor(cfg.start);
  var options = {
    width: "100%", height: "100%", playerVars: vars,
    events: {
      onReady: function (e) {
        player = e.target;
        if (${listMode}) readPlaylist(e.target);
        else post({ type: "ready" });
      },
      onStateChange: function (e) {
        var s = snap(); post({ type: "state", state: e.data, time: s.time, duration: s.duration });
        clearInterval(ticker);
        if (e.data === 1) ticker = setInterval(function () { var t = snap(); post({ type: "time", time: t.time, duration: t.duration }); }, 1000);
      },
      onError: function (e) {
        post({ type: "error", message: ${listMode}
          ? "Oynatma listesi açılamadı. Liste gizli ya da kaldırılmış olabilir."
          : (errors[e.data] || "Bu video oynatılamıyor.") });
      }
    }
  };
  // Liste modunda videoId hiç verilmemeli; undefined bile "Invalid video id" hatası verir.
  if (cfg.videoId) options.videoId = cfg.videoId;
  new YT.Player("p", options);
}
</script>
<script src="https://www.youtube.com/iframe_api" onerror="post({type:'error',message:'YouTube oynatıcısı yüklenemedi. İnternet bağlantını kontrol et.'})"></script>
</body></html>`;
}
