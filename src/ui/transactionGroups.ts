import { txCategoryLabel } from '../db/categories';
import type { TransactionRow } from '../db/transactions';
import { isIncome, KIND_LABELS } from './format';
import { MONTHS } from './stats/months';
import { NO_CATEGORY } from './strings';

/** How the operations list is split into sections besides by day: each needs every matching operation at once. */
export type GroupKind = 'merchant' | 'category' | 'month' | 'kind' | 'amount';

export type TransactionGroup = {
  key: string;
  title: string;
  rows: TransactionRow[];
  /** spent minus received, per currency (negative = spent) */
  totals: Map<string, number>;
};

// "По сумме": the bands, biggest first; an amount in its own currency
const AMOUNT_BANDS: Array<{ from: number; title: string }> = [
  { from: 50000, title: '500 и больше' },
  { from: 10000, title: '100–500' },
  { from: 2000, title: '20–100' },
  { from: 0, title: 'До 20' },
];

type Key = { key: string; title: string };
const keyOf: Record<GroupKind, (r: TransactionRow) => Key> = {
  merchant: (r) => {
    const key = r.merchant_key ?? r.raw_merchant?.trim().toLowerCase() ?? '';
    return { key, title: key ? r.raw_merchant ?? key : 'Без мерчанта' };
  },
  category: (r) => ({ key: String(r.category_id ?? 'none'), title: txCategoryLabel(r) ?? NO_CATEGORY }),
  month: (r) => {
    const d = new Date(r.occurred_at * 1000);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, title: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
  },
  kind: (r) => ({ key: r.kind, title: KIND_LABELS[r.kind] ?? r.kind }),
  amount: (r) => {
    const i = AMOUNT_BANDS.findIndex((b) => Math.abs(r.amount_minor) >= b.from);
    return { key: String(i), title: AMOUNT_BANDS[i].title };
  },
};

/**
 * `rows` (newest first) in groups, each newest first inside, except by amount (biggest first). The order of the
 * groups: months newest first, amounts biggest first; merchants, categories and kinds by how many operations they
 * have (the newest on a tie), "без мерчанта" last and "без категории" first (what needs a category).
 */
export function groupTransactions(rows: TransactionRow[], by: GroupKind): TransactionGroup[] {
  const groups = new Map<string, TransactionGroup>();
  for (const r of rows) {
    const { key, title } = keyOf[by](r);
    let g = groups.get(key);
    if (!g) groups.set(key, g = { key, title, rows: [], totals: new Map() });
    g.rows.push(r);
    g.totals.set(r.currency, (g.totals.get(r.currency) ?? 0) + (isIncome(r.kind) ? r.amount_minor : -r.amount_minor));
  }
  // a Map keeps the first-seen order, which is the newest operation's: months come newest first, and it's the tie-break
  const out = [...groups.values()];
  if (by === 'amount') {
    out.sort((a, b) => Number(a.key) - Number(b.key));
    for (const g of out) g.rows.sort((a, b) => Math.abs(b.amount_minor) - Math.abs(a.amount_minor));
  } else if (by !== 'month') {
    const last = (g: TransactionGroup) => (by === 'merchant' && g.key === '' ? 1 : by === 'category' && g.key === 'none' ? -1 : 0);
    out.sort((a, b) => last(a) - last(b) || b.rows.length - a.rows.length);
  }
  return out;
}
