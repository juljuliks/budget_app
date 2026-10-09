jest.mock('../../src/shared/navigation/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../../src/db';
import { dateKey, ensureRates, makeConverter } from '../../src/db/fx';
import { setRatesFetcher } from '../../src/fx/nbg';
import {
  addPlanItem, getPlanBudget, listPlan, monthStats, OverBudgetError, periodStats, planHistory, setPlanAmount, setPlanBudget, ymOf,
} from '../../src/db/plans';
import { addManualTransaction } from '../../src/db/transactions';
import { freshDb } from '../helpers';

const rate = async (date: string, currency: string, gel: number) =>
  (await getDb()).run('INSERT OR REPLACE INTO fx_rates (date, currency, gel_per_unit) VALUES (?, ?, ?)', [date, currency, gel]);
const at = (y: number, m: number, d: number) => Math.floor(new Date(y, m, d, 12).getTime() / 1000);

beforeEach(async () => {
  await freshDb();
  setRatesFetcher(async () => []);
});

test('converter: the day\'s rate, else the nearest earlier, else the nearest later; GEL is 1; cross rates', async () => {
  await rate('2026-09-10', 'USD', 2.5);
  await rate('2026-09-20', 'USD', 2.7);
  await rate('2026-09-20', 'EUR', 3.0);
  const conv = await makeConverter();
  expect(conv(1000, 'USD', 'GEL', '2026-09-10')).toBe(2500);
  expect(conv(1000, 'USD', 'GEL', '2026-09-15')).toBe(2500); // nearest earlier
  expect(conv(1000, 'USD', 'GEL', '2026-09-01')).toBe(2500); // only later ones
  expect(conv(2700, 'GEL', 'USD', '2026-09-25')).toBe(1000);
  expect(conv(3000, 'EUR', 'USD', '2026-09-20')).toBe(3333);
  expect(conv(500, 'GEL', 'GEL', 'x')).toBe(500);
  expect(conv(500, 'XXX', 'GEL', '2026-09-20')).toBeNull();
});

test('rates are fetched once per missing day and cached (National Bank of Georgia format)', async () => {
  const fetcher = jest.fn(async (url: string) => [{ currencies: [
    { code: 'USD', quantity: 1, rate: 2.6 }, { code: 'EUR', quantity: 1, rate: 3.0 },
  ] }]);
  setRatesFetcher(fetcher);
  await ensureRates(['2026-09-15', '2026-09-15', '2026-09-16']);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][0]).toContain('currencies=USD&currencies=EUR&date=');
  await ensureRates(['2026-09-15']);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect((await makeConverter())(100, 'USD', 'GEL', '2026-09-15')).toBe(260);
});

test('a failing request is ignored: no rate, the spending stays out of the totals as unconverted', async () => {
  setRatesFetcher(async () => { throw new Error('offline'); });
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await addManualTransaction({ amount_minor: 1000, currency: 'USD', category_id: 1, occurred_at: at(2026, 8, 10) });
  await addManualTransaction({ amount_minor: 500, currency: 'GEL', category_id: 1, occurred_at: at(2026, 8, 10) });
  const s = await monthStats(2026, 8, 'GEL');
  expect(s.spent_minor).toBe(500);
  expect(s.other_currencies).toEqual([{ currency: 'USD', spent_minor: 1000 }]);
  warn.mockRestore();
});

test('stats in any currency: each transaction on its day\'s rate, the plan on the month\'s plan date', async () => {
  await rate('2026-09-05', 'USD', 2.5);
  await rate('2026-09-25', 'USD', 3.0);
  await rate('2026-09-30', 'USD', 3.0);
  await addManualTransaction({ amount_minor: 2500, currency: 'GEL', category_id: 1, occurred_at: at(2026, 8, 5) });  // = 10 USD
  await addManualTransaction({ amount_minor: 1000, currency: 'USD', category_id: 1, occurred_at: at(2026, 8, 25) }); // = 30 GEL
  const usd = await monthStats(2026, 8, 'USD');
  expect(usd.currency).toBe('USD');
  expect(usd.spent_minor).toBe(2000);
  const gel = await monthStats(2026, 8, 'GEL');
  expect(gel.spent_minor).toBe(5500);
  const day = await periodStats(at(2026, 8, 25) - 3600, at(2026, 8, 25) + 3600, 'GEL');
  expect(day.spent_minor).toBe(3000);
});

test('plan: every amount in its own currency; the cap and totals are converted to the amount to distribute\'s', async () => {
  const M = '2099-01';
  await rate('2099-01-31', 'USD', 2.5);
  await setPlanBudget(M, 100000, 'GEL');                  // 1000 GEL
  await addPlanItem(M, 1); await setPlanAmount(M, 1, 20000, undefined, 'USD'); // 200 USD = 500 GEL
  await addPlanItem(M, 2); await setPlanAmount(M, 2, 40000);                     // 400 GEL (the budget's currency)
  const items = await listPlan(M);
  expect(items.map((i) => [i.category_id, i.limit_minor, i.currency, i.converted_minor])).toEqual([
    [1, 20000, 'USD', 50000], [2, 40000, 'GEL', 40000],
  ]);
  // 300 GEL more would be 1200 > 1000
  await expect(setPlanAmount(M, 3, 30000)).rejects.toBeInstanceOf(OverBudgetError);
  await expect(setPlanBudget(M, 80000, 'GEL')).rejects.toHaveProperty('planned_minor', 90000);
  // the amount to distribute in USD: 400 USD = 1000 GEL still holds the 900 GEL planned
  await setPlanBudget(M, 40000, 'USD');
  expect(await getPlanBudget(M)).toMatchObject({ amount_minor: 40000, currency: 'USD' });
  // the next month carries the currencies over
  const next = await listPlan('2099-02');
  expect(next.map((i) => i.currency)).toEqual(['USD', 'GEL']);
  expect(await getPlanBudget('2099-02')).toMatchObject({ amount_minor: 40000, currency: 'USD' });
});

test('history in another currency', async () => {
  const now = new Date();
  const today = dateKey(Date.now() / 1000);
  await rate(today, 'USD', 2.0);
  await addManualTransaction({ amount_minor: 4000, currency: 'GEL', category_id: 1, occurred_at: Math.floor(Date.now() / 1000) - 60 });
  const ym = ymOf(now.getFullYear(), now.getMonth());
  await setPlanBudget(ym, 10000, 'GEL');
  const h = await planHistory(ym, 'USD');
  expect(h[0]).toEqual(expect.objectContaining({ ym, spent_minor: 2000, budget_minor: 5000 }));
});

test('average per month: only full months with data, not the current one nor a first partial one', async () => {
  const { averageFullMonths } = require('../../src/db/plans');
  const now = new Date(2026, 9, 4); // 4 Oct 2026
  // tracking starts on 15 Jul: July is partial, Aug and Sep are full, October is not over
  await addManualTransaction({ amount_minor: 99900, category_id: 1, occurred_at: at(2026, 6, 15) });
  await addManualTransaction({ amount_minor: 100000, category_id: 1, occurred_at: at(2026, 7, 5) });
  await addManualTransaction({ amount_minor: 200000, category_id: 1, occurred_at: at(2026, 8, 20) });
  await addManualTransaction({ amount_minor: 50000, category_id: 1, occurred_at: at(2026, 9, 2) });
  expect(await averageFullMonths('2026-01-01', '2026-12-31', 'GEL', now)).toEqual({ average_minor: 150000, months: 2 });
  // only September fully inside this range
  expect(await averageFullMonths('2026-08-10', '2026-10-04', 'GEL', now)).toEqual({ average_minor: 200000, months: 1 });
  // no full month yet
  expect(await averageFullMonths('2026-09-10', '2026-10-04', 'GEL', now)).toBeNull();
});

test("a category's usual spending: the latest full months (up to 3) before the plan month", async () => {
  const { categoryMonthlyAverage } = require('../../src/db/plans');
  const now = new Date(2026, 9, 4); // 4 Oct 2026
  // tracking starts on 15 May: May is partial; Jun–Sep are full
  await addManualTransaction({ amount_minor: 99900, category_id: 1, occurred_at: at(2026, 4, 15) });
  await addManualTransaction({ amount_minor: 90000, category_id: 1, occurred_at: at(2026, 5, 5) });
  await addManualTransaction({ amount_minor: 30000, category_id: 1, occurred_at: at(2026, 6, 5) });
  await addManualTransaction({ amount_minor: 60000, category_id: 1, occurred_at: at(2026, 7, 5) });
  await addManualTransaction({ amount_minor: 90000, category_id: 1, occurred_at: at(2026, 8, 5) });
  await addManualTransaction({ amount_minor: 70000, category_id: 2, occurred_at: at(2026, 8, 6) });
  await addManualTransaction({ amount_minor: 50000, category_id: 1, occurred_at: at(2026, 9, 2) });
  // October's plan (and November's: the current month isn't over): Jul–Sep, only this category
  expect(await categoryMonthlyAverage(1, '2026-10', 'GEL', now)).toEqual({ average_minor: 60000, months: 3, from: '2026-07', to: '2026-09' });
  expect(await categoryMonthlyAverage(1, '2026-11', 'GEL', now)).toEqual({ average_minor: 60000, months: 3, from: '2026-07', to: '2026-09' });
  // August's plan: Jun–Jul (May is partial)
  expect(await categoryMonthlyAverage(1, '2026-08', 'GEL', now)).toEqual({ average_minor: 60000, months: 2, from: '2026-06', to: '2026-07' });
  // June's plan: no full month before it
  expect(await categoryMonthlyAverage(1, '2026-06', 'GEL', now)).toBeNull();
});
