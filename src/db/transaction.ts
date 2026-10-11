import { Db, RunResult, SqlParam } from './types';

type Raw = {
  run(sql: string, params?: SqlParam[]): Promise<RunResult>;
  get<T = any>(sql: string, params?: SqlParam[]): Promise<T | undefined>;
  all<T = any>(sql: string, params?: SqlParam[]): Promise<T[]>;
  close(): void;
};

/** Statements run on any connection so far: the stats' query budget is tested against it (tests/logic/statsQueries). */
export const queryCounter = { count: 0 };

/**
 * One queue for every statement on the connection: a statement from elsewhere (the headless SMS task, the UI)
 * waits until an open transaction ends instead of running inside it (and being rolled back with it).
 * A transaction gets its own handle `tx` that skips the queue; everything inside it must use `tx` — calling
 * getDb() there would wait for the transaction itself. tx.transaction() joins the open one.
 */
export function serialized(raw: Raw): Db {
  let queue: Promise<unknown> = Promise.resolve();
  const counted = <A extends unknown[], R>(f: (...a: A) => R) => (...a: A): R => { queryCounter.count++; return f(...a); };
  const run = counted(raw.run), get = counted(raw.get) as Raw['get'], all = counted(raw.all) as Raw['all'];
  const enqueue = <T>(op: () => Promise<T>): Promise<T> => {
    const next = queue.then(op);
    queue = next.catch(() => undefined);
    return next;
  };

  const db: Db = {
    run: (sql, params) => enqueue(() => run(sql, params)),
    get: (sql, params) => enqueue(() => get(sql, params)),
    all: (sql, params) => enqueue(() => all(sql, params)),
    transaction: (fn) => enqueue(async () => {
      const tx: Db = {
        run, get, all,
        transaction: (inner) => inner(tx),
        close: raw.close,
      };
      await run('BEGIN');
      try {
        const result = await fn(tx);
        await run('COMMIT');
        return result;
      } catch (e) {
        // the original error matters, not a failed rollback
        try { await raw.run('ROLLBACK'); } catch { /* ignore */ }
        throw e;
      }
    }),
    close: () => raw.close(),
  };
  return db;
}
