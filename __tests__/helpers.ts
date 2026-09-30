import { openDatabase } from '../src/db/driver';
import { useDb, closeDb } from '../src/db';

/** Fresh in-memory DB with all migrations applied, installed as the shared connection. */
export async function freshDb() {
  await closeDb();
  return useDb(openDatabase(':memory:'));
}
