import { groupTransactions } from '../src/ui/transactionGroups';
import type { TransactionRow } from '../src/db/transactions';

let id = 0;
const row = (merchant: string | null, amount: number, more: Partial<TransactionRow> = {}): TransactionRow => ({
  id: ++id, bank: 'TBC', kind: 'purchase', amount_minor: amount, currency: 'GEL', raw_merchant: merchant,
  merchant_key: merchant?.toUpperCase() ?? null, category_id: null, category_source: null, occurred_at: 2_000_000_000 - id * 86400 * 10,
  seen_at: 1, refund_settled_at: null, category_name: null, category_emoji: null, category_type_name: null, ...more,
});

describe('groupTransactions', () => {
  it('by merchant: the busiest first, the newest on a tie, without a merchant last', () => {
    const groups = groupTransactions([row(null, 100), row('Bolt', 10), row('Spar', 20), row('Spar', 30), row('Zara', 40)], 'merchant');
    expect(groups.map((g) => g.title)).toEqual(['Spar', 'Bolt', 'Zara', 'Без мерчанта']);
    expect(groups[0].rows.map((r) => r.amount_minor)).toEqual([20, 30]);
  });

  it('sums spent minus received per currency', () => {
    const groups = groupTransactions([row('Zara', 5000), row('Zara', 1000, { kind: 'refund' }), row('Zara', 700, { currency: 'USD' })], 'merchant');
    expect(groups[0].totals).toEqual(new Map([['GEL', -4000], ['USD', -700]]));
  });

  it('by category: "Без категории" first, then by count', () => {
    const cafe = { category_id: 1, category_name: 'Кафе', category_emoji: '☕️' };
    const taxi = { category_id: 2, category_name: 'Такси', category_emoji: '🚕', category_type_name: 'Транспорт' };
    const groups = groupTransactions([row('a', 1, taxi), row('b', 1, cafe), row('c', 1, cafe), row('d', 1)], 'category');
    expect(groups.map((g) => g.title)).toEqual(['⚪️ Без категории', '☕️ Кафе', '🚕 Транспорт: Такси']);
  });

  it('by month: newest first', () => {
    const at = (y: number, m: number) => Math.floor(new Date(y, m - 1, 15).getTime() / 1000);
    const groups = groupTransactions([row('a', 1, { occurred_at: at(2026, 10) }), row('b', 1, { occurred_at: at(2026, 9) }), row('c', 1, { occurred_at: at(2026, 9) })], 'month');
    expect(groups.map((g) => [g.title, g.rows.length])).toEqual([['Октябрь 2026', 1], ['Сентябрь 2026', 2]]);
  });

  it('by amount: the biggest band first, the biggest first inside', () => {
    const groups = groupTransactions([row('a', 500), row('b', 120000), row('c', 1500), row('d', 60000), row('e', 3000)], 'amount');
    expect(groups.map((g) => g.title)).toEqual(['500 и больше', '20–100', 'До 20']);
    expect(groups[0].rows.map((r) => r.amount_minor)).toEqual([120000, 60000]);
    expect(groups[2].rows.map((r) => r.amount_minor)).toEqual([1500, 500]);
  });

  it('by kind: the most frequent first', () => {
    const groups = groupTransactions([row('a', 1, { kind: 'refund' }), row('b', 1), row('c', 1)], 'kind');
    expect(groups.map((g) => g.rows.length)).toEqual([2, 1]);
  });
});
