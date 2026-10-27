import { useImperativeHandle, useMemo, useRef, type Ref } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { type PageFrameHandle } from "@/components/page-frame";
import { PdfPageFrame } from "@/components/pdf-page-frame";
import { API_BASE_URL } from "@/lib/api";
import { pdfjsAssets } from "@/lib/offline-files";
import { pdfViewerHtml, type PdfEvent, type PdfFrameHandle, type PdfViewerConfig } from "@/lib/pdf-viewer";

export interface PdfFrameProps {
  ref?: Ref<PdfFrameHandle>;
  /** Yalnızca ilk açılışta kullanılır; sonra sayfa `ref.goTo` ile değişir. */
  config: PdfViewerConfig;
  /** Cihazdaki kopya (varsa PDF buradan okunur; components/pdf-page-frame.tsx `bookPdfSource`) */
  file: { uri: string } | null;
  onEvent: (event: PdfEvent) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * PDF görüntüleyici: pdf.js sayfası. Telefonda API'nin kökeniyle (`baseUrl`) açılır ki PDF istekleri aynı kökenden
 * gitsin (CORS yok, Range başlıkları okunur); web önizlemesinde API başlıkları CORS ile açar.
 */
export function PdfFrame({ ref, config, file, onEvent, style }: PdfFrameProps) {
  const frameRef = useRef<PageFrameHandle>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const html = useMemo(() => pdfViewerHtml(config, pdfjsAssets()), []);
  useImperativeHandle(ref, () => ({ goTo: (page) => frameRef.current?.call("goTo", Math.floor(page)) }));
  return (
    <PdfPageFrame
      ref={frameRef}
      file={file}
      html={html}
      baseUrl={`${API_BASE_URL}/`}
      background={config.background}
      onMessage={(m) => onEvent(m as PdfEvent)}
      style={style}
    />
  );
}
