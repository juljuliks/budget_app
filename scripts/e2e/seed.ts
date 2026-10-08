// The database the end-to-end flows start from (scripts/e2e/run.sh): "Покупки" with this month's operations of
// merchants of its own (ZARA, HM), a hand-picked one (WOLT) and past ones (ZARA, APPLE); "Одежда", "Техника" to move
// them to; "Пустая" with past operations only. Dates are around today.
// Usage: npx tsc -p scripts/e2e && node dist-e2e/scripts/e2e/seed.js out.db
import fs from 'fs';
import { openDatabase } from '../../src/db/driver';
import { closeDb, getDb, useDb } from '../../src/db';
import { createCategory, findCategoryByName, updateCategory } from '../../src/db/categories';
import { setRatesFetcher } from '../../src/db/fx';
import { currentYm, setPlanAmount } from '../../src/db/plans';
import { addManualTransaction, markTransactionsSeen } from '../../src/db/transactions';
import { backfillRule, createRule } from '../../src/categorize';

setRatesFetcher(async () => []);

const now = new Date();
/** this month: the 1st, `hour` o'clock (the operations come before any of today's) */
const thisMonth = (hour: number) => Math.floor(new Date(now.getFullYear(), now.getMonth(), 1, hour).getTime() / 1000);
/** two months back, the 10th */
const pastMonth = (hour: number) => Math.floor(new Date(now.getFullYear(), now.getMonth() - 2, 10, hour).getTime() / 1000);

async function buy(merchant: string, lari: number, at: number, categoryId: number | null = null) {
  const id = await addManualTransaction({ amount_minor: Math.round(lari * 100), currency: 'GEL', category_id: categoryId, occurred_at: at, kind: 'purchase' });
  // as if from an SMS: the merchant and its key
  await (await getDb()).run("UPDATE transactions SET raw_merchant = ?, merchant_key = ?, category_source = CASE WHEN category_id IS NULL THEN NULL ELSE 'user' END WHERE id = ?",
    [merchant, merchant.toUpperCase(), id]);
  return id;
}
/** the merchant's category: its operations follow it */
async function rule(merchant: string, categoryId: number) {
  await createRule('exact', merchant, categoryId);
  await backfillRule('exact', merchant, categoryId);
}

/** the default categories exist already: those are reused (with this emoji), the rest created */
async function category(name: string, emoji: string) {
  const existing = await findCategoryByName(name, null);
  if (!existing) return createCategory(name, emoji, null);
  await updateCategory(existing.id, { name, emoji, typeId: null });
  return existing.id;
}

async function main(out: string) {
  if (fs.existsSync(out)) fs.unlinkSync(out);
  await useDb(openDatabase(out));

  const shop = await category('Покупки', '🛍️');
  await category('Одежда', '👕');
  await category('Техника', '💻');
  const empty = await category('Пустая', '📦');
  const food = await category('Продукты', '🛒');

  await buy('ZARA', 100, pastMonth(12));
  await buy('APPLE', 900, pastMonth(13));
  await buy('OLDSHOP', 40, pastMonth(14));
  await buy('ZARA', 200, thisMonth(10));
  await buy('ZARA', 50, thisMonth(11));
  await buy('HM', 80, thisMonth(12));
  await buy('WOLT', 30, thisMonth(13), shop); // hand-picked
  await buy('SPAR', 25, thisMonth(14));
  for (const m of ['ZARA', 'APPLE', 'HM']) await rule(m, shop);
  await rule('OLDSHOP', empty);
  await rule('SPAR', food);
  await setPlanAmount(currentYm(), shop, 50000);

  const db = await getDb();
  const all = await db.all<{ id: number }>('SELECT id FROM transactions');
  await markTransactionsSeen(all.map((r) => r.id));
  await closeDb();
  console.log(`e2e database: ${out} (${all.length} operations)`);
}

main(process.argv[2] ?? 'e2e.db').catch((e) => { console.error(e); process.exit(1); });
