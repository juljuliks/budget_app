// "Копилки": the queue by date and whether each makes it by its date (db/plans/fundForecast.ts).
import { freshDb } from '../helpers';
import { getDb } from '../../src/db';
import { fundForecasts, fundOrder, monthEnd, refreshFundItems, setFund, setLockedPct, setPlanAmount, setPlanBudget, simulateFunds } from '../../src/db/plans';
import { createCategory } from '../../src/db/categories';

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00'), advanceTimers: true });
  await freshDb();
});
afterEach(() => jest.useRealTimers());

test('the queue: the nearest date first, one date — the smaller sum', () => {
  const f = (id: number, due: string, target: number) => ({ category_id: id, due, target_minor: target });
  expect([f(1, '2027-07-31', 100), f(2, '2027-01-15', 900), f(3, '2027-01-15', 500)].sort(fundOrder).map((x) => x.category_id)).toEqual([3, 2, 1]);
});

test('what is left for a fund: the free part and 🔒 less what the funds with an earlier date took; the pace by its date', () => {
  // 100 free and 50 of 🔒 a month; the first asks 60 a month for 2 months, the second 120 a month for 10
  const rooms = [{ ym: '2026-10', free: 10000, locked: 5000 }];
  const funds = [{ id: 1, target: 12000, dueYm: '2026-11', saved: 0 }, { id: 2, target: 120000, dueYm: '2027-07', saved: 0 }];
  const r = simulateFunds(funds, rooms);
  expect(r.now.get(1)).toEqual({ asked: 6000, fromFree: 6000, fromLocked: 0, free: 10000, locked: 5000 });
  // 40 free + 45 of 🔒 left for it: 85 of 120
  expect(r.now.get(2)).toEqual({ asked: 12000, fromFree: 4000, fromLocked: 5000, free: 4000, locked: 5000 });
  expect(r.atDue.get(1)).toBe(12000);
  // 85 + 85, then 150 a month for 8 months (the first is done): 170 + 1 200
  expect(r.atDue.get(2)).toBe(17000 + 8 * 15000 > 120000 ? 120000 : 17000 + 8 * 15000);
});

test('moved on: the month it has its sum in, going on after its date', () => {
  const rooms = [{ ym: '2026-10', free: 5000, locked: 0 }];
  const funds = [{ id: 1, target: 60000, dueYm: '2027-03', saved: 0 }];
  // 50 a month: 6 months to 300, 12 to 600 — September 2027
  expect(simulateFunds(funds, rooms).atDue.get(1)).toBe(30000);
  expect(simulateFunds(funds, rooms, 1).reached).toBe('2027-09');
  expect(monthEnd('2027-09')).toBe('2027-09-30');
  expect(monthEnd('2028-02')).toBe('2028-02-29');
});

test('fundForecasts: ok, late with the date to move to, "full" when nothing is left; the plan fits the nearest first', async () => {
  const food = await createCategory('Еда', '🍎');
  await setLockedPct(10, '2026-10');
  // 1 000: 🔒 100, food 750 — 150 free
  await setPlanBudget('2026-10', 100000, 'GEL', 0, true);
  await setPlanAmount('2026-10', food, 75000, 'limit');
  const trip = await createCategory('Отпуск', '🏖');
  const laptop = await createCategory('Ноутбук', '💻');
  const car = await createCategory('Страховка', '🚗');
  // made first, but its date is the farthest
  await setFund('2026-10', laptop, { target_minor: 300000, currency: 'GEL', due: '2027-12-31', start_minor: 0 });
  await setFund('2026-10', car, { target_minor: 20000, currency: 'GEL', due: '2026-11-30', start_minor: 0 });
  await setFund('2026-10', trip, { target_minor: 120000, currency: 'GEL', due: '2027-07-31', start_minor: 0 });
  const db = await getDb();
  // the plan: the insurance first (100), the trip 120 (50 free, 70 of 🔒), the laptop what is left — 30 of 🔒
  expect(await db.all("SELECT category_id AS id, limit_minor AS v, taken_minor AS t FROM plan_items WHERE ym = '2026-10' AND kind = 'fund' ORDER BY limit_minor DESC"))
    .toEqual([{ id: trip, v: 12000, t: 7000 }, { id: car, v: 10000, t: 0 }, { id: laptop, v: 3000, t: 3000 }]);
  let f = await fundForecasts('2026-10');
  expect(f.get(car)).toMatchObject({ status: 'ok', asked: 10000, fromFree: 10000, fromLocked: 0, free: 15000, locked: 10000 });
  expect(f.get(trip)).toMatchObject({ status: 'ok', asked: 12000, fromFree: 5000, fromLocked: 7000, free: 5000, locked: 10000 });
  // 3 000 by December 2027 (15 months): 200 asked, 30 left for it
  const laptopNow = f.get(laptop)!;
  expect(laptopNow).toMatchObject({ status: 'late', asked: 20000, fromFree: 0, fromLocked: 3000, free: 0, locked: 3000 });
  expect(laptopNow.forecast).toBeLessThan(300000);
  expect(laptopNow.moveTo! > '2027-12-31').toBe(true);
  expect(laptopNow.moveTo).toMatch(/^\d{4}-\d\d-(28|29|30|31)$/);

  // food 800: 200 a month for the funds — the insurance 100, the trip 100 of 120, the laptop nothing this month: «бюджет расписан»
  await db.run("UPDATE plan_items SET limit_minor = 80000 WHERE ym = '2026-10' AND category_id = ?", [food]);
  await refreshFundItems('2026-10', '2026-10');
  f = await fundForecasts('2026-10');
  // the trip makes it still: from December the insurance is done
  expect(f.get(trip)).toMatchObject({ status: 'ok', fromFree: 0, fromLocked: 10000 });
  expect(f.get(laptop)).toMatchObject({ status: 'full', free: 0, locked: 0 });
});

test('the notice: once when a fund stops making it, again only after it made it in between', async () => {
  const { newlyLate, fundLateNotice } = require('../../src/notifications/fundLate');
  const food = await createCategory('Еда', '🍎');
  await setPlanBudget('2026-10', 100000, 'GEL', 0, true);
  await setPlanAmount('2026-10', food, 90000, 'limit');
  const laptop = await createCategory('Ноутбук', '💻');
  // 3 000 by December 2027: 200 a month, 100 is free
  await setFund('2026-10', laptop, { target_minor: 300000, currency: 'GEL', due: '2027-12-31', start_minor: 0 });
  const first: Map<number, unknown> = await newlyLate();
  expect([...first.keys()]).toEqual([laptop]);
  expect((await newlyLate()).size).toBe(0);
  const text = (x: { title: string; body: string }) => JSON.parse(JSON.stringify(x).replace(/[  ]/g, ' '));
  expect(text(fundLateNotice('💻 Ноутбук', first.get(laptop), false))).toEqual({
    title: '💻 Ноутбук не успевает к 31 декабря 2027', body: 'Копилке остаётся 100 ₾ в месяц из 200 ₾ — сдвиньте дату или сумму' });
  expect(fundLateNotice('💻 Ноутбук', first.get(laptop), true).body).toBe('Бюджет расписан: сдвиньте дату или сумму копилки');
  // made it (a later date), then not again: said again
  await setFund('2026-10', laptop, { target_minor: 300000, currency: 'GEL', due: '2029-12-31', start_minor: 0 });
  expect((await newlyLate()).size).toBe(0);
  await setFund('2026-10', laptop, { target_minor: 300000, currency: 'GEL', due: '2027-12-31', start_minor: 0 });
  expect([...(await newlyLate()).keys()]).toEqual([laptop]);
});
