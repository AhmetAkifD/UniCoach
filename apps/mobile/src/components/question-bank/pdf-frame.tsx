import { useImperativeHandle, useMemo, useRef, type Ref } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { PageFrame, type PageFrameHandle } from "@/components/page-frame";
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
 * PDF görüntüleyici: pdf.js sayfası. Telefonda API'nin kökeniyle (`baseUrl`) açılır ki PDF istekleri aynı kökenden
 * gitsin (CORS yok, Range başlıkları okunur); web önizlemesinde API başlıkları CORS ile açar.
 */
export function PdfFrame({ ref, config, onEvent, style }: PdfFrameProps) {
  const frameRef = useRef<PageFrameHandle>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => pdfViewerHtml(config), []);
  useImperativeHandle(ref, () => ({ goTo: (page) => frameRef.current?.call("goTo", Math.floor(page)) }));
  return (
    <PageFrame
      ref={frameRef}
      html={html}
      baseUrl={`${API_BASE_URL}/`}
      background={config.background}
      onMessage={(m) => onEvent(m as PdfEvent)}
      style={style}
    />
  );
}
