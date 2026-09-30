// Device driver. Uses the SQLite bundled with react-native-quick-sqlite,
// so SQL features (e.g. ON CONFLICT DO UPDATE) don't depend on the Android version.
import { open } from 'react-native-quick-sqlite';
import { Db, SqlParam } from './types';
import { makeTransaction } from './transaction';

export function openDatabase(name = 'app.db'): Db {
  const conn = open({ name });
  const run = async (sql: string, params: SqlParam[] = []) => {
    const res = await conn.executeAsync(sql, params);
    return { changes: res.rowsAffected, lastInsertRowid: res.insertId ?? 0 };
  };
  const all = async (sql: string, params: SqlParam[] = []) => {
    const res = await conn.executeAsync(sql, params);
    return res.rows?._array ?? [];
  };

  return {
    run,
    all,
    get: async (sql, params) => (await all(sql, params))[0],
    transaction: makeTransaction(run),
    close: () => conn.close(),
  };
}
