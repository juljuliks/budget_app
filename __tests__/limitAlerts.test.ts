import { currentYm, setPlanAmount } from '../src/db/plans';
import { daysInMonth } from '../src/ui/dateRange';
import { addManualTransaction } from '../src/db/transactions';
import { limitAlertFor, setLimitAlertsEnabled } from '../src/limitAlerts';
import { freshDb } from './helpers';

// loadNorms reads the current month from the clock: the operations are today
const now = new Date();
const ym = currentYm(now);
const spend = (minor: number, categoryId = 1) =>
  addManualTransaction({ amount_minor: minor, currency: 'GEL', category_id: categoryId, occurred_at: Math.floor(Date.now() / 1000) - 5 });

beforeEach(async () => {
  await freshDb();
});

test('month plan: 80% once, then over the plan once', async () => {
  await setPlanAmount(ym, 1, 100000, 'limit', 'GEL', 'month');
  await spend(79000);
  expect(await limitAlertFor(1, now)).toBeNull();
  await spend(1000);
  expect(await limitAlertFor(1, now)).toEqual(expect.objectContaining({ title: expect.stringMatching(/— 80% плана на /) }));
  // nothing new
  await spend(1000);
  expect(await limitAlertFor(1, now)).toBeNull();
  await spend(19000);
  const over = await limitAlertFor(1, now);
  expect(over?.title).toMatch(/план на .+ превышен$/);
  expect(over?.body).toMatch(/перерасход/);
  await spend(5000);
  expect(await limitAlertFor(1, now)).toBeNull();
});

test('a day limit: 80% and over, while the month is far from its plan', async () => {
  // today's limit = the month's plan / the days left (nothing spent before today): 1000 ₾ a day
  const daysLeft = daysInMonth(ym) - now.getDate() + 1;
  await setPlanAmount(ym, 1, 100000 * daysLeft, 'limit', 'GEL', 'day');
  await spend(80000);
  const near = await limitAlertFor(1, now);
  expect(near?.title).toMatch(/— 80% лимита на день$/);
  expect(near?.body).toMatch(/^Сегодня потрачено .+, осталось /);
  await spend(20000);
  expect((await limitAlertFor(1, now))?.title).toMatch(/— лимит на день превышен$/);
  expect(await limitAlertFor(1, now)).toBeNull();
});

test('reaching 100% at once: one notification, the lower threshold doesn\'t follow', async () => {
  await setPlanAmount(ym, 1, 100000, 'limit', 'GEL', 'month');
  await spend(120000);
  expect((await limitAlertFor(1, now))?.title).toMatch(/превышен$/);
  expect(await limitAlertFor(1, now)).toBeNull();
});

test('fixed payments, categories without a plan and the setting off: no notification', async () => {
  await setPlanAmount(ym, 1, 100000, 'fixed', 'GEL');
  await spend(100000);
  expect(await limitAlertFor(1, now)).toBeNull();
  await spend(100000, 2);
  expect(await limitAlertFor(2, now)).toBeNull();

  await setPlanAmount(ym, 2, 100000, 'limit', 'GEL', 'month');
  await setLimitAlertsEnabled(false);
  expect(await limitAlertFor(2, now)).toBeNull();
  await setLimitAlertsEnabled(true);
  expect((await limitAlertFor(2, now))?.title).toMatch(/превышен$/);
});
