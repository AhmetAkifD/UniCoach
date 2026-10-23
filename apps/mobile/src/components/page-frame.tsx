import { useImperativeHandle, useRef, type Ref } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";

/** Sayfadaki `window.uc` nesnesinin bir işlevini çağırır. */
export interface PageFrameHandle {
  call(method: string, ...args: unknown[]): void;
}

export interface PageFrameProps {
  ref?: Ref<PageFrameHandle>;
  /** Sayfanın HTML'i; yalnızca ilk çizimde kullanılır (değişirse sayfa baştan yüklenir). */
  html: string;
  /** Sayfanın kökeni (telefonda): istekler bu kökenden gider. */
  baseUrl: string;
  background: string;
  /** Sayfanın gönderdiği mesaj (JSON) */
  onMessage: (message: unknown) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Kendi HTML sayfasını çalıştıran görünüm (pdf.js görüntüleyici, soru düzenleyici): telefonda WebView, web
 * önizlemesinde srcdoc iframe'i (page-frame.web.tsx). Sayfa `window.ReactNativeWebView.postMessage` ya da
 * `parent.postMessage({ uc })` ile konuşur, uygulama `window.uc.<işlev>(…)` çağırır.
 */
export function PageFrame({ ref, html, baseUrl, background, onMessage, style }: PageFrameProps) {
  const webRef = useRef<WebView<object>>(null);
  const htmlRef = useRef(html);

  useImperativeHandle(ref, () => ({
    call: (method, ...args) =>
      webRef.current?.injectJavaScript(`window.uc && window.uc.${method}.apply(null, ${JSON.stringify(args)});true;`),
  }));

  return (
    // WebView `style`'ı iç görünüme uygular; boyut dıştaki View'dadır (bkz. youtube-frame.tsx).
    <View style={[{ overflow: "hidden", backgroundColor: background }, style]}>
      <WebView<object>
        ref={webRef}
        source={{ html: htmlRef.current, baseUrl }}
        originWhitelist={["*"]}
        style={{ flex: 1, backgroundColor: background }}
        setBuiltInZoomControls
        setDisplayZoomControls={false}
        setSupportMultipleWindows={false}
        onMessage={(e) => {
          try {
            onMessage(JSON.parse(e.nativeEvent.data));
          } catch {
            // Sayfadan gelen başka mesajlar yok sayılır.
          }
        }}
      />
    </View>
  );
}
