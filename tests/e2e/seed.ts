// The database an end-to-end flow starts from (tests/e2e/run.sh), written to a file to push to the emulator: the
// flow's own (SEEDS, by its name), else `base` ("Покупки" with this month's operations of merchants of its own — ZARA,
// HM —, a hand-picked one — WOLT — and past ones; "Одежда", "Техника" to move them to; "Пустая" with past ones only).
// Usage: npx tsc -p tests/e2e && node dist-e2e/tests/e2e/seed.js <flow> out.db
import fs from 'fs';
import { openDatabase } from '../../src/db/driver';
import { closeDb, useDb } from '../../src/db';
import { setRatesFetcher } from '../../src/db/fx';
import { base, done, empty } from './seeds';

setRatesFetcher(async () => []);

/** Databases of their own, by flow name; any other flow starts from `base`. */
const SEEDS: Record<string, () => Promise<void>> = {
  'sms-receive': empty,
};

async function main(flow: string, out: string) {
  if (fs.existsSync(out)) fs.unlinkSync(out);
  await useDb(openDatabase(out));
  await (SEEDS[flow] ?? base)();
  await done();
  await closeDb();
  console.log(`e2e database for ${flow}: ${out}`);
}

main(process.argv[2] ?? 'base', process.argv[3] ?? 'e2e.db').catch((e) => { console.error(e); process.exit(1); });
