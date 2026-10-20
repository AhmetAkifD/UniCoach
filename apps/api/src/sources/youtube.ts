/**
 * YouTube oEmbed: API anahtarı gerektirmeden video ve oynatma listesi başlığı, kanal adı ve
 * küçük resim verir. Video listesi ve sırası ise tarayıcıda oynatıcının getPlaylist() metoduyla alınır.
 */

export interface OEmbed {
  title: string;
  author: string | null;
  thumbnailUrl: string | null;
}

const OEMBED_URL = "https://www.youtube.com/oembed?format=json&url=";
const TIMEOUT_MS = 8000;
const CONCURRENCY = 8;

/** Bulunamazsa, gizliyse veya gömülmeye kapalıysa null döner. */
export async function fetchOEmbed(pageUrl: string): Promise<OEmbed | null> {
  try {
    const res = await fetch(OEMBED_URL + encodeURIComponent(pageUrl), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const body = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    if (!body.title) return null;
    return { title: body.title, author: body.author_name ?? null, thumbnailUrl: body.thumbnail_url ?? null };
  } catch {
    return null;
  }
}

export const videoUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;
export const playlistUrl = (listId: string) => `https://www.youtube.com/playlist?list=${listId}`;

/** Video başlıklarını aynı anda en fazla 8 istekle çeker; sonuç girişle aynı sıradadır. */
export async function fetchVideoTitles(videoIds: string[]): Promise<(OEmbed | null)[]> {
  const results: (OEmbed | null)[] = new Array(videoIds.length).fill(null);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, videoIds.length) }, async () => {
      while (next < videoIds.length) {
        const i = next++;
        results[i] = await fetchOEmbed(videoUrl(videoIds[i]!));
      }
    }),
  );
  return results;
}
