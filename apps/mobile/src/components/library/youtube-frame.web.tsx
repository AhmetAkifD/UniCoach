import { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View } from "react-native";
import { playerHtml, type YouTubeFrameHandle } from "@/lib/youtube";
import type { YouTubeFrameProps } from "./youtube-frame";

type PlayerWindow = Window & { uc?: YouTubeFrameHandle };

/**
 * YouTube oynatıcısı (web önizlemesi): react-native-webview web'i desteklemediği için aynı sayfa `srcdoc`
 * ile bir iframe'de açılır. srcdoc sayfası bu sayfayla aynı kökendedir, komutlar doğrudan çağrılır.
 */
export function YouTubeFrame({ ref, initial, onEvent, style }: YouTubeFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => playerHtml({ ...initial, origin: window.location.origin }), []);
  const player = () => (frameRef.current?.contentWindow as PlayerWindow | null)?.uc;

  useImperativeHandle(ref, () => ({
    load: (videoId, start) => player()?.load(videoId, Math.floor(start)),
    play: () => player()?.play(),
    pause: () => player()?.pause(),
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
    <View style={[{ backgroundColor: "#000" }, style]}>
      <iframe
        ref={frameRef}
        srcDoc={html}
        title="YouTube oynatıcısı"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        style={{ border: 0, width: "100%", height: "100%" }}
      />
    </View>
  );
}
