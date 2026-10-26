import { ApiError, type ApiClient } from "@unicoach/shared";
import { withTimeout } from "../timeout";
import { applyPull, getMeta, setMeta, wipeLocal } from "./db";
import type { Connection, SyncEngine, SyncState } from "./types";

/** Bu sürede yanıt gelmezse sunucuya ulaşılamıyor sayılır. */
const PULL_TIMEOUT_MS = 8000;

/**
 * Eşitleme motoru: sunucudan `since=<cursor>` ile yenilikleri çeker ve yerel veritabanına uygular. Ağ hatası
 * "çevrimdışı" demektir (telefon evdeki bilgisayara ulaşamıyor); sunucudan gelen hata (ör. 401) bağlantı var demektir.
 */
export function createSyncEngine(remote: ApiClient): SyncEngine {
  let state: SyncState = { connection: "unknown", syncing: false, syncedAt: null };
  const listeners = new Set<(state: SyncState, changed: boolean) => void>();
  let running: Promise<boolean> | null = null;
  let again = false;

  const set = (patch: Partial<SyncState>, changed = false) => {
    state = { ...state, ...patch };
    for (const l of listeners) l(state, changed);
  };

  void getMeta("syncedAt").then((v) => v && !state.syncedAt && set({ syncedAt: v }), () => undefined);

  async function once(): Promise<boolean> {
    const cursor = Number((await getMeta("cursor")) ?? 0);
    try {
      const pull = await withTimeout(remote.sync.pull(cursor), PULL_TIMEOUT_MS);
      const changed = (await applyPull(pull)) > 0;
      set({ connection: "online", syncedAt: pull.serverTime }, changed);
      return changed;
    } catch (err) {
      set({ connection: err instanceof ApiError ? "online" : "offline" });
      return false;
    }
  }

  async function pull(): Promise<boolean> {
    // Çekme sürerken yeni istek gelirse (ör. ardı ardına kayıtlar) bittikten sonra bir kez daha çekilir.
    if (running) {
      again = true;
      return running;
    }
    set({ syncing: true });
    running = (async () => {
      let changed = await once();
      while (again) {
        again = false;
        changed = (await once()) || changed;
      }
      return changed;
    })();
    try {
      return await running;
    } finally {
      running = null;
      set({ syncing: false });
    }
  }

  return {
    enabled: true,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    pull,
    setConnection: (connection: Connection) => connection !== state.connection && set({ connection }),
    async ensureOwner(userId) {
      if ((await getMeta("userId")) === userId) return;
      await wipeLocal();
      await setMeta("userId", userId);
      set({ syncedAt: null }, true);
    },
    async wipe() {
      await wipeLocal();
      set({ syncedAt: null }, true);
    },
  };
}
