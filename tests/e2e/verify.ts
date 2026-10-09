// After a flow (tests/e2e/run.sh): what the database pulled from the emulator must hold.
// Usage: node dist-e2e/tests/e2e/verify.js <flow name> app.db
import Database from 'better-sqlite3';

const [flow, file] = process.argv.slice(2);
// a copy pulled from the emulator (with its -wal next to it): opened writable so the WAL is read
const db = new Database(file);
const failures: string[] = [];
function expect(what: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

/** the category a merchant gives its new operations (null: none) */
const ruleOf = (merchant: string) => (db.prepare(
  "SELECT c.name FROM merchant_rules r JOIN categories c ON c.id = r.category_id WHERE r.match_type = 'exact' AND r.pattern = ?").get(merchant) as { name: string } | undefined)?.name ?? null;

switch (flow) {
  case 'sms-receive':
    expect('only the bank\'s SMS: two operations', db.prepare(
      "SELECT raw_merchant AS m, kind, amount_minor AS a, category_id AS c, seen_at FROM transactions ORDER BY occurred_at").all(),
      [{ m: 'LONGSHOP', kind: 'purchase', a: 3300, c: null, seen_at: null }, { m: 'NEWSHOP', kind: 'purchase', a: 1200, c: null, seen_at: null }]);
    expect('the long SMS whole: its parts joined', (db.prepare("SELECT raw_sms AS t FROM transactions WHERE raw_merchant = 'LONGSHOP'").get() as { t: string }).t
      .endsWith('block the card in the TBC app right away.'), true);
    break;
  case 'import': {
    const imported = db.prepare(
      `SELECT t.raw_merchant AS m, t.kind, t.amount_minor AS a, c.name AS category, t.seen_at IS NOT NULL AS seen FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id WHERE t.sms_hash NOT LIKE 'manual:%' ORDER BY t.occurred_at`).all();
    expect('the 3 operations, once, read, the merchant\'s category applied', imported, [
      { m: 'SPAR', kind: 'purchase', a: 1100, category: 'Продукты', seen: 1 },
      { m: 'CARREFOUR', kind: 'purchase', a: 2200, category: null, seen: 1 },
      { m: 'NINO B', kind: 'transfer', a: 3300, category: null, seen: 1 },
    ]);
    break;
  }
  case 'import-denied':
  case 'import-empty':
    expect('nothing imported', db.prepare("SELECT count(*) AS n FROM transactions WHERE sms_hash NOT LIKE 'manual:%'").get(), { n: 0 });
    break;
  case 'notification-buttons':
  case 'notification-open': {
    const want = flow === 'notification-buttons' ? 'Продукты' : 'Кафе и рестораны';
    expect('NEWSHOP: the category picked, following its merchant', db.prepare(
      "SELECT c.name AS c, t.category_source AS s FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.raw_merchant = 'NEWSHOP'").get(),
      { c: want, s: 'rule' });
    expect('the merchant got it', ruleOf('NEWSHOP'), want);
    break;
  }
  default:
    failures.push(`unknown flow ${flow}`);
}

if (failures.length) {
  console.error(`✕ ${flow}\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ ${flow}: the database is as expected`);
