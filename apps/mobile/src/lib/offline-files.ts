import { Directory, File, FileMode, Paths } from "expo-file-system";
import { toBase64 } from "./base64";
import { PDFJS_CDN } from "./pdf-viewer";

/**
 * Çevrimdışı kullanılan dosyalar (kullanıcı kararı: PDF başına "Çevrimdışı kullan", hepsi otomatik inmez).
 * PDF'ler `Paths.document/books/<id>.pdf`'te durur; görüntüleyici sayfası onları parça parça okur (lib/pdfjs-page.ts).
 * pdf.js de bir kez indirilip saklanır: internet yokken (ör. metroda) görüntüleyici CDN'e ulaşamaz.
 */

const booksDir = () => new Directory(Paths.document, "books");
const bookFile = (id: string) => new File(booksDir(), `${id}.pdf`);

/** PDF bu cihazda mı? Varsa dosyanın adresi ve boyutu. */
export function offlineBook(id: string): { uri: string; size: number } | null {
  try {
    const file = bookFile(id);
    return file.exists && file.size > 0 ? { uri: file.uri, size: file.size } : null;
  } catch {
    return null;
  }
}

export interface DownloadHandle {
  promise: Promise<void>;
  cancel(): void;
}

/** PDF'i cihaza indirir (önce geçici dosyaya; yarım kalan indirme PDF sayılmaz). */
export function downloadBook(id: string, url: string, token: string | null, onProgress: (sent: number, total: number) => void): DownloadHandle {
  booksDir().create({ intermediates: true, idempotent: true });
  const part = new File(booksDir(), `${id}.part`);
  if (part.exists) part.delete();
  const task = File.createDownloadTask(url, part, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    onProgress: ({ bytesWritten, totalBytes }) => onProgress(bytesWritten, totalBytes),
  });
  return {
    promise: (async () => {
      await task.downloadAsync();
      const target = bookFile(id);
      if (target.exists) target.delete();
      part.move(target);
      void ensurePdfjs();
    })(),
    cancel: () => {
      task.cancel();
      try {
        if (part.exists) part.delete();
      } catch {
        // yok sayılır
      }
    },
  };
}

export function removeOfflineBook(id: string) {
  try {
    const file = bookFile(id);
    if (file.exists) file.delete();
  } catch {
    // yok sayılır
  }
}

/** Oturum kapanınca bütün çevrimdışı PDF'ler silinir. */
export function removeAllOfflineBooks() {
  try {
    const dir = booksDir();
    if (dir.exists) dir.delete();
  } catch {
    // yok sayılır
  }
}

/** Cihazdaki PDF'ten bir parça (base64); görüntüleyici sayfası ister. */
export async function readBookRange(uri: string, begin: number, end: number): Promise<string> {
  const handle = new File(uri).open(FileMode.ReadOnly);
  try {
    handle.offset = begin;
    return toBase64(await handle.readBytes(end - begin));
  } finally {
    handle.close();
  }
}

// --- pdf.js ---

const pdfjsDir = () => new Directory(Paths.document, "pdfjs");
const PDFJS_FILES = { lib: "pdf.min.js", worker: "pdf.worker.min.js" } as const;
let assets: { lib: string; worker: string } | null = null;

/** Saklanan pdf.js (yüklendiyse); görüntüleyici sayfaları bunu sayfaya gömer, yoksa CDN'den yükler. */
export const pdfjsAssets = () => assets;

/**
 * pdf.js'i (cihazda yoksa) indirir ve belleğe alır. Açılışta (çevrimdışı da: saklanan kopya okunur), bağlantı
 * gelince ve PDF indirilince çağrılır. İnternet yoksa indirme sonra yeniden denenir; o zamana kadar CDN denenir.
 */
export async function ensurePdfjs(): Promise<void> {
  if (assets) return;
  try {
    pdfjsDir().create({ intermediates: true, idempotent: true });
    const files = { lib: new File(pdfjsDir(), PDFJS_FILES.lib), worker: new File(pdfjsDir(), PDFJS_FILES.worker) };
    for (const [key, file] of Object.entries(files)) {
      if (file.exists && file.size > 0) continue;
      await File.downloadFileAsync(`${PDFJS_CDN}/${PDFJS_FILES[key as keyof typeof PDFJS_FILES]}`, file).catch(() => undefined);
    }
    if (!files.lib.exists || !files.worker.exists) return;
    const [lib, worker] = await Promise.all([files.lib.text(), files.worker.text()]);
    assets = { lib, worker };
  } catch {
    // Dosya okunamadıysa görüntüleyici CDN'i dener.
  }
}
