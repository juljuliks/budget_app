import { groupByMerchant } from '../src/ui/merchantGroups';
import type { TransactionRow } from '../src/db/transactions';

let id = 0;
const row = (merchant: string | null, amount: number, kind = 'purchase', currency = 'GEL'): TransactionRow => ({
  id: ++id, bank: 'TBC', kind, amount_minor: amount, currency, raw_merchant: merchant, merchant_key: merchant?.toUpperCase() ?? null,
  category_id: null, category_source: null, occurred_at: 1000 - id, seen_at: 1, refund_settled_at: null,
  category_name: null, category_emoji: null, category_type_name: null,
});

describe('groupByMerchant', () => {
  it('puts the busiest merchants first, the newest on a tie, without a merchant last', () => {
    const rows = [row(null, 100), row('Bolt', 10), row('Spar', 20), row('Spar', 30), row('Zara', 40)];
    const groups = groupByMerchant(rows);
    expect(groups.map((g) => g.name)).toEqual(['Spar', 'Bolt', 'Zara', null]);
    expect(groups[0].rows.map((r) => r.amount_minor)).toEqual([20, 30]);
  });

  it('sums spent minus received per currency', () => {
    const groups = groupByMerchant([row('Zara', 5000), row('Zara', 1000, 'refund'), row('Zara', 700, 'purchase', 'USD')]);
    expect(groups[0].totals).toEqual(new Map([['GEL', -4000], ['USD', -700]]));
  });
});
