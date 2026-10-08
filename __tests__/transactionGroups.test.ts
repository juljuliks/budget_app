import { addManualTransaction } from '../src/db/transactions';
import { createCategory } from '../src/db/categories';
import { createCategoryType } from '../src/db/categoryTypes';
import { listGroupedPage, listTransactionGroups, transactionGroupIds } from '../src/db/transactions';
import { groupTitle, groupTotal } from '../src/ui/transactionGroups';
import { freshDb } from './helpers';

const at = (y: number, m: number, d = 15) => Math.floor(new Date(y, m - 1, d, 12).getTime() / 1000);
let day = 0;
const add = (description: string | null, amount: number, more: { kind?: 'purchase' | 'refund'; category_id?: number | null; currency?: string; occurred_at?: number } = {}) =>
  addManualTransaction({ amount_minor: amount, currency: more.currency ?? 'GEL', category_id: more.category_id ?? null, occurred_at: more.occurred_at ?? at(2026, 9, 1) + ++day * 3600, description: description ?? undefined, kind: more.kind });

beforeEach(async () => { await freshDb(); day = 0; });

describe('grouped operations', () => {
  it('by merchant: the busiest first, the newest on a tie, without a merchant last; pages run across groups', async () => {
    await add(null, 100); await add('Bolt', 10); await add('Spar', 20); await add('Spar', 30); await add('Zara', 40);
    const groups = await listTransactionGroups({}, 'merchant');
    expect(groups.map((g) => [groupTitle(g, 'merchant'), g.count])).toEqual([['Spar', 2], ['Zara', 1], ['Bolt', 1], ['Без мерчанта', 1]]);
    const first = await listGroupedPage({}, 'merchant', 0, 3);
    const second = await listGroupedPage({}, 'merchant', 3, 3);
    expect([...first, ...second].map((r) => r.amount_minor)).toEqual([30, 20, 40, 10, 100]);
    expect(first.map((r) => r.group_key)).toEqual([groups[0].key, groups[0].key, groups[1].key]);
  });

  it('sums spent minus received per currency', async () => {
    await add('Zara', 5000); await add('Zara', 1000, { kind: 'refund' }); await add('Zara', 700, { currency: 'USD' });
    const [g] = await listTransactionGroups({}, 'merchant');
    expect(g.totals).toEqual([{ currency: 'GEL', total: -4000 }, { currency: 'USD', total: -700 }]);
    expect(groupTotal(g)).toMatch(/^−40.*·.*−7/);
  });

  it('by category: "Без категории" first, then by count, labelled like everywhere', async () => {
    const cafe = await createCategory('Кафе', '☕️', null);
    const taxi = await createCategory('Такси', '🚕', await createCategoryType('Транспорт'));
    await add('a', 1, { category_id: taxi }); await add('b', 1, { category_id: cafe }); await add('c', 1, { category_id: cafe }); await add('d', 1);
    const groups = await listTransactionGroups({}, 'category');
    expect(groups.map((g) => groupTitle(g, 'category'))).toEqual(['⚪️ Без категории', '☕️ Кафе', '🚕 Транспорт: Такси']);
  });

  it('by month: newest first', async () => {
    await add('a', 1, { occurred_at: at(2026, 9) }); await add('b', 1, { occurred_at: at(2026, 10) }); await add('c', 1, { occurred_at: at(2026, 9, 20) });
    const groups = await listTransactionGroups({}, 'month');
    expect(groups.map((g) => [groupTitle(g, 'month'), g.count])).toEqual([['Октябрь 2026', 1], ['Сентябрь 2026', 2]]);
  });

  it('by amount: 1000+, 500+, 100–500, 20–100, до 20; the biggest first inside', async () => {
    for (const a of [500, 120000, 60000, 1500, 15000, 3000, 250000]) await add('x', a);
    const groups = await listTransactionGroups({}, 'amount');
    expect(groups.map((g) => [groupTitle(g, 'amount'), g.count])).toEqual([['1000+', 2], ['500+', 1], ['100–500', 1], ['20–100', 1], ['До 20', 2]]);
    expect((await listGroupedPage({}, 'amount', 0, 3)).map((r) => r.amount_minor)).toEqual([250000, 120000, 60000]);
  });

  it('applies the filter, and gives every id of a group', async () => {
    await add('Spar', 1); await add('Spar', 2); const z = await add('Zara', 3);
    const groups = await listTransactionGroups({ ids: [z] }, 'merchant');
    expect(groups.map((g) => g.count)).toEqual([1]);
    const spar = (await listTransactionGroups({}, 'merchant'))[0];
    expect(await transactionGroupIds({}, 'merchant', spar.key)).toHaveLength(2);
  });
});
