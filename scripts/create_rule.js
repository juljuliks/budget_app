// Usage: npx tsc && node scripts/create_rule.js exact "MC GOLD" 11 --backfill
const { createRule, backfillRule } = require('../dist/src/categorize');
const { closeDb } = require('../dist/src/db');

const args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: node scripts/create_rule.js <exact|prefix> <pattern> <categoryId> [--backfill]');
  process.exit(2);
}
const [matchType, pattern, categoryId, flag] = args;

(async function () {
  await createRule(matchType, pattern, Number(categoryId));
  console.log('Rule created', matchType, pattern, categoryId);
  if (flag === '--backfill') {
    const changed = await backfillRule(matchType, pattern, Number(categoryId));
    console.log('Backfill done, updated', changed);
  }
  await closeDb();
})().catch((e) => { console.error(e); process.exit(1); });
