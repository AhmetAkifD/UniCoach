/** Sunucuya bağlantı: "unknown" açılışta, ilk denemeden önce. */
export type Connection = "unknown" | "online" | "offline";

export interface SyncState {
  connection: Connection;
  syncing: boolean;
  /** Son başarılı eşitlemenin sunucu saati */
  syncedAt: string | null;
}

/** Telefondaki kopyayı sunucuyla eşitleyen motor (web önizlemesinde kopya yoktur, motor boştur). */
export interface SyncEngine {
  /** Yerel kopya var mı (web önizlemesinde yok) */
  readonly enabled: boolean;
  getState(): SyncState;
  /** Durum değişince; `changed` yerel veri değiştiyse true. Aboneliği kaldıran işlev döner. */
  subscribe(listener: (state: SyncState, changed: boolean) => void): () => void;
  /** Sunucudaki yenilikleri çeker; aynı anda tek çekme çalışır. Yerel veri değiştiyse true. */
  pull(): Promise<boolean>;
  /** Bağlantının durumu dışarıdan öğrenildiyse (ör. açılışta `auth/me` başarısız). */
  setConnection(connection: Connection): void;
  /** Veri başka bir hesabınsa yerel kopya silinir. */
  ensureOwner(userId: string): Promise<void>;
  /** Oturum kapanınca yerel kopya silinir. */
  wipe(): Promise<void>;
}
