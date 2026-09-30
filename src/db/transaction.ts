import { Db } from './types';

// Wraps BEGIN/COMMIT/ROLLBACK around fn. Calls are chained so two transactions
// started concurrently (e.g. headless SMS task + UI) never interleave.
export function makeTransaction(run: Db['run']): Db['transaction'] {
  let queue: Promise<unknown> = Promise.resolve();

  return <T>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.then(async () => {
      await run('BEGIN');
      try {
        const result = await fn();
        await run('COMMIT');
        return result;
      } catch (e) {
        await run('ROLLBACK');
        throw e;
      }
    });
    queue = next.catch(() => undefined);
    return next;
  };
}
