// Node driver (Jest, scripts/). Metro picks driver.native.ts instead on device.
import path from 'path';
import Database from 'better-sqlite3';
import { Db, SqlParam } from './types';
import { makeTransaction } from './transaction';

const DEFAULT_PATH = path.join(process.cwd(), 'data', 'app.db');

export function openDatabase(file: string = process.env.BUDGET_DB_PATH || DEFAULT_PATH): Db {
  const db = new Database(file);
  const run = async (sql: string, params: SqlParam[] = []) => {
    const info = db.prepare(sql).run(...params);
    return { changes: info.changes, lastInsertRowid: Number(info.lastInsertRowid) };
  };

  return {
    run,
    get: async (sql, params = []) => db.prepare(sql).get(...params) as any,
    all: async (sql, params = []) => db.prepare(sql).all(...params) as any[],
    transaction: makeTransaction(run),
    close: () => db.close(),
  };
}
