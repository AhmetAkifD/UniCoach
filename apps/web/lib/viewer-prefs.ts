/** PDF görüntüleyicinin görünüm tercihleri — yalnızca bu tarayıcıda hatırlanır. Kapak ayarı kitaba özeldir. */
export interface ViewerPrefs {
  /** Aşağı kaydırarak okuma (kapalıysa sayfa sayfa) */
  scroll: boolean;
  /** Yan yana iki sayfa */
  spread: boolean;
  /** Yan yana görünümde kapak (1. sayfa) tek başına durur: 1 | 2–3 | 4–5… */
  coverAlone: boolean;
}

const KEY = "uc-pdf-view";
const COVER_KEY = "uc-pdf-cover";
export const DEFAULT_VIEWER_PREFS: ViewerPrefs = { scroll: true, spread: false, coverAlone: true };

function read<T>(key: string): Partial<T> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") as Partial<T>;
  } catch {
    return {};
  }
}

export function loadViewerPrefs(bookId: string): ViewerPrefs {
  const view = read<ViewerPrefs>(KEY);
  const cover = read<Record<string, boolean>>(COVER_KEY)[bookId];
  return {
    scroll: typeof view.scroll === "boolean" ? view.scroll : DEFAULT_VIEWER_PREFS.scroll,
    spread: typeof view.spread === "boolean" ? view.spread : DEFAULT_VIEWER_PREFS.spread,
    coverAlone: typeof cover === "boolean" ? cover : DEFAULT_VIEWER_PREFS.coverAlone,
  };
}

export function saveViewerPrefs(bookId: string, prefs: ViewerPrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ scroll: prefs.scroll, spread: prefs.spread }));
    localStorage.setItem(
      COVER_KEY,
      JSON.stringify({ ...read<Record<string, boolean>>(COVER_KEY), [bookId]: prefs.coverAlone }),
    );
  } catch {
    // Depolama kapalıysa tercih yalnızca bu oturumda geçerli olur.
  }
}
