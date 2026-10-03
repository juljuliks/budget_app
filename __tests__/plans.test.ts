jest.mock('../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../src/db';
import { openDatabase } from '../src/db/driver';
import { migrate, MIGRATIONS } from '../src/db/migrations';
import {
  addPlanItem, currentYm, ensureMonthPlan, getPlanBudget, listPlan, monthIncome, monthRange, monthStats, planHistory,
  removePlanItem, setPlanAmount, setPlanBudget, setPlanPinned, ymOf,
} from '../src/db/plans';
import { createCategory, deleteCategory } from '../src/db/categories';
import { addManualTransaction } from '../src/db/transactions';
import { freshDb } from './helpers';
import { NEUTRAL_COLOR } from '../src/colors';

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
    expect(await getPlanBudget(M1)).toBe(60000);
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
    expect(await getPlanBudget(M2)).toBe(300000);
  });

  test('month income = GEL deposits of the month', async () => {
    await spend(250000, null, 2099, 0, 'deposit');
    await spend(1000, null, 2099, 0, 'deposit', 'USD');
    await spend(500, null, 2099, 0);
    await spend(7000, null, 2099, 1, 'deposit');
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
