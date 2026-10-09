jest.mock('../../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../../src/db';
import { openDatabase } from '../../src/db/driver';
import { migrate, MIGRATIONS } from '../../src/db/migrations';
import {
  addPlanItem, currentYm, ensureMonthPlan, getPlanBudget, listPlan, monthIncome, monthRange, monthStats, periodStats, planHistory,
  removePlanItem, setPlanAmount, setPlanBudget, setPlanPinned, ymOf,
} from '../../src/db/plans';
import { createCategory, deleteCategory, topUpCategoryId } from '../../src/db/categories';
import { addManualTransaction } from '../../src/db/transactions';
import { freshDb } from '../helpers';
import { NEUTRAL_COLOR } from '../../src/colors';

const NOW = currentYm(new Date());
const at = (year: number, month: number, day = 10) => Math.floor(new Date(year, month, day, 12).getTime() / 1000);
const spend = (amount: number, categoryId: number | null, year: number, month: number, kind: 'purchase' | 'refund' | 'deposit' | 'transfer' | 'withdrawal' = 'purchase', currency = 'GEL') =>
  addManualTransaction({ amount_minor: amount, category_id: categoryId, occurred_at: at(year, month), kind, currency });

const brief = (items: Awaited<ReturnType<typeof listPlan>>) =>
  items.map((i) => ({ id: i.category_id, limit: i.limit_minor, pinned: i.pinned, prev: i.previous_minor }));

beforeEach(() => freshDb());

describe('ymOf / monthRange', () => {
  test('normalizes month overflow', () => {
    expect(ymOf(2026, 12)).toBe('2027-01');
    expect(ymOf(2026, -1)).toBe('2025-12');
  });
  test('December -> January range', () => {
    const [from, to] = monthRange(2026, 11);
    expect(new Date(from * 1000)).toEqual(new Date(2026, 11, 1));
    expect(new Date(to * 1000)).toEqual(new Date(2027, 0, 1));
  });
});

describe('carry-over', () => {
  // future months so ensureMonthPlan always treats them as current/future
  const M1 = '2099-01', M2 = '2099-02', M3 = '2099-03';

  test('new month: pinned items keep the amount, others come empty with last amount as a hint, removed ones stay out', async () => {
    await addPlanItem(M1, 1); await setPlanAmount(M1, 1, 30000); await setPlanPinned(M1, 1, true);
    await addPlanItem(M1, 2); await setPlanAmount(M1, 2, 5000);
    await addPlanItem(M1, 3); await setPlanAmount(M1, 3, 7000); await removePlanItem(M1, 3);

    expect(brief(await listPlan(M2))).toEqual([
      { id: 1, limit: 30000, pinned: true, prev: 30000 },
      { id: 2, limit: 0, pinned: false, prev: 5000 },
    ]);
  });

  test('carries over from the latest planned month even if months were skipped', async () => {
    await addPlanItem(M1, 1); await setPlanAmount(M1, 1, 100); await setPlanPinned(M1, 1, true);
    expect(brief(await listPlan(M3))).toEqual([{ id: 1, limit: 100, pinned: true, prev: 100 }]);
  });

  test('a month is initialized once: later edits of the previous month do not leak in', async () => {
    await addPlanItem(M1, 1); await setPlanAmount(M1, 1, 100); await setPlanPinned(M1, 1, true);
    await listPlan(M2);
    await setPlanAmount(M1, 1, 999);
    expect((await listPlan(M2))[0].limit_minor).toBe(100);
  });

  test('editing the current month does not touch the previous one', async () => {
    await addPlanItem(M1, 1); await setPlanAmount(M1, 1, 100); await setPlanPinned(M1, 1, true);
    await setPlanAmount(M2, 1, 500);
    await addPlanItem(M2, 4);
    expect(brief(await listPlan(M1))).toEqual([{ id: 1, limit: 100, pinned: true, prev: null }]);
  });

  test('deleted categories are not carried over', async () => {
    await addPlanItem(M1, 1); await setPlanPinned(M1, 1, true); await setPlanAmount(M1, 1, 100);
    await deleteCategory(1, null, M2);
    expect(await listPlan(M2)).toEqual([]);
    // the earlier month keeps it
    expect(brief(await listPlan(M1))).toEqual([{ id: 1, limit: 100, pinned: true, prev: null }]);
  });

  test('past months are never auto-initialized', async () => {
    await addPlanItem(M1, 1); await setPlanPinned(M1, 1, true); await setPlanAmount(M1, 1, 100);
    await ensureMonthPlan('2098-06', '2099-05');
    const db = await getDb();
    expect(await db.get("SELECT * FROM plan_months WHERE ym = '2098-06'")).toBeUndefined();
  });

  test('deleting a category removes its plan items from the current month on', async () => {
    const id = await createCategory('Спорт');
    await addPlanItem(M1, id);
    await deleteCategory(id, null, M1);
    expect(await listPlan(M1)).toEqual([]);
  });
});

describe('monthStats', () => {
  test('uses the month plan; amount 0 counts as "no limit"', async () => {
    const now = new Date();
    const [y, m] = [now.getFullYear(), now.getMonth()];
    await addPlanItem(NOW, 1); await setPlanAmount(NOW, 1, 10000);
    await addPlanItem(NOW, 2); // no amount yet
    await spend(2500, 1, y, m);
    await spend(500, 1, y, m, 'refund');
    await spend(99999, null, y, m, 'deposit');
    await spend(999, 1, y, m, 'purchase', 'USD');

    const s = await monthStats(y, m);
    expect(s.planned_minor).toBe(10000);
    expect(s.spent_minor).toBe(2000);
    expect(s.categories).toEqual([expect.objectContaining({ category_id: 1, spent_minor: 2000, limit_minor: 10000 })]);
    expect(s.other_currencies).toEqual([{ currency: 'USD', spent_minor: 999 }]);
  });

  test('each category carries its chart color; uncategorized is neutral', async () => {
    await spend(100, 1, 2026, 7);
    await spend(50, null, 2026, 7);
    const byId = new Map((await monthStats(2026, 7)).categories.map((c) => [c.category_id, c.color]));
    expect(byId.get(1)).toMatch(/^#[0-9a-f]{6}$/);
    expect(byId.get(null)).toBe(NEUTRAL_COLOR);
  });
});

describe('adding a category takes its last planned amount', () => {
  const M1 = '2099-01', M3 = '2099-03';

  test('amount and kind come from the last month that planned it; an explicit amount wins', async () => {
    await setPlanAmount(M1, 1, 30000, 'fixed');
    await removePlanItem('2099-02', 1); // February plans without it
    await addPlanItem(M3, 1);
    expect((await listPlan(M3)).find((i) => i.category_id === 1)).toEqual(expect.objectContaining({ limit_minor: 30000, kind: 'fixed' }));
    await addPlanItem(M3, 2, 0);
    expect((await listPlan(M3)).find((i) => i.category_id === 2)!.limit_minor).toBe(0);
  });

  test('starts empty when the last amount no longer fits the amount to distribute', async () => {
    await setPlanAmount(M1, 1, 30000);
    await removePlanItem('2099-02', 1);
    await setPlanBudget(M3, 20000);
    await addPlanItem(M3, 1);
    expect((await listPlan(M3)).find((i) => i.category_id === 1)!.limit_minor).toBe(0);
  });
});

describe('plan item kind (limit / fixed payment)', () => {
  const M1 = '2099-01', M2 = '2099-02';

  test('new items are limits; kind is set with the amount, kept when omitted and carried over', async () => {
    await addPlanItem(M1, 1);
    expect((await listPlan(M1))[0].kind).toBe('limit');
    await setPlanAmount(M1, 1, 50000, 'fixed'); await setPlanPinned(M1, 1, true);
    await setPlanAmount(M1, 1, 60000);
    expect((await listPlan(M1))[0]).toEqual(expect.objectContaining({ limit_minor: 60000, kind: 'fixed' }));
    expect((await listPlan(M2))[0]).toEqual(expect.objectContaining({ limit_minor: 60000, kind: 'fixed' }));
  });

  test('month stats carry the kind; no plan -> null', async () => {
    const now = new Date();
    await setPlanAmount(NOW, 1, 1000, 'fixed');
    await spend(300, 2, now.getFullYear(), now.getMonth());
    const s = await monthStats(now.getFullYear(), now.getMonth());
    const byId = new Map(s.categories.map((c) => [c.category_id, c.plan_kind]));
    expect(byId.get(1)).toBe('fixed');
    expect(byId.get(2)).toBeNull();
  });
});

describe('amount to distribute', () => {
  const M1 = '2099-01', M2 = '2099-02';

  test('caps the plan: an item amount over the free remainder is refused', async () => {
    await setPlanBudget(M1, 100000);
    await addPlanItem(M1, 1); await setPlanAmount(M1, 1, 60000);
    await addPlanItem(M1, 2);
    await expect(setPlanAmount(M1, 2, 50000)).rejects.toHaveProperty('planned_minor', 110000);
    await setPlanAmount(M1, 2, 40000); // exactly the rest
    await setPlanAmount(M1, 1, 50000); // lowering is always fine
    expect((await listPlan(M1)).map((i) => i.limit_minor)).toEqual([50000, 40000]);
  });

  test('cannot be set below what is already planned; null removes the cap', async () => {
    await addPlanItem(M1, 1); await setPlanAmount(M1, 1, 60000);
    await expect(setPlanBudget(M1, 50000)).rejects.toHaveProperty('budget_minor', 50000);
    expect(await getPlanBudget(M1)).toBeNull();
    await setPlanBudget(M1, 60000);
    expect(await getPlanBudget(M1)).toMatchObject({ amount_minor: 60000, currency: 'GEL' });
    await setPlanBudget(M1, null);
    await setPlanAmount(M1, 1, 99999999);
    expect(await getPlanBudget(M1)).toBeNull();
  });

  test('stats "＋ В план": setting an amount adds the item; over the free amount nothing is added', async () => {
    await setPlanBudget(M1, 100000);
    await addPlanItem(M1, 1); await setPlanAmount(M1, 1, 70000);
    await expect(setPlanAmount(M1, 2, 40000)).rejects.toHaveProperty('planned_minor', 110000);
    expect((await listPlan(M1)).map((i) => i.category_id)).toEqual([1]);
    await setPlanAmount(M1, 2, 30000);
    expect((await listPlan(M1)).map((i) => [i.category_id, i.limit_minor])).toEqual([[1, 70000], [2, 30000]]);
  });

  test('carries over to the next month', async () => {
    await setPlanBudget(M1, 300000);
    expect(await getPlanBudget(M2)).toMatchObject({ amount_minor: 300000, currency: 'GEL' });
  });

  test('month income = the deposits of the month in "Пополнение счёта" (GEL; no rate: not counted)', async () => {
    const topUp = (await topUpCategoryId())!;
    await spend(250000, topUp, 2099, 0, 'deposit');
    await spend(1000, topUp, 2099, 0, 'deposit', 'USD');
    await spend(500, null, 2099, 0);
    await spend(3000, null, 2099, 0, 'deposit'); // without a category: not counted
    await spend(7000, topUp, 2099, 1, 'deposit');
    expect(await monthIncome(M1)).toBe(250000);
  });

  test('history carries the amount', async () => {
    await setPlanBudget(NOW, 200000);
    expect((await planHistory())[0]).toEqual(expect.objectContaining({ ym: NOW, budget_minor: 200000 }));
  });
});

describe('planHistory', () => {
  test('lists every month from the first transaction to now with plan vs spent', async () => {
    const now = new Date();
    const back2 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    await spend(1000, 1, back2.getFullYear(), back2.getMonth());
    await spend(300, 1, now.getFullYear(), now.getMonth());
    await addPlanItem(NOW, 1); await setPlanAmount(NOW, 1, 800);

    const h = await planHistory();
    expect(h.map((x) => x.ym)).toEqual([
      NOW,
      ymOf(now.getFullYear(), now.getMonth() - 1),
      ymOf(back2.getFullYear(), back2.getMonth()),
    ]);
    expect(h[0]).toEqual({ ym: NOW, planned_minor: 800, spent_minor: 300, budget_minor: null });
    expect(h[1]).toEqual(expect.objectContaining({ planned_minor: 0, spent_minor: 0 }));
    expect(h[2]).toEqual(expect.objectContaining({ planned_minor: 0, spent_minor: 1000 }));
  });

  test('empty DB has no history', async () => {
    expect(await planHistory()).toEqual([]);
  });
});

test('migration 3 turns the old standing plan into pinned items of the current month', async () => {
  const db = openDatabase(':memory:');
  await migrate(db, MIGRATIONS.slice(0, 2));
  await db.run('INSERT INTO budgets (category_id, limit_minor) VALUES (1, 5000), (2, 700)');
  await migrate(db);
  expect(await db.all('SELECT ym, category_id, limit_minor, pinned FROM plan_items ORDER BY category_id')).toEqual([
    { ym: NOW, category_id: 1, limit_minor: 5000, pinned: 1 },
    { ym: NOW, category_id: 2, limit_minor: 700, pinned: 1 },
  ]);
  expect(await db.get("SELECT name FROM sqlite_master WHERE name = 'budgets'")).toBeUndefined();
});

test('period stats list the planned categories even with nothing spent, after the spent ones', async () => {
  const bars = await createCategory('Бары');
  const food = await createCategory('Еда');
  const taxi = await createCategory('Такси');
  await spend(500, food, 2025, 9, 'purchase');
  const day = { from: at(2025, 9) - 3600, to: at(2025, 9) + 3600 };
  const s = await periodStats(day.from, day.to, 'GEL', [taxi, bars]);
  expect(s.categories.map((c) => [c.name, c.spent_minor])).toEqual([['Еда', 500], ['Бары', 0], ['Такси', 0]]);
  expect(s.spent_minor).toBe(500);
  // nothing spent at all: the planned ones
  const empty = await periodStats(day.from - 86400, day.from - 3600, 'GEL', [taxi, bars]);
  expect(empty.categories.map((c) => [c.name, c.spent_minor])).toEqual([['Бары', 0], ['Такси', 0]]);
  expect((await periodStats(day.from - 86400, day.from - 3600, 'GEL')).categories).toEqual([]);
});

describe('the unplanned share of the budget', () => {
  const { getPlanBudget, setPlanBudget, setPlanAmount, ensureMonthPlan } = require('../../src/db/plans');
  const { getDb } = require('../../src/db');
  const cat = async (name: string) => (await (await getDb()).run('INSERT INTO categories (name) VALUES (?)', [name])).lastInsertRowid;

  test('the plan can take only the budget minus the share; the share carries over', async () => {
    const food = await cat('Еда');
    await setPlanBudget('2026-10', 100000, 'GEL', 20);
    expect(await getPlanBudget('2026-10')).toMatchObject({ amount_minor: 100000, unplanned_pct: 20, plannable_minor: 80000 });
    await setPlanAmount('2026-10', food, 80000);
    await expect(setPlanAmount('2026-10', food, 80001)).rejects.toHaveProperty('budget_minor', 80000);
    // more share than the plan leaves: refused
    await expect(setPlanBudget('2026-10', 100000, 'GEL', 30)).rejects.toHaveProperty('budget_minor', 70000);
    // the amount changed without a share: the stored one is kept
    await setPlanBudget('2026-10', 110000, 'GEL');
    expect(await getPlanBudget('2026-10')).toMatchObject({ unplanned_pct: 20, plannable_minor: 88000 });
    await ensureMonthPlan('2026-11', '2026-10');
    expect(await getPlanBudget('2026-11')).toMatchObject({ amount_minor: 110000, unplanned_pct: 20 });
  });
});

describe('savings', () => {
  const { monthStats, getPlanBudget, setPlanBudget, ensureMonthPlan } = require('../../src/db/plans');
  const { savingsCategoryId, deleteCategory, updateCategory, getCategory } = require('../../src/db/categories');
  const { addManualTransaction } = require('../../src/db/transactions');

  test('an operation in "Сбережения" is money put aside, not spending', async () => {
    const savings = await savingsCategoryId();
    expect(savings).not.toBeNull();
    const at = Math.floor(new Date('2026-10-03T12:00:00').getTime() / 1000);
    await addManualTransaction({ amount_minor: 5000, category_id: savings, occurred_at: at });
    await addManualTransaction({ amount_minor: 1000, category_id: null, occurred_at: at });
    const stats = await monthStats(2026, 9, 'GEL');
    expect(stats.spent_minor).toBe(1000);
  });

  test('the system category keeps its name and cannot be deleted', async () => {
    const savings = await savingsCategoryId();
    await updateCategory(savings, { name: 'Другое имя', emoji: '💰', typeId: null });
    expect(await getCategory(savings)).toMatchObject({ name: 'Сбережения', emoji: '💰' });
    await expect(deleteCategory(savings, null)).rejects.toThrow();
  });

  test('the leftover goes to savings by default; the choice carries over', async () => {
    await setPlanBudget('2026-10', 100000, 'GEL');
    expect(await getPlanBudget('2026-10')).toMatchObject({ to_savings: true });
    await setPlanBudget('2026-10', 100000, 'GEL', 0, false);
    await ensureMonthPlan('2026-11', '2026-10');
    expect(await getPlanBudget('2026-11')).toMatchObject({ to_savings: false });
  });
});

describe('locked for savings', () => {
  const { getPlanBudget, setPlanBudget, setPlanAmount, ensureMonthPlan } = require('../../src/db/plans');
  const { getDb } = require('../../src/db');
  test('the plan can take neither the share outside it nor what is locked; the lock carries over', async () => {
    const food = (await (await getDb()).run("INSERT INTO categories (name) VALUES ('Еда')")).lastInsertRowid;
    await setPlanBudget('2026-10', 100000, 'GEL', 10, true, 20000);
    expect(await getPlanBudget('2026-10')).toMatchObject({ locked_minor: 20000, plannable_minor: 70000 });
    await setPlanAmount('2026-10', food, 70000);
    await expect(setPlanAmount('2026-10', food, 70001)).rejects.toHaveProperty('budget_minor', 70000);
    await expect(setPlanBudget('2026-10', 100000, 'GEL', 10, true, 20001)).rejects.toHaveProperty('planned_minor', 70000);
    await ensureMonthPlan('2026-11', '2026-10');
    expect(await getPlanBudget('2026-11')).toMatchObject({ locked_minor: 20000 });
  });
});

test('the share outside the plan as an amount of one\'s own', async () => {
  const { getPlanBudget, setPlanBudget, unplannedOf } = require('../../src/db/plans');
  await setPlanBudget('2026-10', 100000, 'GEL', 0, true, 0, 12345);
  const b = await getPlanBudget('2026-10');
  expect(unplannedOf(b)).toBe(12345);
  expect(b.plannable_minor).toBe(100000 - 12345);
  await setPlanBudget('2026-10', 100000, 'GEL', 20, true, 0, null);
  expect(unplannedOf(await getPlanBudget('2026-10'))).toBe(20000);
});
