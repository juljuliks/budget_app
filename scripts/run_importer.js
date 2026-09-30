// Usage: npx tsc && node scripts/run_importer.js   (DB path: $BUDGET_DB_PATH or data/app.db)
const path = require('path');
const { importFixtures } = require('../dist/src/importer/smsImporter');
const { getDb, closeDb } = require('../dist/src/db');

(async function () {
  const fixturesPath = path.join(process.cwd(), 'fixtures', 'tbc_sms_fixtures.json');
  const counts = await importFixtures(fixturesPath);
  console.log('Import result:', counts);
  const db = await getDb();
  const rows = await db.all('SELECT id, bank, kind, amount_minor, currency, raw_merchant, merchant_key, category_id, occurred_at FROM transactions ORDER BY id');
  console.log('Transactions:', JSON.stringify(rows, null, 2));
  await closeDb();
})().catch((e) => { console.error(e); process.exit(1); });
