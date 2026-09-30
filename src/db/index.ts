import { openDatabase } from './driver';
import { migrate } from './migrations';
import { Db } from './types';

export type { Db, SqlParam, RunResult } from './types';

let dbPromise: Promise<Db> | null = null;

/** Shared, migrated connection. Opened lazily on first use (UI or headless task). */
export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = openDatabase();
      await migrate(db);
      return db;
    })();
    // allow a retry on the next call if opening/migrating failed
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

/** Replaces the shared connection (tests, scripts pointing at another file). Migrates it first. */
export async function useDb(db: Db): Promise<Db> {
  await migrate(db);
  dbPromise = Promise.resolve(db);
  return db;
}

export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  dbPromise = null;
  db.close();
}
