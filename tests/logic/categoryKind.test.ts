// A category's kind in the plan ("В плане"): migration 67 fills it from the plans, the plan's writes keep it, a change
// of it moves the months not over yet, a new month gets the items by it.
jest.mock('../../src/shared/navigation/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../../src/db';
import { openDatabase } from '../../src/db/driver';
import { migrate, MIGRATIONS } from '../../src/db/migrations';
import { addPlanItem, categoryPlanKind, currentYm, listPlan, setCategoryPlanKind, setPlanAmount, ymOf } from '../../src/db/plans';
import { setRegularItem } from '../../src/db/plans/regular';
import { createCategory, setRecurring } from '../../src/db/categories';
import { freshDb } from '../helpers';

const M1 = '2099-01', M2 = '2099-02', M3 = '2099-03';

beforeEach(() => freshDb());

test('migration 67: the kind from this month\'s item, else the last month\'s before (a later one if none); a fund, repeating payments; never planned — none', async () => {
  const db = openDatabase(':memory:');
  await migrate(db, MIGRATIONS.slice(0, 66));
  const now = currentYm();
  const [y, m] = now.split('-').map(Number);
  const past = ymOf(y, m - 3), next = ymOf(y, m + 1);
  const cat = async (name: string, recurring = 0) => (await db.run('INSERT INTO categories (name, recurring) VALUES (?, ?)', [name, recurring])).lastInsertRowid;
  const item = (ym: string, id: number, kind: string, every: string | null = null) =>
    db.run('INSERT INTO plan_items (ym, category_id, limit_minor, kind, every) VALUES (?, ?, 100, ?, ?)', [ym, id, kind, every]);
  const food = await cat('Еда'); await item(now, food, 'limit');
  const lunch = await cat('Обеды'); await item(now, lunch, 'fixed', 'day');
  const repair = await cat('Ремонт'); await item(past, repair, 'fixed'); await item(next, repair, 'limit');
  const taxi = await cat('Такси'); await item(next, taxi, 'limit');
  const rent = await cat('Аренда', 1); await item(now, rent, 'subs');
  const trip = await cat('Отпуск');
  await db.run("INSERT INTO funds (category_id, target_minor, currency, due, start_minor, since_ym) VALUES (?, 100000, 'GEL', '2099-01-31', 0, ?)", [trip, now]);
  const none = await cat('Разное');
  await migrate(db);
  const kinds = await db.all<{ name: string; plan_kind: string | null }>(
    'SELECT name, plan_kind FROM categories WHERE id IN (?, ?, ?, ?, ?, ?, ?) ORDER BY id', [food, lunch, repair, taxi, rent, trip, none]);
  expect(kinds.map((k) => k.plan_kind)).toEqual(['limit', 'regular', 'oneoff', 'limit', 'regular', 'fund', null]);
  expect(await db.get("SELECT plan_kind FROM categories WHERE system = 'subs'")).toEqual({ plan_kind: null });
});

test('the plan\'s writes in a month not over yet set the kind; a past month\'s don\'t', async () => {
  const id = await createCategory('Ремонт', '🔧');
  await setPlanAmount(M1, id, 30000, 'fixed');
  expect(await categoryPlanKind(id)).toBe('oneoff');
  await setRegularItem(M1, id, { every: 'week', weekdays: 1, unit_minor: 500, until: null }, 'GEL');
  expect(await categoryPlanKind(id)).toBe('regular');
  await setPlanAmount(M1, id, 30000, 'limit');
  expect(await categoryPlanKind(id)).toBe('limit');
  await setPlanAmount('2000-01', id, 100, 'fixed');
  expect(await categoryPlanKind(id)).toBe('limit');
  await setRecurring(id, true);
  expect(await categoryPlanKind(id)).toBe('regular');
  await setRecurring(id, false);
  expect(await categoryPlanKind(id)).toBeNull();
});

test('added to a month: the item as the category\'s kind says', async () => {
  const id = await createCategory('Подарки', '🎁');
  await setCategoryPlanKind(id, 'oneoff', M1);
  await addPlanItem(M1, id);
  expect((await listPlan(M1)).find((i) => i.category_id === id)).toMatchObject({ kind: 'fixed' });
});

test('changed: this month and the coming ones planned become it — a one-off is gone from the later ones, a limit back in them', async () => {
  const id = await createCategory('Одежда', '👕');
  await setPlanAmount(M1, id, 20000, 'limit');
  await listPlan(M3);
  const of = async (ym: string) => (await listPlan(ym)).find((i) => i.category_id === id);
  expect(await of(M2)).toMatchObject({ kind: 'limit', limit_minor: 20000 });
  await setCategoryPlanKind(id, 'oneoff', M1);
  expect(await of(M1)).toMatchObject({ kind: 'fixed', limit_minor: 20000 });
  expect(await of(M2)).toBeUndefined();
  expect(await of(M3)).toBeUndefined();
  await setCategoryPlanKind(id, 'limit', M1);
  expect(await of(M1)).toMatchObject({ kind: 'limit' });
  expect(await of(M3)).toMatchObject({ kind: 'limit', limit_minor: 20000 });
});

test('a regular payment or a fund: "Импульсивные покупки" off', async () => {
  const id = await createCategory('Аренда', '🏠');
  const db = await getDb();
  await db.run('UPDATE categories SET impulse = 1 WHERE id = ?', [id]);
  await setCategoryPlanKind(id, 'regular', M1);
  expect(await db.get('SELECT impulse, plan_kind FROM categories WHERE id = ?', [id])).toEqual({ impulse: 0, plan_kind: 'regular' });
});
