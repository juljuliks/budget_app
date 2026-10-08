// After a flow (scripts/e2e/run.sh): what the database pulled from the emulator must hold.
// Usage: node dist-e2e/scripts/e2e/verify.js <flow name> app.db
import Database from 'better-sqlite3';

const [flow, file] = process.argv.slice(2);
// a copy pulled from the emulator (with its -wal next to it): opened writable so the WAL is read
const db = new Database(file);
const failures: string[] = [];
function expect(what: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const now = new Date();
const monthStart = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
const cat = (name: string) => db.prepare('SELECT id, deleted_at FROM categories WHERE name = ?').get(name) as { id: number; deleted_at: number | null } | undefined;
const idOf = (name: string) => cat(name)?.id ?? null;
/** a merchant's operations, this month's or the past's: [category name, source] each */
const ops = (merchant: string, past: boolean) => (db.prepare(
  `SELECT c.name AS category, t.category_source AS source FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.merchant_key = ? AND t.occurred_at ${past ? '<' : '>='} ? ORDER BY t.occurred_at`).all(merchant, monthStart) as Array<{ category: string | null; source: string | null }>)
  .map((r) => [r.category, r.source]);
/** the category a merchant gives its new operations (null: none) */
const ruleOf = (merchant: string) => (db.prepare(
  "SELECT c.name FROM merchant_rules r JOIN categories c ON c.id = r.category_id WHERE r.match_type = 'exact' AND r.pattern = ?").get(merchant) as { name: string } | undefined)?.name ?? null;
const deleted = (name: string) => !!cat(name)?.deleted_at;

switch (flow) {
  case 'delete-empty':
    expect('Пустая deleted (kept for the past)', deleted('Пустая'), true);
    expect('OLDSHOP past stays, fixed', ops('OLDSHOP', true), [['Пустая', 'user']]);
    expect('OLDSHOP loses its category', ruleOf('OLDSHOP'), null);
    expect('Покупки untouched', deleted('Покупки'), false);
    break;
  case 'delete-move-all':
    expect('Покупки deleted', deleted('Покупки'), true);
    expect("ZARA this month → Одежда", ops('ZARA', false).map((o) => o[0]), ['Одежда', 'Одежда']);
    expect('ZARA past stays, fixed', ops('ZARA', true), [['Покупки', 'user']]);
    expect('APPLE past stays, fixed', ops('APPLE', true), [['Покупки', 'user']]);
    expect('HM, WOLT this month → Одежда', [ops('HM', false)[0][0], ops('WOLT', false)[0][0]], ['Одежда', 'Одежда']);
    expect('merchants → Одежда', ['ZARA', 'APPLE', 'HM'].map(ruleOf), ['Одежда', 'Одежда', 'Одежда']);
    expect('the plan of Покупки gone', db.prepare('SELECT count(*) AS n FROM plan_items WHERE category_id = ?').get(idOf('Покупки')), { n: 0 });
    break;
  case 'delete-sort-out':
    expect('Покупки deleted', deleted('Покупки'), true);
    expect('ZARA this month → Одежда, following it', ops('ZARA', false), [['Одежда', 'rule'], ['Одежда', 'rule']]);
    expect('ZARA past stays, fixed', ops('ZARA', true), [['Покупки', 'user']]);
    expect('ZARA → Одежда', ruleOf('ZARA'), 'Одежда');
    expect('HM this month → Техника (only the operation)', ops('HM', false).map((o) => o[0]), ['Техника']);
    expect('HM loses Покупки with the delete', ruleOf('HM'), null);
    expect('WOLT → none', ops('WOLT', false).map((o) => o[0]), [null]);
    expect('APPLE past stays, fixed', ops('APPLE', true), [['Покупки', 'user']]);
    break;
  case 'delete-sort-out-leave':
    expect('Покупки kept', deleted('Покупки'), false);
    expect('ZARA moved before leaving', ops('ZARA', false).map((o) => o[0]), ['Одежда', 'Одежда']);
    expect('ZARA past stays', ops('ZARA', true), [['Покупки', 'user']]);
    expect('HM still in Покупки', ops('HM', false).map((o) => o[0]), ['Покупки']);
    break;
  default:
    failures.push(`unknown flow ${flow}`);
}

if (failures.length) {
  console.error(`✕ ${flow}\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ ${flow}: the database is as expected`);
