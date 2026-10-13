// "Копилки" (db/plans/funds.ts): the contribution, the months, the spending from it, a shortage, deleting.
import { freshDb } from '../helpers';
import { getDb } from '../../src/db';
import {
  contributionOf, deleteFund, fundLedger, getFund, listPlan, monthStats, monthsBetween, planHistory, restoreFund, setFund, setPlanBudget,
} from '../../src/db/plans';
import { createCategory } from '../../src/db/categories';
import { addManualTransaction } from '../../src/db/transactions';

const at = (s: string) => Math.floor(new Date(s).getTime() / 1000);
const spend = (amount: number, categoryId: number, when: string, kind: 'purchase' | 'refund' = 'purchase') =>
  addManualTransaction({ amount_minor: amount, category_id: categoryId, occurred_at: at(when), kind, currency: 'GEL' });
const HOLIDAY = { target_minor: 300000, currency: 'GEL' as const, due: '2027-07-31', start_minor: 0 };

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00'), advanceTimers: true });
  await freshDb();
});
afterEach(() => jest.useRealTimers());

test('the contribution: what is left over the months left with the due one, rounded up to whole units', () => {
  expect(monthsBetween('2026-10', '2027-07')).toBe(10);
  expect(monthsBetween('2027-08', '2027-07')).toBe(0);
  expect(contributionOf(HOLIDAY, '2026-10', 0)).toBe(30000);
  expect(contributionOf(HOLIDAY, '2026-11', 120000)).toBe(20000);
  expect(contributionOf(HOLIDAY, '2026-11', 0)).toBe(33400); // 3 000 / 9 = 333.33 → 334
  expect(contributionOf(HOLIDAY, '2027-08', 0)).toBe(0);
  expect(contributionOf(HOLIDAY, '2026-12', 400000)).toBe(0);
});

test('made: its plan item is the contribution, "Уже отложено" lowers it; the next month counts it again from what is saved', async () => {
  const id = await createCategory('Отпуск', '🏖');
  expect(await setFund('2026-10', id, { ...HOLIDAY, start_minor: 102000 })).toBe(19800);
  const [item] = await listPlan('2026-10');
  expect(item).toMatchObject({ category_id: id, kind: 'fund', limit_minor: 19800 });
  // spent 420 in October: November's contribution covers it
  await spend(42000, id, '2026-10-12T18:00:00');
  const nov = (await listPlan('2026-11')).find((i) => i.category_id === id)!;
  // saved 1 020 + 198 − 420 = 798; 2 202 over 9 months = 244.67 → 245
  expect(nov).toMatchObject({ kind: 'fund', limit_minor: 24500 });
});

test('the months: contributions in, spending out; past what is saved — a shortage, the month\'s', async () => {
  const id = await createCategory('Страховка', '📄');
  const db = await getDb();
  // made in August, the past months' contributions as they were planned
  await db.run("INSERT INTO funds (category_id, target_minor, currency, due, start_minor, since_ym) VALUES (?, 60000, 'GEL', '2027-03-15', 0, '2026-08')", [id]);
  for (const ym of ['2026-08', '2026-09']) await db.run("INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency) VALUES (?, ?, 5000, 'fund', 'GEL')", [ym, id]);
  await spend(4000, id, '2026-09-20T12:00:00');
  await spend(9000, id, '2026-09-25T12:00:00');
  await spend(1000, id, '2026-09-26T12:00:00', 'refund');
  const { months, balance } = await fundLedger((await getFund(id))!, '2026-09');
  expect(months).toEqual([
    { ym: '2026-08', contribution: 5000, spent: 0, shortage: 0, start: 0, end: 5000 },
    { ym: '2026-09', contribution: 5000, spent: 12000, shortage: 3000, start: 5000, end: 1000 },
  ]);
  expect(balance).toBe(1000);
});

test('deleted: what it saved up to last month goes to this month\'s savings, its items from now on go; "Отменить" puts them back', async () => {
  const id = await createCategory('Ноутбук', '💻');
  const db = await getDb();
  await db.run("INSERT INTO funds (category_id, target_minor, currency, due, start_minor, since_ym) VALUES (?, 150000, 'GEL', '2027-01-31', 10000, '2026-09')", [id]);
  await db.run("INSERT INTO plan_months (ym) VALUES ('2026-09')");
  await db.run("INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency) VALUES ('2026-09', ?, 35000, 'fund', 'GEL')", [id]);
  await setPlanBudget('2026-10', 500000);
  await listPlan('2026-10');
  await listPlan('2026-11');
  const deleted = await deleteFund(id);
  expect(deleted).toMatchObject({ released: 45000 });
  expect(await getFund(id)).toMatchObject({ closed_ym: '2026-10', released_minor: 45000 });
  expect((await listPlan('2026-10')).map((i) => i.category_id)).not.toContain(id);
  expect(await db.all('SELECT ym FROM plan_items WHERE category_id = ? ORDER BY ym', [id])).toEqual([{ ym: '2026-09' }]);

  await restoreFund(deleted!);
  expect(await getFund(id)).toMatchObject({ closed_ym: null, released_minor: null });
  expect((await db.all<{ ym: string }>('SELECT ym FROM plan_items WHERE category_id = ? ORDER BY ym', [id])).map((r) => r.ym)).toEqual(['2026-09', '2026-10', '2026-11']);
});

test('the month\'s stats: a fund\'s spending apart, not in the totals but its shortage; the history spends its contribution', async () => {
  const fund = await createCategory('Отпуск', '🏖');
  const food = await createCategory('Еда', '🛒');
  const db = await getDb();
  await db.run("INSERT INTO funds (category_id, target_minor, currency, due, start_minor, since_ym) VALUES (?, 300000, 'GEL', '2027-07-31', 100000, '2026-09')", [fund]);
  await db.run("INSERT INTO plan_months (ym, budget_minor) VALUES ('2026-09', 500000)");
  await db.run("INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency) VALUES ('2026-09', ?, 20000, 'fund', 'GEL')", [fund]);
  await db.run("INSERT INTO plan_items (ym, category_id, limit_minor, currency) VALUES ('2026-09', ?, 50000, 'GEL')", [food]);
  await spend(30000, food, '2026-09-05T12:00:00');
  await spend(130000, fund, '2026-09-20T12:00:00');

  const stats = await monthStats(2026, 8);
  expect(stats.categories.map((c) => c.category_id)).toEqual([food]);
  expect(stats.funds).toEqual([expect.objectContaining({
    category_id: fund, spent_minor: 130000, available_minor: 120000, shortage_minor: 10000, left_minor: 0, contribution_minor: 20000,
  })]);
  // the food and what the fund lacked
  expect(stats.spent_minor).toBe(40000);
  expect(stats.planned_minor).toBe(50000);

  const sep = (await planHistory()).find((m) => m.ym === '2026-09')!;
  // food 300 + the contribution 200 + the shortage 100
  expect(sep).toMatchObject({ spent_minor: 60000, planned_minor: 70000, funds_minor: 20000 });
});

test('deleted this month: the history gives what it saved to this month\'s savings', async () => {
  const id = await createCategory('Ноутбук', '💻');
  const db = await getDb();
  await db.run("INSERT INTO funds (category_id, target_minor, currency, due, start_minor, since_ym) VALUES (?, 150000, 'GEL', '2027-01-31', 10000, '2026-09')", [id]);
  await db.run("INSERT INTO plan_months (ym) VALUES ('2026-09')");
  await db.run("INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency) VALUES ('2026-09', ?, 35000, 'fund', 'GEL')", [id]);
  await setPlanBudget('2026-10', 500000);
  await deleteFund(id);
  const [oct] = await planHistory();
  expect(oct).toMatchObject({ ym: '2026-10', released: [{ name: 'Ноутбук', emoji: '💻', minor: 45000 }] });
});
