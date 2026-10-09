import { monthReport } from '../../src/db/report';
import { setPlanAmount, setPlanBudget } from '../../src/db/plans';
import { addManualTransaction } from '../../src/db/transactions';
import { getDb } from '../../src/db';
import { freshDb } from '../helpers';

beforeEach(() => freshDb());

const at = (d: string) => Math.floor(new Date(`${d}T12:00:00`).getTime() / 1000);

test('the month report: put aside, limits overspent, spending outside the plan past its share', async () => {
  const db = await getDb();
  const cat = async (name: string) => (await db.run('INSERT INTO categories (name) VALUES (?)', [name])).lastInsertRowid;
  const food = await cat('Еда'), bars = await cat('Бары'), rent = await cat('Квартира'), cafe = await cat('Кафе');
  await setPlanBudget('2026-09', 100000, 'GEL', 10); // 10% = 100 ₾ outside the plan
  await setPlanAmount('2026-09', food, 30000, 'limit');
  await setPlanAmount('2026-09', bars, 10000, 'limit');
  await setPlanAmount('2026-09', rent, 40000, 'fixed');
  await addManualTransaction({ amount_minor: 35000, category_id: food, occurred_at: at('2026-09-05') }); // +50 over
  await addManualTransaction({ amount_minor: 6000, category_id: bars, occurred_at: at('2026-09-06') });  // 40 under
  await addManualTransaction({ amount_minor: 15000, category_id: cafe, occurred_at: at('2026-09-07') }); // outside: 150 > 100
  await addManualTransaction({ amount_minor: 2000, category_id: null, occurred_at: at('2026-09-08') });  // outside too

  const r = await monthReport('2026-09', 'GEL');
  expect(r.spent).toBe(58000);
  expect(r.saved).toBe(42000);
  expect(r.overLimits.map((c) => c.name)).toEqual(['Еда']);
  expect(r.overLimitsTotal).toBe(5000);
  expect(r.unplannedSpent).toBe(17000);
  expect(r.unplannedOver).toBe(7000);
  expect(r.couldSaveMore).toBe(12000);
  // 170 of 580 spent outside the plan (29%) and the share passed by 70%: worth reviewing
  expect(r.review).toBe(true);
  expect(r.topUnplanned.map((c) => c.name)).toEqual(['Кафе']);
  expect(r.uncategorizedCount).toBe(1);
  expect(r.savedInPlan).toBe(4000);
  expect(r.unpaid.map((c) => c.name)).toEqual(['Квартира']);
});

test('an overspend under 5% of the plan is not in the report', async () => {
  const db = await getDb();
  const food = (await db.run("INSERT INTO categories (name) VALUES ('Еда')")).lastInsertRowid;
  await setPlanBudget('2026-09', 100000, 'GEL');
  await setPlanAmount('2026-09', food, 30000, 'limit');
  await addManualTransaction({ amount_minor: 31000, category_id: food, occurred_at: at('2026-09-05') }); // +3.3%
  const r = await monthReport('2026-09', 'GEL');
  expect(r.overLimits).toEqual([]);
  expect(r.couldSaveMore).toBe(0);
});

test('money moved to "Сбережения" is shown, and is not spending', async () => {
  const { savingsCategoryId } = require('../../src/db/categories');
  await setPlanBudget('2026-09', 100000, 'GEL');
  await addManualTransaction({ amount_minor: 20000, category_id: await savingsCategoryId(), occurred_at: at('2026-09-10') });
  const r = await monthReport('2026-09', 'GEL');
  expect(r.movedToSavings).toBe(20000);
  expect(r.spent).toBe(0);
  expect(r.saved).toBe(100000);
});

test('the year estimate averages the latest months with a budget and data; a late-started month is left out', async () => {
  await setPlanBudget('2026-07', 100000, 'GEL');
  await setPlanBudget('2026-08', 100000, 'GEL');
  await setPlanBudget('2026-09', 100000, 'GEL');
  // July: the app installed on the 25th — not a full month
  await addManualTransaction({ amount_minor: 10000, category_id: null, occurred_at: at('2026-07-25') });
  await addManualTransaction({ amount_minor: 40000, category_id: null, occurred_at: at('2026-08-03') });
  await addManualTransaction({ amount_minor: 20000, category_id: null, occurred_at: at('2026-09-02') });
  const r = await monthReport('2026-09', 'GEL');
  expect(r.average!.months.map((m) => m.ym)).toEqual(['2026-09', '2026-08']);
  expect(r.average!.saved).toBe(70000); // (80 000 + 60 000) / 2
  expect(r.previousSaved).toBe(60000);
  const aug = await monthReport('2026-08', 'GEL');
  expect(aug.previousSaved).toBeNull(); // July has too few operations to compare with
});

test('where "Отложено" comes from adds up to it', async () => {
  const db = await getDb();
  const food = (await db.run("INSERT INTO categories (name) VALUES ('Еда')")).lastInsertRowid;
  const subs = (await db.run("INSERT INTO categories (name) VALUES ('Подписки')")).lastInsertRowid;
  await setPlanBudget('2026-09', 500000, 'GEL', 10);
  await setPlanAmount('2026-09', food, 100000, 'limit');
  await setPlanAmount('2026-09', subs, 10000, 'fixed');
  await addManualTransaction({ amount_minor: 115000, category_id: food, occurred_at: at('2026-09-03') });
  await addManualTransaction({ amount_minor: 90000, category_id: null, occurred_at: at('2026-09-04') });
  const r = await monthReport('2026-09', 'GEL');
  const f = r.savedFrom!;
  expect(f).toEqual({ locked: 0, undistributed: 340000, plan: -5000, unplanned: -40000 });
  expect(f.locked + f.undistributed + f.plan + f.unplanned).toBe(r.saved);
});

test('locked savings: in the breakdown, and touched when spending passes budget − locked', async () => {
  await setPlanBudget('2026-09', 100000, 'GEL', 0, true, 30000);
  await addManualTransaction({ amount_minor: 75000, category_id: null, occurred_at: at('2026-09-03') });
  const r = await monthReport('2026-09', 'GEL');
  const f = r.savedFrom!;
  expect(f.locked).toBe(30000);
  expect(f.locked + f.undistributed + f.plan + f.unplanned).toBe(r.saved);
  expect(r.lockedTouched).toBe(5000);
});

test('a report only for a month with a plan: a budget or a category with an amount', async () => {
  const db = await getDb();
  const food = (await db.run("INSERT INTO categories (name) VALUES ('Еда')")).lastInsertRowid;
  await addManualTransaction({ amount_minor: 5000, category_id: food, occurred_at: at('2026-08-05') });
  expect((await monthReport('2026-08', 'GEL')).hasPlan).toBe(false);
  // a category in the plan without an amount yet is not a plan
  await db.run("INSERT INTO plan_items (ym, category_id, limit_minor, currency, kind, norm_period) VALUES ('2026-08', ?, 0, 'GEL', 'limit', 'day')", [food]);
  expect((await monthReport('2026-08', 'GEL')).hasPlan).toBe(false);
  await setPlanAmount('2026-08', food, 30000, 'limit');
  expect((await monthReport('2026-08', 'GEL')).hasPlan).toBe(true);
  await setPlanBudget('2026-07', 100000, 'GEL');
  expect((await monthReport('2026-07', 'GEL')).hasPlan).toBe(true);
});
