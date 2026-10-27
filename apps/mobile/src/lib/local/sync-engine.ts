import { ApiError, SYNC_PUSH_MAX, type ApiClient } from "@unicoach/shared";
import { withTimeout } from "../timeout";
import { applyPull, deleteOutbox, getMeta, localDb, outboxCount, readOutbox, setInflight, setMeta, wipeLocal } from "./db";
import { replayOutbox } from "./ops";
import type { Connection, SyncEngine, SyncState } from "./types";

/** Bu sürede yanıt gelmezse sunucuya ulaşılamıyor sayılır. */
const PULL_TIMEOUT_MS = 8000;
const PUSH_TIMEOUT_MS = 15_000;
/** Yerel değişiklikten bu süre sonra gönderilir (art arda kayıtlar tek istekte). */
const SCHEDULE_DELAY_MS = 1500;

/** Sunucuya ulaşılamadı (ağ hatası ya da zaman aşımı); sunucudan gelen hata bağlantı var demektir. */
class Offline extends Error {}

/**
 * Eşitleme motoru. Bir tur: (1) gönderilecekler kuyruğu sırayla sunucuya gönderilir (`POST /api/sync/push`, en fazla
 * `SYNC_PUSH_MAX` işlemlik parçalar; gönderilenler kuyruktan silinir), (2) `since=<cursor>` ile yenilikler çekilir ve
 * yerel veritabanına uygulanır, henüz gönderilmemiş değişiklikler üstüne yeniden uygulanır.
 */
export function createSyncEngine(remote: ApiClient): SyncEngine {
  let state: SyncState = { connection: "unknown", syncing: false, syncedAt: null, pending: 0 };
  const listeners = new Set<(state: SyncState, changed: boolean) => void>();
  let running: Promise<boolean> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const set = (patch: Partial<SyncState>, changed = false) => {
    state = { ...state, ...patch };
    for (const l of listeners) l(state, changed);
  };

  const refreshPending = async () => {
    const pending = await outboxCount().catch(() => state.pending);
    if (pending !== state.pending) set({ pending });
  };

  void getMeta("syncedAt").then((v) => v && !state.syncedAt && set({ syncedAt: v }), () => undefined);
  void refreshPending();

  async function request<T>(promise: Promise<T>, ms: number): Promise<T> {
    try {
      return await withTimeout(promise, ms);
    } catch (err) {
      throw err instanceof ApiError ? err : new Offline();
    }
  }

  async function push() {
    const db = await localDb();
    for (;;) {
      const batch = await readOutbox(db, SYNC_PUSH_MAX);
      if (!batch.length) return;
      const upTo = batch[batch.length - 1]!.seq;
      setInflight(upTo);
      try {
        await request(remote.sync.push({ ops: batch.map((e) => e.op) }), PUSH_TIMEOUT_MS);
      } catch (err) {
        // Sunucunun kabul etmediği bir parça (doğrulama hatası) kuyruğu sonsuza dek tıkamasın; bağlantı ya da sunucu
        // hatasında kuyruk olduğu gibi kalır ve sonra yeniden denenir.
        if (!(err instanceof ApiError && err.status === 400)) throw err;
      } finally {
        setInflight(0);
      }
      // Reddedilen işlemler de silinir: sunucu onları uygulayamaz (ör. silinmiş defter); etkileri çekmeyle kalkar.
      await deleteOutbox(upTo);
      await refreshPending();
    }
  }

  async function once(): Promise<boolean> {
    try {
      await push();
      const cursor = Number((await getMeta("cursor")) ?? 0);
      const pull = await request(remote.sync.pull(cursor), PULL_TIMEOUT_MS);
      const changed = (await applyPull(pull, replayOutbox)) > 0;
      set({ connection: "online", syncedAt: pull.serverTime }, changed);
      return changed;
    } catch (err) {
      set({ connection: err instanceof Offline ? "offline" : "online" });
      return false;
    }
  }

  async function sync(): Promise<boolean> {
    if (timer) clearTimeout(timer);
    timer = null;
    // Eşitleme sürerken yeni istek gelirse (ör. ardı ardına kayıtlar) bittikten sonra bir tur daha yapılır.
    if (running) {
      again = true;
      return running;
    }
    set({ syncing: true });
    running = (async () => {
      let changed = await once();
      while (again && state.connection !== "offline") {
        again = false;
        changed = (await once()) || changed;
      }
      again = false;
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
    sync,
    schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void sync(), SCHEDULE_DELAY_MS);
    },
    refreshPending,
    setConnection: (connection: Connection) => connection !== state.connection && set({ connection }),
    async ensureOwner(userId) {
      if ((await getMeta("userId")) === userId) return;
      await wipeLocal();
      await setMeta("userId", userId);
      set({ syncedAt: null, pending: 0 }, true);
    },
    async wipe() {
      await wipeLocal();
      set({ syncedAt: null, pending: 0 }, true);
    },
  };
}
