import { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View } from "react-native";
import { pdfViewerHtml, type PdfFrameHandle } from "@/lib/pdf-viewer";
import type { PdfFrameProps } from "./pdf-frame";

type ViewerWindow = Window & { uc?: PdfFrameHandle };

/**
 * PDF görüntüleyici (web önizlemesi): aynı sayfa `srcdoc` iframe'inde. PDF istekleri başka kökene (API) gider;
 * API, Range başlıklarını CORS ile açar (apps/api/src/main.ts).
 */
export function PdfFrame({ ref, config, onEvent, style }: PdfFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => pdfViewerHtml(config), []);

  useImperativeHandle(ref, () => ({
    goTo: (page) => (frameRef.current?.contentWindow as ViewerWindow | null)?.uc?.goTo(page),
  }));

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow || typeof e.data?.uc !== "string") return;
      onEventRef.current(JSON.parse(e.data.uc));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <View style={[{ backgroundColor: config.background }, style]}>
      <iframe ref={frameRef} srcDoc={html} title="PDF görüntüleyici" style={{ border: 0, width: "100%", height: "100%" }} />
    </View>
  );
}
