// Device driver. Uses the SQLite bundled with react-native-quick-sqlite,
// so SQL features (e.g. ON CONFLICT DO UPDATE) don't depend on the Android version.
import { open } from 'react-native-quick-sqlite';
import { Db, SqlParam } from './types';
import { serialized } from './transaction';

export function openDatabase(name = 'app.db'): Db {
  const conn = open({ name });
  // Explicitly off (SQLite default) to match the Node driver; see driver.ts
  conn.execute('PRAGMA foreign_keys = OFF');
  const run = async (sql: string, params: SqlParam[] = []) => {
    const res = await conn.executeAsync(sql, params);
    return { changes: res.rowsAffected, lastInsertRowid: res.insertId ?? 0 };
  };
  const all = async (sql: string, params: SqlParam[] = []) => {
    const res = await conn.executeAsync(sql, params);
    return res.rows?._array ?? [];
  };

  return serialized({
    run,
    all,
    get: async (sql: string, params?: SqlParam[]) => (await all(sql, params))[0],
    close: () => conn.close(),
  });
}
