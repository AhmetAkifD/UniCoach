import { useImperativeHandle, useMemo, useRef, type Ref } from "react";
import { Linking, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import { PLAYER_ORIGIN, playerHtml, type PlayerConfig, type YouTubeEvent, type YouTubeFrameHandle } from "@/lib/youtube";

export interface YouTubeFrameProps {
  ref?: Ref<YouTubeFrameHandle>;
  /** İlk açılış; sonraki videolar `ref.load` ile açılır (sayfa yeniden yüklenmez). */
  initial: Omit<PlayerConfig, "origin">;
  onEvent: (event: YouTubeEvent) => void;
  style?: StyleProp<ViewStyle>;
}

/** YouTube oynatıcısı (telefon): IFrame API sayfası WebView'de, kontroller YouTube'un kendi kontrolleri. */
export function YouTubeFrame({ ref, initial, onEvent, style }: YouTubeFrameProps) {
  const webRef = useRef<WebView<object>>(null);
  // Sayfa yalnızca ilk açılışta kurulur; HTML değişirse WebView baştan yüklenirdi.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => playerHtml({ ...initial, origin: PLAYER_ORIGIN }), []);
  const run = (code: string) => webRef.current?.injectJavaScript(`${code};true;`);

  useImperativeHandle(ref, () => ({
    load: (videoId, start) => run(`window.uc.load(${JSON.stringify(videoId)}, ${Math.floor(start)})`),
    play: () => run("window.uc.play()"),
    pause: () => run("window.uc.pause()"),
  }));

  return (
    // WebView `style`'ı iç görünüme uygular, kendi kabı boyutsuz kalır; boyut dıştaki View'dadır.
    <View style={[{ backgroundColor: "#000", overflow: "hidden" }, style]}>
      {/* Paketin tipi `WebView<undefined>` varsayılanında `never` oluyor; boş prop tipi açıkça verilir. */}
      <WebView<object>
        ref={webRef}
        source={{ html, baseUrl: PLAYER_ORIGIN }}
        originWhitelist={["*"]}
        style={{ flex: 1, backgroundColor: "#000" }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        scrollEnabled={false}
        bounces={false}
        setSupportMultipleWindows={false}
        onMessage={(e) => {
          try {
            onEvent(JSON.parse(e.nativeEvent.data) as YouTubeEvent);
          } catch {
            // Sayfadan gelen başka mesajlar yok sayılır.
          }
        }}
        // YouTube logosu ya da video başlığı youtube.com'u açmak ister: oynatıcının içinde değil, YouTube uygulamasında açılır.
        onShouldStartLoadWithRequest={(req) => {
          if (req.url.startsWith(PLAYER_ORIGIN) || req.url.startsWith("about:")) return true;
          if (req.isTopFrame === false) return true;
          void Linking.openURL(req.url);
          return false;
        }}
      />
    </View>
  );
}
