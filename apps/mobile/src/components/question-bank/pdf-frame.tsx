import { useImperativeHandle, useMemo, useRef, type Ref } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { WebView } from "react-native-webview";
import { API_BASE_URL } from "@/lib/api";
import { pdfViewerHtml, type PdfEvent, type PdfFrameHandle, type PdfViewerConfig } from "@/lib/pdf-viewer";

export interface PdfFrameProps {
  ref?: Ref<PdfFrameHandle>;
  /** Yalnızca ilk açılışta kullanılır; sonra sayfa `ref.goTo` ile değişir. */
  config: PdfViewerConfig;
  onEvent: (event: PdfEvent) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * PDF görüntüleyici (telefon): pdf.js sayfası WebView'de. Sayfa API'nin kökeniyle (`baseUrl`) açılır ki PDF
 * istekleri aynı kökenden gitsin (CORS yok, Range başlıkları okunur).
 */
export function PdfFrame({ ref, config, onEvent, style }: PdfFrameProps) {
  const webRef = useRef<WebView<object>>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => pdfViewerHtml(config), []);

  useImperativeHandle(ref, () => ({
    goTo: (page) => webRef.current?.injectJavaScript(`window.uc.goTo(${Math.floor(page)});true;`),
  }));

  return (
    // WebView `style`'ı iç görünüme uygular; boyut dıştaki View'dadır (bkz. youtube-frame.tsx).
    <View style={[{ overflow: "hidden", backgroundColor: config.background }, style]}>
      <WebView<object>
        ref={webRef}
        source={{ html, baseUrl: `${API_BASE_URL}/` }}
        originWhitelist={["*"]}
        style={{ flex: 1, backgroundColor: config.background }}
        setBuiltInZoomControls
        setDisplayZoomControls={false}
        setSupportMultipleWindows={false}
        onMessage={(e) => {
          try {
            onEvent(JSON.parse(e.nativeEvent.data) as PdfEvent);
          } catch {
            // Sayfadan gelen başka mesajlar yok sayılır.
          }
        }}
      />
    </View>
  );
}
