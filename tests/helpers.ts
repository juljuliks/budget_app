import { openDatabase } from '../src/db/driver';
import { useDb, closeDb } from '../src/db';
import { setRatesFetcher } from '../src/fx/nbg';

// no network in tests: rates are inserted by the tests that need them
setRatesFetcher(async () => []);

/** Fresh in-memory DB with all migrations applied, installed as the shared connection. */
export async function freshDb() {
  await closeDb();
  return useDb(openDatabase(':memory:'));
}
