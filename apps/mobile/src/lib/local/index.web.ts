import type { ApiClient } from "@unicoach/shared";
import type { SyncEngine, SyncState } from "./types";

export type { Connection, SyncEngine, SyncState } from "./types";

/** Web önizlemesinde yerel kopya yoktur (expo-sqlite web'de ayrı kurulum ister); istekler doğrudan sunucuya gider. */
export function createLocalLayer(remote: ApiClient): { api: ApiClient; engine: SyncEngine } {
  const state: SyncState = { connection: "online", syncing: false, syncedAt: null, pending: 0 };
  const engine: SyncEngine = {
    enabled: false,
    getState: () => state,
    subscribe: () => () => undefined,
    sync: async () => false,
    schedule: () => undefined,
    refreshPending: async () => undefined,
    setConnection: () => undefined,
    ensureOwner: async () => undefined,
    wipe: async () => undefined,
  };
  return { api: remote, engine };
}
