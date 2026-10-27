/** Web önizlemesinde çevrimdışı dosya yoktur (yerel kopya da yok); görüntüleyiciler sunucudan okur. */

export const offlineBook = (_id: string): { uri: string; size: number } | null => null;

export interface DownloadHandle {
  promise: Promise<void>;
  cancel(): void;
}

export function downloadBook(): DownloadHandle {
  return { promise: Promise.reject(new Error("Web önizlemesinde PDF indirilemez.")), cancel: () => undefined };
}

export const removeOfflineBook = (_id: string) => undefined;
export const removeAllOfflineBooks = () => undefined;
export const readBookRange = async (): Promise<string> => "";
export const pdfjsAssets = (): { lib: string; worker: string } | null => null;
export const ensurePdfjs = async () => undefined;
