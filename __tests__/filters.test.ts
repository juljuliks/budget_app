import { createCategory } from '../src/db/categories';
import { addManualTransaction, listTransactionsFiltered, searchTransactions } from '../src/db/transactions';
import { freshDb } from './helpers';

const at = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

beforeEach(() => freshDb());

test('text, category and dates combine: all must match', async () => {
  const bars = await createCategory('Бары');
  const food = await createCategory('Еда');
  await addManualTransaction({ amount_minor: 100, category_id: bars, description: 'Patara Bari', occurred_at: at('2026-10-03T20:00:00') });
  await addManualTransaction({ amount_minor: 200, category_id: bars, description: 'Patara Bari', occurred_at: at('2026-09-20T20:00:00') });
  await addManualTransaction({ amount_minor: 300, category_id: food, description: 'Spar', occurred_at: at('2026-10-02T12:00:00') });
  await addManualTransaction({ amount_minor: 400, category_id: bars, description: 'Dive bar', occurred_at: at('2026-10-05T22:00:00') });
  const october = { from: at('2026-10-01T00:00:00'), to: at('2026-11-01T00:00:00') };

  const amounts = (rows: Array<{ amount_minor: number }>) => rows.map((r) => r.amount_minor).sort((a, b) => a - b);
  expect(amounts(await listTransactionsFiltered({ category: bars, ...october }))).toEqual([100, 400]);
  expect(amounts(await searchTransactions('patara', { category: bars, ...october }))).toEqual([100]);
  expect(amounts(await searchTransactions('patara'))).toEqual([100, 200]);
  expect(amounts(await searchTransactions('spar', { category: bars }))).toEqual([]);
});
