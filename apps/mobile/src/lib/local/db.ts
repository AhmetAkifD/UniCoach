import * as SQLite from "expo-sqlite";
import { SYNC_CHILDREN, SYNC_PARENT_KEY, SYNC_TABLES, type SyncOp, type SyncPullResponse, type SyncRows, type SyncTable } from "@unicoach/shared";

/**
 * Telefonun yerel veritabanı (çevrimdışı kopya; packages/shared → sync.ts). Her eşitlenen tablo için bir SQLite
 * tablosu: `id`, üst satır (`parent`, ör. videonun kaynağı; aramalar için indeksli), sunucudaki `version` ve satırın
 * kendisi (`data`, JSON). Satırın alanları sunucudakiyle aynı kaldığı için yeni alan eklenince şema değişmez.
 * `meta`: eşitleme noktası, verinin sahibi olan kullanıcı. `outbox`: sunucuya gönderilmeyi bekleyen değişiklikler.
 */

const SCHEMA_VERSION = 2;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Her sürüm bir öncekinin üstüne kurulur (`PRAGMA user_version`). */
const MIGRATIONS: Record<number, string> = {
  1: `${SYNC_TABLES.map(
    (t) => `CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY NOT NULL, parent TEXT, version INTEGER NOT NULL, data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ${t}_parent ON ${t} (parent);`,
  ).join("\n")}
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`,
  // `key`: aynı satıra ait bekleyen değişiklikler birleşir (ör. aynı videonun ilerlemesi), `at`: telefondaki an.
  2: `CREATE TABLE IF NOT EXISTS outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT, at TEXT NOT NULL, op TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS outbox_key ON outbox (key);`,
};

export function localDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= (async () => {
    const db = await SQLite.openDatabaseAsync("unicoach.db");
    await db.execAsync("PRAGMA journal_mode = WAL;");
    const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    for (let v = (row?.user_version ?? 0) + 1; v <= SCHEMA_VERSION; v++) {
      await db.execAsync(`${MIGRATIONS[v]}\nPRAGMA user_version = ${v};`);
    }
    return db;
  })();
  return dbPromise;
}

export type Tx = SQLite.SQLiteDatabase;
type Row<T extends SyncTable> = SyncRows[T][number];

// --- meta ---

export async function getMeta(key: string): Promise<string | null> {
  const row = await (await localDb()).getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string) {
  await (await localDb()).runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", key, value);
}

// --- satır işlemleri (bir işlemin içinde) ---

export async function getRow<T extends SyncTable>(tx: Tx, table: T, id: string): Promise<Row<T> | null> {
  const row = await tx.getFirstAsync<{ data: string }>(`SELECT data FROM ${table} WHERE id = ?`, id);
  return row ? (JSON.parse(row.data) as Row<T>) : null;
}

export async function getChildren<T extends SyncTable>(tx: Tx, table: T, parent: string): Promise<Row<T>[]> {
  const rows = await tx.getAllAsync<{ data: string }>(`SELECT data FROM ${table} WHERE parent = ?`, parent);
  return rows.map((r) => JSON.parse(r.data) as Row<T>);
}

export async function putRow<T extends SyncTable>(tx: Tx, table: T, row: Row<T>) {
  const parentKey = SYNC_PARENT_KEY[table];
  const parent = parentKey ? ((row as unknown as Record<string, string | null>)[parentKey] ?? null) : null;
  await tx.runAsync(
    `INSERT OR REPLACE INTO ${table} (id, parent, version, data) VALUES (?, ?, ?, ?)`,
    row.id,
    parent,
    row.syncVersion,
    JSON.stringify(row),
  );
}

/** Satırları ve (sunucudaki cascade gibi) alt satırlarını siler; silinen satır sayısını döndürür. */
export async function deleteRows(tx: Tx, table: SyncTable, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  let count = 0;
  for (const child of SYNC_CHILDREN[table] ?? []) {
    const marks = ids.map(() => "?").join(",");
    const rows = await tx.getAllAsync<{ id: string }>(`SELECT id FROM ${child.table} WHERE parent IN (${marks})`, ...ids);
    count += await deleteRows(
      tx,
      child.table,
      rows.map((r) => r.id),
    );
  }
  for (const id of ids) count += (await tx.runAsync(`DELETE FROM ${table} WHERE id = ?`, id)).changes;
  return count;
}

/** Bir işlemin içinde çalıştırır (yazma kilidi; okumalar beklemez). */
export async function transaction<T>(task: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await localDb();
  let result!: T;
  await db.withExclusiveTransactionAsync(async (tx) => {
    result = await task(tx);
  });
  return result;
}

// --- okuma ---

export async function readAll<T extends SyncTable>(table: T): Promise<Row<T>[]> {
  const rows = await (await localDb()).getAllAsync<{ data: string }>(`SELECT data FROM ${table}`);
  return rows.map((r) => JSON.parse(r.data) as Row<T>);
}

export async function readByParent<T extends SyncTable>(table: T, parent: string): Promise<Row<T>[]> {
  return getChildren(await localDb(), table, parent);
}

export async function readOne<T extends SyncTable>(table: T, id: string): Promise<Row<T> | null> {
  return getRow(await localDb(), table, id);
}

/** Üst satıra göre alt satır sayıları (ör. defterin sayfa sayısı); satırlar çözülmez. */
export async function countByParent(table: SyncTable): Promise<Map<string, number>> {
  const rows = await (await localDb()).getAllAsync<{ parent: string; n: number }>(
    `SELECT parent, COUNT(*) AS n FROM ${table} WHERE parent IS NOT NULL GROUP BY parent`,
  );
  return new Map(rows.map((r) => [r.parent, r.n]));
}

/** Alt satırların yalnızca istenen alanları (büyük JSON'u çözmeden; ör. sayfa içeriği olmadan sayfa listesi). */
export async function fieldsByParent<K extends string>(table: SyncTable, parent: string, fields: K[]): Promise<Record<K | "id", unknown>[]> {
  const cols = fields.map((f) => `json_extract(data, '$.${f}') AS ${f}`).join(", ");
  return (await localDb()).getAllAsync<Record<K | "id", unknown>>(`SELECT id, ${cols} FROM ${table} WHERE parent = ?`, parent);
}

// --- gönderilecekler kuyruğu ---

export interface OutboxEntry {
  seq: number;
  key: string | null;
  at: string;
  op: SyncOp;
}

/** Sunucuya gönderilmekte olan en büyük sıra numarası: bunlara yeni değişiklik birleştirilmez (gönderilince silinir). */
let inflight = 0;
export const setInflight = (seq: number) => {
  inflight = seq;
};

/**
 * Kuyruğa yazar. `key` verilirse aynı anahtarlı, henüz gönderilmeyen değişiklikle birleşir: `merge` yoksa yenisi
 * eskisinin yerine geçer (ör. videonun son konumu), varsa ikisi birleştirilir (ör. sayfa farkları).
 */
export async function enqueue(tx: Tx, op: SyncOp, at: string, key?: string, merge?: (previous: SyncOp, next: SyncOp) => SyncOp) {
  if (key) {
    const previous = await tx.getFirstAsync<{ seq: number; op: string }>(
      "SELECT seq, op FROM outbox WHERE key = ? AND seq > ? ORDER BY seq DESC LIMIT 1",
      key,
      inflight,
    );
    if (previous) {
      const combined = merge ? merge(JSON.parse(previous.op) as SyncOp, op) : op;
      await tx.runAsync("UPDATE outbox SET op = ?, at = ? WHERE seq = ?", JSON.stringify(combined), at, previous.seq);
      return;
    }
  }
  await tx.runAsync("INSERT INTO outbox (key, at, op) VALUES (?, ?, ?)", key ?? null, at, JSON.stringify(op));
}

export async function readOutbox(tx: Tx, limit: number): Promise<OutboxEntry[]> {
  const rows = await tx.getAllAsync<{ seq: number; key: string | null; at: string; op: string }>(
    "SELECT seq, key, at, op FROM outbox ORDER BY seq LIMIT ?",
    limit,
  );
  return rows.map((r) => ({ ...r, op: JSON.parse(r.op) as SyncOp }));
}

export async function deleteOutbox(upTo: number) {
  await (await localDb()).runAsync("DELETE FROM outbox WHERE seq <= ?", upTo);
}

export async function outboxCount(): Promise<number> {
  return (await (await localDb()).getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM outbox"))?.n ?? 0;
}

// --- eşitleme ---

/**
 * Sunucudan gelen değişiklikleri tek işlemde uygular: satırlar eklenir/güncellenir, silinenler (ve alt satırları)
 * silinir, eşitleme noktası ilerler. Ardından henüz gönderilmemiş değişiklikler yeniden uygulanır (`replay`): sunucu
 * satırı onları içermediği için ekranda kaybolmasınlar. Değişen satır sayısını döndürür.
 */
export async function applyPull(pull: SyncPullResponse, replay: (tx: Tx) => Promise<void>): Promise<number> {
  return transaction(async (tx) => {
    let changed = 0;
    for (const table of SYNC_TABLES) {
      for (const row of pull.rows[table]) {
        await putRow(tx, table, row);
        changed++;
      }
    }
    for (const d of pull.deleted) changed += await deleteRows(tx, d.table, [d.id]);
    await tx.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES ('cursor', ?)", String(pull.cursor));
    await tx.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES ('syncedAt', ?)", pull.serverTime);
    if (changed) await replay(tx);
    return changed;
  });
}

/** Oturum kapanınca ya da başka hesap açılınca bütün yerel veri (gönderilmemiş değişiklikler dahil) silinir. */
export async function wipeLocal() {
  await transaction(async (tx) => {
    for (const table of SYNC_TABLES) await tx.runAsync(`DELETE FROM ${table}`);
    await tx.runAsync("DELETE FROM meta");
    await tx.runAsync("DELETE FROM outbox");
  });
}
