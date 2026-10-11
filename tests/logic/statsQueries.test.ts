jest.mock('../../src/shared/navigation/navigation', () => ({ navigateWhenReady: jest.fn() }));

import { getDb } from '../../src/db';
import { createCategory } from '../../src/db/categories';
import { monthStats, periodStats, setPlanAmount } from '../../src/db/plans';
import { queryCounter } from '../../src/db/transaction';
import { addManualTransaction } from '../../src/db/transactions';
import { unplannedMonth } from '../../src/entities/plan/model/unplanned';
import { rangeToUnix } from '../../src/shared/lib/dateRange';
import { loadNorms } from '../../src/stats/norms';
import { freshDb } from '../helpers';

// The stats' query budget: what a screen of stats asks the database, counted on the connection. It was 80 for a day
// and 65 for a month before the norms read the plans and the spending once (db/plans/normsData.ts).

const at = (day: string) => Math.floor(new Date(`${day}T12:00:00`).getTime() / 1000);

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00'), advanceTimers: true });
  await freshDb();
  const db = await getDb();
  for (let d = 1; d <= 15; d++) await db.run("INSERT INTO fx_rates (date, currency, gel_per_unit) VALUES (?, 'USD', 2.7)", [`2026-10-${String(d).padStart(2, '0')}`]);
  const rhythms = ['day', 'week', '2weeks', 'month'] as const;
  for (let i = 0; i < 8; i++) {
    const id = await createCategory(`Категория ${i}`);
    await setPlanAmount('2026-10', id, 50000, 'limit', 'GEL', rhythms[i % 4]);
    for (let d = 1; d <= 15; d += 2) {
      await addManualTransaction({ amount_minor: 1000 + i, category_id: id, occurred_at: at(`2026-10-${String(d).padStart(2, '0')}`), kind: 'purchase', currency: i % 3 ? 'GEL' : 'USD' });
    }
  }
});
afterEach(() => jest.useRealTimers());

/** Queries `load` runs. */
async function count(load: () => Promise<unknown>): Promise<number> {
  const before = queryCounter.count;
  await load();
  return queryCounter.count - before;
}

test('a day of stats against the plan: the norms, the day, the month outside the plan', async () => {
  const range = { from: '2026-10-14', to: '2026-10-14' };
  const { from, to } = rangeToUnix(range);
  const n = await count(async () => {
    const norms = await loadNorms(range, 'GEL');
    await Promise.all([periodStats(from, to, 'GEL', [...norms.byCategory.keys()]), unplannedMonth(norms, 'GEL')]);
  });
  expect(n).toBeLessThanOrEqual(20);
});

test('a month of stats: the month and today\'s norms', async () => {
  const n = await count(async () => {
    await monthStats(2026, 9, 'GEL');
    await loadNorms({ from: '2026-10-15', to: '2026-10-15' }, 'GEL');
  });
  expect(n).toBeLessThanOrEqual(18);
});
