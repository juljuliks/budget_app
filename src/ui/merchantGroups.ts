import type { TransactionRow } from '../db/transactions';
import { isIncome } from './format';

/** The operations of one merchant (or of none: manual ones, transfers without a name), for the list grouped by merchant. */
export type MerchantGroup = {
  key: string;
  /** the merchant as its newest operation names it; null = without a merchant */
  name: string | null;
  rows: TransactionRow[];
  /** spent minus received, per currency (negative = spent) */
  totals: Map<string, number>;
};

/**
 * `rows` (newest first) by merchant: the merchants with the most operations first (then the latest), "без мерчанта"
 * last; inside a group, newest first.
 */
export function groupByMerchant(rows: TransactionRow[]): MerchantGroup[] {
  const groups = new Map<string, MerchantGroup>();
  for (const r of rows) {
    const key = r.merchant_key ?? r.raw_merchant?.trim().toLowerCase() ?? '';
    let g = groups.get(key);
    if (!g) groups.set(key, g = { key, name: key ? r.raw_merchant : null, rows: [], totals: new Map() });
    g.rows.push(r);
    g.totals.set(r.currency, (g.totals.get(r.currency) ?? 0) + (isIncome(r.kind) ? r.amount_minor : -r.amount_minor));
  }
  // Map keeps the first-seen order, which is the newest operation's: the tie-break
  return [...groups.values()].sort((a, b) => (a.name === null ? 1 : 0) - (b.name === null ? 1 : 0) || b.rows.length - a.rows.length);
}
