// What counts as spending: the rows, each one's contribution (refunds and deposits subtracted), converted.
import { getDb } from '../index';
import { Converter, Currency, dateKey, ensureRates, makeConverter } from '../fx';
import { filterCondition, TxFilter } from '../transactions';
import { BUDGET_CURRENCY } from './months';

/**
 * Kinds that count as spending. A deposit in "Пополнение счёта" (where every one goes by default) is income, not
 * spending; one put in another category (sent 82 for a manicure, 82 came back) is subtracted from it like a refund. A refund is subtracted: from its category (its
 * merchant's, see refundCategory), or, without one, as "Возвраты без категории" (REFUND_KEY) apart from the
 * uncategorized spending. A refund settled on its purchase (reduced or deleted, see refunds.ts) no longer counts:
 * the purchase already shows it.
 */
const EXPENSE_KINDS = ['purchase', 'payment', 'withdrawal', 'transfer'];

export type SpendRow = { id: number; category_id: number | null; kind: string; amount_minor: number; currency: string; occurred_at: number; refund_settled_at: number | null };

/** The key refunds without a category are summed under (instead of null, "Без категории"). */
export const REFUND_KEY = 'refund' as const;

/** The category key a row is summed under. */
export const categoryKey = (r: SpendRow): number | null | typeof REFUND_KEY => (r.kind === 'refund' && r.category_id === null ? REFUND_KEY : r.category_id);

/** A transaction's contribution to spending (see EXPENSE_KINDS), in its own currency. */
function spendOf(r: SpendRow): number {
  if (r.kind === 'refund') return r.refund_settled_at !== null ? 0 : -r.amount_minor;
  // in a category other than "Пополнение счёта" (see spendRows): money back, subtracted from it
  if (r.kind === 'deposit') return -r.amount_minor;
  return EXPENSE_KINDS.includes(r.kind) ? r.amount_minor : 0;
}

export async function spendRows(from: number, to: number, only?: TxFilter): Promise<SpendRow[]> {
  const db = await getDb();
  const f = only ? filterCondition(only) : { sql: '1', params: [] };
  return db.all<SpendRow>(
    `SELECT id, category_id, kind, amount_minor, currency, occurred_at, refund_settled_at FROM transactions t
      WHERE occurred_at >= ? AND occurred_at < ? AND ${f.sql}
        AND (kind IN (${[...EXPENSE_KINDS, 'refund'].map((k) => `'${k}'`).join(',')})
          OR (kind = 'deposit' AND category_id IS NOT NULL))
        AND category_id IS NOT (SELECT id FROM categories WHERE system = 'savings')
        AND category_id IS NOT (SELECT id FROM categories WHERE system = 'topup')`,
    [from, to, ...f.params]);
}

type Converted = {
  items: Array<{ row: SpendRow; value: number }>;
  /** spending that couldn't be converted (no rate known yet, offline), per currency */
  missing: Array<{ currency: string; spent_minor: number }>;
  conv: Converter;
};

/** Converts each row's spending on its day's rate (fetching rates not cached yet); `extraDates` are fetched too. */
export async function convertSpending(rows: SpendRow[], to: Currency, extraDates: string[] = []): Promise<Converted> {
  await ensureRates([...rows.filter((r) => r.currency !== to).map((r) => dateKey(r.occurred_at)), ...extraDates]);
  const conv = await makeConverter();
  const items: Converted['items'] = [];
  const missing = new Map<string, number>();
  for (const r of rows) {
    const v = spendOf(r);
    if (v === 0) continue;
    const c = conv(v, r.currency, to, dateKey(r.occurred_at));
    if (c === null) missing.set(r.currency, (missing.get(r.currency) ?? 0) + v);
    else items.push({ row: r, value: c });
  }
  return { items, missing: [...missing].map(([currency, spent_minor]) => ({ currency, spent_minor })), conv };
}

export function sumBy<K>(items: Converted['items'], key: (r: SpendRow) => K): Map<K, number> {
  const m = new Map<K, number>();
  for (const { row, value } of items) m.set(key(row), (m.get(key(row)) ?? 0) + value);
  return m;
}

/**
 * Each transaction's contribution to spending in [from, to), converted to `currency`, for per-day totals; `only` the
 * operations these filters show (the operations list's: a day's total is then what its section shows).
 */
export async function spendingEntries(from: number, to: number, currency: Currency = BUDGET_CURRENCY, only?: TxFilter):
  Promise<Array<{ occurred_at: number; spent_minor: number }>> {
  const { items } = await convertSpending(await spendRows(from, to, only), currency);
  return items.map(({ row, value }) => ({ occurred_at: row.occurred_at, spent_minor: value }));
}
