export type SqlParam = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

/**
 * Minimal async SQLite API shared by the device driver (react-native-quick-sqlite)
 * and the Node driver (better-sqlite3, used by Jest and scripts/).
 * Every call executes exactly one statement; params are positional (`?`).
 */
export interface Db {
  run(sql: string, params?: SqlParam[]): Promise<RunResult>;
  get<T = any>(sql: string, params?: SqlParam[]): Promise<T | undefined>;
  all<T = any>(sql: string, params?: SqlParam[]): Promise<T[]>;
  /**
   * Runs fn inside BEGIN/COMMIT with its own handle `tx`; rolls back if it throws. Every statement on the
   * connection is queued, so nothing from elsewhere runs inside the transaction. Inside fn use only `tx`.
   */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): void;
}
