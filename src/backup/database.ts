// The database as a file: a copy of it (a backup), and the check of a file before it replaces the database.
import { getDb } from '../db';
import { openDatabase } from '../db/driver';
import { MIGRATIONS } from '../db/migrations';

/** Writes a consistent, compacted copy of the database to `path` (a file that doesn't exist yet). */
export async function exportDatabase(path: string): Promise<void> {
  await (await getDb()).run('VACUUM INTO ?', [path]);
}

/**
 * Why a file can't replace the database: not SQLite, damaged, not this app's (no operations, categories), or from a
 * newer version of the app (its schema has migrations this one doesn't know).
 */
export type BackupProblem = 'not-db' | 'broken' | 'not-ours' | 'newer';

/** Whether the file can replace the database (`name` as the driver takes it: a path on Node, a file of the app's on the phone). */
export async function checkBackup(name: string): Promise<BackupProblem | null> {
  let db: ReturnType<typeof openDatabase>;
  try { db = openDatabase(name); } catch { return 'not-db'; }
  try {
    const check = await db.get<{ integrity_check: string }>('PRAGMA integrity_check');
    if (check?.integrity_check !== 'ok') return 'broken';
    const tables = new Set((await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")).map((t) => t.name));
    if (!tables.has('transactions') || !tables.has('categories')) return 'not-ours';
    const version = (await db.get<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
    return version > MIGRATIONS.length ? 'newer' : null;
  } catch {
    // "file is not a database" comes on the first statement, not on opening
    return 'not-db';
  } finally {
    db.close();
  }
}
