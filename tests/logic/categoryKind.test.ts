// A category's kind in the plan ("В плане"): migration 67 fills it from the plans, the plan's writes keep it, a change
// of it moves the months not over yet, a new month gets the items by it.
jest.mock('../../src/shared/navigation/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../../src/db';
import { openDatabase } from '../../src/db/driver';
import { migrate, MIGRATIONS } from '../../src/db/migrations';
import {
  addPlanItem, categoryPlanKind, categorySchedule, currentYm, listPlan, restoreSchedule, setCategoryPlanKind, setPlanAmount, setRegularItem, stopSchedule, ymOf,
} from '../../src/db/plans';
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

describe('a regular payment within the month is its category\'s schedule', () => {
  const lunches = { every: 'week' as const, weekdays: 1 | 8, unit_minor: 2000, until: null };

  test('set: the category has it; each new month gets it from there, counted by its days, whatever the month before had', async () => {
    const id = await createCategory('Обеды', '🍲');
    await setRegularItem(M1, id, lunches, 'GEL');
    expect(await categorySchedule(id)).toMatchObject({ every: 'week', weekdays: 9, unit_minor: 2000, currency: 'GEL', until: null });
    // the month before lost its item by hand: the schedule still brings it
    await (await getDb()).run('DELETE FROM plan_items WHERE ym = ? AND category_id = ?', [M1, id]);
    await setPlanAmount(M1, 1, 100, 'limit');
    const feb = (await listPlan(M2)).find((i) => i.category_id === id);
    expect(feb).toMatchObject({ kind: 'fixed', every: 'week', weekdays: 9, unit_minor: 2000 });
    // February 2099: 4 Mondays, 4 Thursdays
    expect(feb?.limit_minor).toBe(8 * 2000);
  });

  test('its end: no month after it gets it', async () => {
    const id = await createCategory('Обеды', '🍲');
    await setRegularItem(M1, id, { ...lunches, until: `${M1}-31` }, 'GEL');
    expect((await listPlan(M2)).find((i) => i.category_id === id)).toBeUndefined();
  });

  test('another kind or a monthly payment of its own: the schedule is gone', async () => {
    const id = await createCategory('Обеды', '🍲');
    await setRegularItem(M1, id, lunches, 'GEL');
    await setCategoryPlanKind(id, 'limit', M1);
    expect(await categorySchedule(id)).toBeNull();
    await setRegularItem(M1, id, lunches, 'GEL');
    await setRecurring(id, true);
    expect(await categorySchedule(id)).toBeNull();
  });

  test('removed from the plan: off, gone from this month on, no kind; "Отменить" — all back', async () => {
    const id = await createCategory('Обеды', '🍲');
    await setRegularItem(M1, id, lunches, 'GEL');
    await listPlan(M2);
    const stopped = await stopSchedule(M1, id);
    expect(await categorySchedule(id)).toBeNull();
    expect(await categoryPlanKind(id)).toBeNull();
    expect(await (await getDb()).get('SELECT count(*) AS n FROM plan_items WHERE category_id = ?', [id])).toEqual({ n: 0 });
    await restoreSchedule(stopped);
    expect(await categorySchedule(id)).toMatchObject({ unit_minor: 2000 });
    expect(await categoryPlanKind(id)).toBe('regular');
    expect((await listPlan(M2)).find((i) => i.category_id === id)).toMatchObject({ every: 'week' });
  });
});

test('migration 69: a regular payment within the month moves from its plan item onto its category', async () => {
  const db = openDatabase(':memory:');
  await migrate(db, MIGRATIONS.slice(0, 68));
  const now = currentYm();
  const id = (await db.run("INSERT INTO categories (name, plan_kind) VALUES ('Обеды', 'regular')")).lastInsertRowid;
  await db.run("INSERT INTO plan_items (ym, category_id, limit_minor, kind, every, weekdays, unit_minor, currency, until) VALUES (?, ?, 18000, 'fixed', 'week', 9, 2000, 'USD', '2099-12-31')", [now, id]);
  await migrate(db);
  expect(await db.get('SELECT every, weekdays, unit_minor, currency, until FROM category_schedules WHERE category_id = ?', [id]))
    .toEqual({ every: 'week', weekdays: 9, unit_minor: 2000, currency: 'USD', until: '2099-12-31' });
});
