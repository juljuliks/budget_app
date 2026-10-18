// What counts as spending: the rows, each one's contribution (refunds and deposits subtracted), converted.
import { getDb } from '../index';
import { Converter, Currency, dateKey, ensureRatesLater, makeConverter } from '../fx';
import { filterCondition, TxFilter } from '../transactions';
import { BUDGET_CURRENCY, monthRange, parseYm } from './months';
import { EXPENSE_KINDS, signedSpendSql } from '../spending';
import { sqlList } from '../sql';

/**
 * The stats' view of spending (src/db/spending.ts has the rule): a deposit in "Пополнение счёта" (where every one goes by
 * default) is income, not spending; one put in another category (sent 82 for a manicure, 82 came back) is subtracted
 * from it like a refund. A refund is subtracted: from its category (its merchant's, see refundCategory), or, without
 * one, as "Возвраты без категории" (REFUND_KEY) apart from the uncategorized spending.
 */
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
  return (EXPENSE_KINDS as ReadonlyArray<string>).includes(r.kind) ? r.amount_minor : 0;
}

/** The rows spending is made of in [from, to): the conditions of spendRows / spendByDay, on spend_parts (a split operation's parts). */
const spendWhere = (only?: TxFilter) => {
  const f = only ? filterCondition(only, true) : { sql: '1', params: [] };
  return {
    sql: `occurred_at >= ? AND occurred_at < ? AND ${f.sql}
        AND (kind IN (${sqlList([...EXPENSE_KINDS, 'refund'])})
          OR (kind = 'deposit' AND category_id IS NOT NULL))
        AND category_id IS NOT (SELECT id FROM categories WHERE system = 'topup')
        AND category_id IS NOT (SELECT id FROM categories WHERE system = 'own')`,
    params: f.params,
  };
};

export async function spendRows(from: number, to: number, only?: TxFilter): Promise<SpendRow[]> {
  const db = await getDb();
  const w = spendWhere(only);
  return db.all<SpendRow>(
    `SELECT id, category_id, kind, amount_minor, currency, occurred_at, refund_settled_at FROM spend_parts t WHERE ${w.sql}`,
    [from, to, ...w.params]);
}

/**
 * The spending of [from, to) by day, converted to `currency` (summed in SQL by day and currency, each sum on its day's
 * rate): the totals over many months (history, averages) without reading every row.
 */
export async function spendByDay(from: number, to: number, currency: Currency, extraDates: string[] = []):
  Promise<{ days: Array<{ day: string; value: number }>; conv: Converter }> {
  const db = await getDb();
  const w = spendWhere();
  const sums = await db.all<{ day: string; currency: string; amount: number }>(
    `SELECT strftime('%Y-%m-%d', occurred_at, 'unixepoch', 'localtime') AS day, currency, sum(${signedSpendSql()}) AS amount
      FROM spend_parts t WHERE ${w.sql} AND NOT (kind = 'refund' AND refund_settled_at IS NOT NULL)
      GROUP BY day, currency`, [from, to, ...w.params]);
  await ensureRatesLater([...sums.filter((r) => r.currency !== currency).map((r) => r.day), ...extraDates]);
  const conv = await makeConverter();
  const days: Array<{ day: string; value: number }> = [];
  for (const r of sums) {
    const v = r.amount === 0 ? null : conv(r.amount, r.currency, currency, r.day);
    if (v !== null) days.push({ day: r.day, value: v });
  }
  return { days, conv };
}

type Converted = {
  items: Array<{ row: SpendRow; value: number }>;
  /** spending that couldn't be converted (no rate known yet, offline), per currency */
  missing: Array<{ currency: string; spent_minor: number }>;
  conv: Converter;
};

/** Converts each row's spending on its day's rate (cached ones; the missing are fetched in the background, see ensureRatesLater); `extraDates` too. */
export async function convertSpending(rows: SpendRow[], to: Currency, extraDates: string[] = []): Promise<Converted> {
  await ensureRatesLater([...rows.filter((r) => r.currency !== to).map((r) => dateKey(r.occurred_at)), ...extraDates]);
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
