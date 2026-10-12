// An operation split between categories (db/parts.ts): what counts where, and what keeps the parts right.
import { freshDb } from '../helpers';
import { getDb } from '../../src/db';
import { createCategory, deleteCategory, moveTransactionsOutOfCategory, categorySummary } from '../../src/db/categories';
import { mergeCategories } from '../../src/db/mergeCategories';
import { countSplit, getParts, splitTransaction, unsplitTransactions } from '../../src/db/parts';
import { spendRows, spendingEntries } from '../../src/db/plans/spend';
import {
  categoriesWithTransactions, deleteTransactions, getTransaction, listTransactionsFiltered, restoreTransactions,
  setCategoryForTransactions, setTransactionAmount, setTransactionCategory,
} from '../../src/db/transactions';

const at = (y: number, m: number, d: number) => Math.floor(new Date(y, m - 1, d, 12).getTime() / 1000);
const OCT = [at(2026, 10, 1) - 12 * 3600, at(2026, 11, 1) - 12 * 3600] as const;
let seq = 0;

async function purchase(categoryId: number | null, amount: number, occurredAt = at(2026, 10, 12)) {
  const db = await getDb();
  return (await db.run(
    `INSERT INTO transactions (bank, kind, amount_minor, currency, merchant_key, raw_merchant, category_id, category_source, occurred_at, raw_sms, sms_hash)
      VALUES ('tbc', 'purchase', ?, 'GEL', 'CARREFOUR', 'CARREFOUR', ?, 'rule', ?, '', ?)`, [amount, categoryId, occurredAt, `s${seq++}`])).lastInsertRowid;
}

/** Spent per category in October, as the stats count it. */
async function spentBy() {
  const m = new Map<number | null, number>();
  for (const r of await spendRows(...OCT)) m.set(r.category_id, (m.get(r.category_id) ?? 0) + r.amount_minor);
  return Object.fromEntries(m);
}

let food: number, home: number, fun: number;
beforeEach(async () => {
  await freshDb();
  food = await createCategory('Еда', '🛒');
  home = await createCategory('Хозтовары', '🧴');
  fun = await createCategory('Развлечения', '🎮');
});

test('each part counts in its category; the own one gets the rest, the merchant\'s choice is kept off it', async () => {
  const id = await purchase(food, 8640);
  await splitTransaction(id, food, [{ category_id: home, amount_minor: 2200 }]);
  expect(await spentBy()).toEqual({ [food]: 6440, [home]: 2200 });
  expect(await getParts(id)).toEqual([{ category_id: home, amount_minor: 2200 }]);
  expect((await getTransaction(id))!.category_source).toBe('user');
  expect(await countSplit([id])).toBe(1);
  await expect(splitTransaction(id, food, [{ category_id: home, amount_minor: 8640 }])).rejects.toThrow();
});

test('filtered by a part\'s category: the operation is listed, the day sums only the part; the filter offers it', async () => {
  const id = await purchase(food, 8640);
  await purchase(fun, 1000);
  await splitTransaction(id, food, [{ category_id: home, amount_minor: 2200 }]);
  expect((await listTransactionsFiltered({ categories: [home] })).map((r) => r.id)).toEqual([id]);
  expect((await listTransactionsFiltered({ category: food })).map((r) => r.id)).toEqual([id]);
  const day = await spendingEntries(...OCT, 'GEL', { categories: [home] });
  expect(day.map((e) => e.spent_minor)).toEqual([2200]);
  expect((await categoriesWithTransactions()).find((c) => c.category === home)?.count).toBe(1);
  expect(await categorySummary(home)).toEqual({ count: 1, totals: [{ currency: 'GEL', amount_minor: 2200 }] });
});

test('the amount corrected: the own category takes the difference; below the parts, they shrink in proportion', async () => {
  const id = await purchase(food, 10000);
  await splitTransaction(id, food, [{ category_id: home, amount_minor: 3000 }, { category_id: fun, amount_minor: 1000 }]);
  await setTransactionAmount(id, 9000, 'GEL');
  expect(await spentBy()).toEqual({ [food]: 5000, [home]: 3000, [fun]: 1000 });
  await setTransactionAmount(id, 3000, 'GEL');
  expect(await spentBy()).toEqual({ [food]: 1667, [home]: 1000, [fun]: 333 });
});

test('the own category changed to a part\'s: they merge; none — the split is gone', async () => {
  const id = await purchase(food, 8640);
  await splitTransaction(id, food, [{ category_id: home, amount_minor: 2200 }, { category_id: fun, amount_minor: 1000 }]);
  await setTransactionCategory(id, home, 'user');
  expect(await spentBy()).toEqual({ [home]: 7640, [fun]: 1000 });
  await setTransactionCategory(id, null, 'user');
  expect(await getParts(id)).toEqual([]);
});

test('deleted and brought back ("Отменить"): with its parts; "Убрать разделение" — all in the own category', async () => {
  const id = await purchase(food, 8640);
  await splitTransaction(id, food, [{ category_id: home, amount_minor: 2200 }]);
  const gone = await deleteTransactions([id]);
  expect(await getParts(id)).toEqual([]);
  await restoreTransactions(gone);
  expect(await getParts(id)).toEqual([{ category_id: home, amount_minor: 2200 }]);
  await unsplitTransactions([id]);
  expect(await spentBy()).toEqual({ [food]: 8640 });
});

test('several at once into a category: whole; sorting out a category being deleted moves only the part in it', async () => {
  const a = await purchase(food, 8640);
  const b = await purchase(food, 5000);
  await splitTransaction(a, food, [{ category_id: home, amount_minor: 2200 }]);
  await splitTransaction(b, food, [{ category_id: home, amount_minor: 1000 }]);
  await setCategoryForTransactions([b], fun);
  expect(await getParts(b)).toEqual([]);
  await setCategoryForTransactions([a], fun, undefined, home);
  expect((await getTransaction(a))!.category_id).toBe(food);
  expect(await getParts(a)).toEqual([{ category_id: fun, amount_minor: 2200 }]);
});

test('a category deleted or merged: its parts move along, into the own category they merge back', async () => {
  const a = await purchase(food, 8640);
  await splitTransaction(a, food, [{ category_id: home, amount_minor: 2200 }]);
  await moveTransactionsOutOfCategory([a], home, fun);
  expect(await getParts(a)).toEqual([{ category_id: fun, amount_minor: 2200 }]);
  await mergeCategories(food, [fun], 'Еда', null, null);
  expect(await getParts(a)).toEqual([]);
  expect(await spentBy()).toEqual({ [food]: 8640 });

  await splitTransaction(a, food, [{ category_id: home, amount_minor: 2200 }]);
  await deleteCategory(home, null, '2026-10');
  expect(await getParts(a)).toEqual([]);
});
