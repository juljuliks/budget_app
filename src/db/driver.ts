// Node driver (Jest, scripts/). Metro picks driver.native.ts instead on device.
import path from 'path';
import Database from 'better-sqlite3';
import { Db, SqlParam } from './types';
import { serialized } from './transaction';

const DEFAULT_PATH = path.join(process.cwd(), 'data', 'app.db');

export function openDatabase(file: string = process.env.BUDGET_DB_PATH || DEFAULT_PATH): Db {
  const db = new Database(file);
  // Same as on device (SQLite default): FK enforcement off. better-sqlite3 turns it on, which made
  // table rebuilds in migrations cascade-delete rows on Node only. Integrity is kept by the app code.
  db.pragma('foreign_keys = OFF');
  const run = async (sql: string, params: SqlParam[] = []) => {
    const info = db.prepare(sql).run(...params);
    return { changes: info.changes, lastInsertRowid: Number(info.lastInsertRowid) };
  };

  return serialized({
    run,
    get: async (sql: string, params: SqlParam[] = []) => db.prepare(sql).get(...params) as any,
    all: async (sql: string, params: SqlParam[] = []) => db.prepare(sql).all(...params) as any[],
    close: () => db.close(),
  });
}
