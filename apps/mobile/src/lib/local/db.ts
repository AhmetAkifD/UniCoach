import * as SQLite from "expo-sqlite";
import { SYNC_CHILDREN, SYNC_PARENT_KEY, SYNC_TABLES, type SyncPullResponse, type SyncRows, type SyncTable } from "@unicoach/shared";

/**
 * Telefonun yerel veritabanı (çevrimdışı kopya; packages/shared → sync.ts). Her eşitlenen tablo için bir SQLite
 * tablosu: `id`, üst satır (`parent`, ör. videonun kaynağı; aramalar için indeksli), sunucudaki `version` ve satırın
 * kendisi (`data`, JSON). Satırın alanları sunucudakiyle aynı kaldığı için yeni alan eklenince şema değişmez.
 * `meta`: eşitleme noktası, verinin sahibi olan kullanıcı.
 */

const SCHEMA_VERSION = 1;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function localDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= (async () => {
    const db = await SQLite.openDatabaseAsync("unicoach.db");
    await db.execAsync("PRAGMA journal_mode = WAL;");
    const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    if ((row?.user_version ?? 0) < SCHEMA_VERSION) {
      const tables = SYNC_TABLES.map(
        (t) => `CREATE TABLE IF NOT EXISTS ${t} (id TEXT PRIMARY KEY NOT NULL, parent TEXT, version INTEGER NOT NULL, data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ${t}_parent ON ${t} (parent);`,
      ).join("\n");
      await db.execAsync(`${tables}
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
PRAGMA user_version = ${SCHEMA_VERSION};`);
    }
    return db;
  })();
  return dbPromise;
}

// --- meta ---

export async function getMeta(key: string): Promise<string | null> {
  const row = await (await localDb()).getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string) {
  await (await localDb()).runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", key, value);
}

// --- okuma ---

type Row<T extends SyncTable> = SyncRows[T][number];

export async function readAll<T extends SyncTable>(table: T): Promise<Row<T>[]> {
  const rows = await (await localDb()).getAllAsync<{ data: string }>(`SELECT data FROM ${table}`);
  return rows.map((r) => JSON.parse(r.data) as Row<T>);
}

export async function readByParent<T extends SyncTable>(table: T, parent: string): Promise<Row<T>[]> {
  const rows = await (await localDb()).getAllAsync<{ data: string }>(`SELECT data FROM ${table} WHERE parent = ?`, parent);
  return rows.map((r) => JSON.parse(r.data) as Row<T>);
}

export async function readOne<T extends SyncTable>(table: T, id: string): Promise<Row<T> | null> {
  const row = await (await localDb()).getFirstAsync<{ data: string }>(`SELECT data FROM ${table} WHERE id = ?`, id);
  return row ? (JSON.parse(row.data) as Row<T>) : null;
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

// --- eşitleme ---

/**
 * Sunucudan gelen değişiklikleri tek işlemde uygular: satırlar eklenir/güncellenir, silinenler (ve sunucudaki
 * cascade gibi alt satırları) silinir, eşitleme noktası ilerler. Değişen satır sayısını döndürür.
 */
export async function applyPull(pull: SyncPullResponse): Promise<number> {
  const db = await localDb();
  let changed = 0;
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const table of SYNC_TABLES) {
      const parentKey = SYNC_PARENT_KEY[table];
      for (const row of pull.rows[table]) {
        const parent = parentKey ? ((row as unknown as Record<string, string | null>)[parentKey] ?? null) : null;
        await tx.runAsync(
          `INSERT OR REPLACE INTO ${table} (id, parent, version, data) VALUES (?, ?, ?, ?)`,
          row.id,
          parent,
          row.syncVersion,
          JSON.stringify(row),
        );
        changed++;
      }
    }
    const remove = async (table: SyncTable, ids: string[]) => {
      if (!ids.length) return;
      for (const child of SYNC_CHILDREN[table] ?? []) {
        const marks = ids.map(() => "?").join(",");
        const rows = await tx.getAllAsync<{ id: string }>(`SELECT id FROM ${child.table} WHERE parent IN (${marks})`, ...ids);
        await remove(
          child.table,
          rows.map((r) => r.id),
        );
      }
      for (const id of ids) await tx.runAsync(`DELETE FROM ${table} WHERE id = ?`, id);
      changed += ids.length;
    };
    for (const d of pull.deleted) await remove(d.table, [d.id]);
    await tx.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES ('cursor', ?)", String(pull.cursor));
    await tx.runAsync("INSERT OR REPLACE INTO meta (key, value) VALUES ('syncedAt', ?)", pull.serverTime);
  });
  return changed;
}

/** Oturum kapanınca ya da başka hesap açılınca bütün yerel veri silinir. */
export async function wipeLocal() {
  const db = await localDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const table of SYNC_TABLES) await tx.runAsync(`DELETE FROM ${table}`);
    await tx.runAsync("DELETE FROM meta");
  });
}
