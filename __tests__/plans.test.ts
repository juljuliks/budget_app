jest.mock('../src/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../src/db';
import { openDatabase } from '../src/db/driver';
import { migrate, MIGRATIONS } from '../src/db/migrations';
import {
  addPlanItem, currentYm, ensureMonthPlan, listPlan, monthRange, monthStats, planHistory, removePlanItem,
  setPlanAmount, setPlanPinned, ymOf,
} from '../src/db/plans';
import { createCategory, deleteCategory, setCategoryArchived } from '../src/db/categories';
import { addManualTransaction } from '../src/db/transactions';
import { freshDb } from './helpers';

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

  test('archived categories are not carried over', async () => {
    await addPlanItem(M1, 1); await setPlanPinned(M1, 1, true); await setPlanAmount(M1, 1, 100);
    await setCategoryArchived(1, true);
    expect(await listPlan(M2)).toEqual([]);
  });

  test('past months are never auto-initialized', async () => {
    await addPlanItem(M1, 1); await setPlanPinned(M1, 1, true); await setPlanAmount(M1, 1, 100);
    await ensureMonthPlan('2098-06', '2099-05');
    const db = await getDb();
    expect(await db.get("SELECT * FROM plan_months WHERE ym = '2098-06'")).toBeUndefined();
  });

  test('deleting a category removes its plan items', async () => {
    const id = await createCategory('Спорт');
    await addPlanItem(M1, id);
    await deleteCategory(id);
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

  test('color rank follows all-time spend', async () => {
    await spend(100, 1, 2026, 7);
    await spend(9000, 2, 2026, 7);
    await spend(50, 1, 2026, 8);
    await spend(10, 2, 2026, 8);
    const rank = new Map((await monthStats(2026, 8)).categories.map((c) => [c.category_id, c.color_rank]));
    expect(rank.get(2)).toBe(0);
    expect(rank.get(1)).toBe(1);
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
    expect(h[0]).toEqual({ ym: NOW, planned_minor: 800, spent_minor: 300 });
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
