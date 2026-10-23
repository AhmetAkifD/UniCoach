import { useEffect, useImperativeHandle, useRef } from "react";
import { View } from "react-native";
import type { PageFrameProps } from "./page-frame";

type FrameWindow = Window & { uc?: Record<string, (...args: unknown[]) => void> };

/** Web önizlemesi: aynı sayfa `srcdoc` iframe'inde (bu sayfayla aynı kökende; istekler API'ye CORS ile gider). */
export function PageFrame({ ref, html, background, onMessage, style }: PageFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const htmlRef = useRef(html);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useImperativeHandle(ref, () => ({
    call: (method, ...args) => (frameRef.current?.contentWindow as FrameWindow | null)?.uc?.[method]?.(...args),
  }));

  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow || typeof e.data?.uc !== "string") return;
      onMessageRef.current(JSON.parse(e.data.uc));
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);

  return (
    <View style={[{ backgroundColor: background }, style]}>
      <iframe ref={frameRef} srcDoc={htmlRef.current} title="Sayfa" style={{ border: 0, width: "100%", height: "100%" }} />
    </View>
  );
}
