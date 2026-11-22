// «Итоги года» (db/yearReport.ts, stats/yearFacts.ts): the months, the totals, best and worst, where it went.
import { freshDb } from '../helpers';
import { getDb } from '../../src/db';
import { yearCurrency, yearReport } from '../../src/db/yearReport';
import { createCategory, topUpCategoryId } from '../../src/db/categories';
import { setPlanAmount, setPlanBudget } from '../../src/db/plans';
import { addManualTransaction } from '../../src/db/transactions';

const at = (day: string) => Math.floor(new Date(`${day}T12:00:00`).getTime() / 1000);
let food = 0;
let tech = 0;
async function spend(lari: number, category: number, day: string, merchant = 'SHOP') {
  const id = await addManualTransaction({ amount_minor: lari * 100, category_id: category, occurred_at: at(day), kind: 'purchase', currency: 'GEL' });
  await (await getDb()).run('UPDATE transactions SET raw_merchant = ?, merchant_key = ? WHERE id = ?', [merchant, merchant, id]);
}

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00'), advanceTimers: true });
  await freshDb();
  food = await createCategory('Еда', '🍎');
  tech = await createCategory('Техника', '💻');
  const topUp = (await topUpCategoryId())!;
  // July: no plan; August — 2 000, 400 spent; September — 700 of Еда's 600 and 900 on Техника; October — 100 so far
  await spend(500, food, '2026-07-10');
  for (const ym of ['2026-08', '2026-09', '2026-10']) {
    await setPlanBudget(ym, 200000, 'GEL', 0, true, 0);
    await setPlanAmount(ym, food, 60000, 'limit');
  }
  for (const ym of ['2026-07', '2026-08']) await addManualTransaction({ amount_minor: 300000, category_id: topUp, occurred_at: at(`${ym}-01`), kind: 'deposit', currency: 'GEL' });
  await spend(400, food, '2026-08-05', 'SPAR');
  await spend(700, food, '2026-09-05', 'SPAR');
  await spend(900, tech, '2026-09-20', 'ZOOMMER');
  await spend(100, food, '2026-10-02', 'SPAR');
});
afterEach(() => jest.useRealTimers());

test('the months: none before the first operation, future after now; a month without a plan — what came in and was spent', async () => {
  const r = await yearReport(2026, 'GEL', '2026-10');
  expect(r.months.map((m) => m.state)).toEqual([...Array(6).fill('none'), 'data', 'data', 'data', 'data', 'future', 'future']);
  expect(r.months.slice(6, 10).map((m) => [m.income, m.spent, m.saved, m.pct, m.hasPlan])).toEqual([
    [300000, 50000, null, null, false], [300000, 40000, 160000, 80, true], [0, 160000, 40000, 20, true], [0, 10000, 190000, 95, true]]);
  expect(r).toMatchObject({ count: 4, over: false, income: 600000, spent: 260000, saved: 390000, budget: 600000, planMonths: 3 });
  // 390 000 over 3 months with a budget, 2 more to come
  expect(r.pace).toBe(650000);
});

test('best and worst with the main reason; the biggest categories, how often over their plan', async () => {
  const r = await yearReport(2026, 'GEL', '2026-10');
  expect(r.best).toEqual({ ym: '2026-10', saved: 190000, pct: 95 });
  // Техника outside the plan (900) more than Еда past it (100)
  expect(r.worst).toEqual({ ym: '2026-09', saved: 40000, reason: '💻 Техника вне плана' });
  // a month on average over the full months, as the stats: July (data from the 1st — a deposit), August, September; October is on
  expect(r.average).toEqual({ minor: 83333, months: 3 });
  // Еда's plan in the full months: August, September — over in September
  expect(r.top.map((c) => [c.label, c.sum, c.perMonth, c.overIn, c.planned])).toEqual([['🍎 Еда', 170000, 53333, 1, 2], ['💻 Техника', 90000, 30000, 0, 0]]);
});

test('a year over: no pace, no future months', async () => {
  const r = await yearReport(2026, 'GEL', '2027-02');
  expect(r).toMatchObject({ over: true, pace: null });
  expect(r.months.every((m) => m.state !== 'future')).toBe(true);
});

test('the year\'s currency: the budget\'s of its last month with one (budgets in different ones); none — the app\'s', async () => {
  // August and September in lari, October in dollars
  await setPlanBudget('2026-10', 100000, 'USD', 0, true, 0);
  expect(await yearCurrency(2026, 'EUR', '2026-10')).toBe('USD');
  // looked at in September: October is ahead
  expect(await yearCurrency(2026, 'EUR', '2026-09')).toBe('GEL');
  expect(await yearCurrency(2025, 'EUR', '2026-10')).toBe('EUR');
});

test('«Отложено» of the year in the last budget\'s currency, the rest in the system one', async () => {
  await (await getDb()).run("INSERT INTO fx_rates (date, currency, gel_per_unit) VALUES ('2026-10-01', 'USD', 2.5), ('2026-10-15', 'USD', 2.5)");
  await setPlanBudget('2026-10', 80000, 'USD', 0, true, 0);
  const r = await yearReport(2026, 'GEL', '2026-10');
  expect(r.currency).toBe('GEL');
  expect(r.savedIn).toEqual({ currency: 'USD', rate: 0.4 });
  expect((await yearReport(2026, 'USD', '2026-10')).savedIn).toBeNull();
});

