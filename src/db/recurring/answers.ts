// "Это оплата?": an operation of another amount than its category's payment ("Траты категории") — answered or not.
import { getDb } from '../index';
import { makeConverter } from '../fx';
import { dayOfUnix } from './reads';
import { sqlList } from '../sql';
import { EXPENSE_KINDS } from '../spending';

/** Its answer in the category: 1 — the payment, 0 — another spending; null — not answered. */
export async function paymentAnswer(txId: number, categoryId: number): Promise<number | null> {
  const r = await (await getDb()).get<{ a: number }>('SELECT is_payment AS a FROM payment_answers WHERE tx_id = ? AND category_id = ?', [txId, categoryId]);
  return r ? r.a : null;
}

/** Answered (null — the answer taken back: asked again). */
export async function setPaymentAnswer(txId: number, categoryId: number, isPayment: boolean | null): Promise<void> {
  const db = await getDb();
  if (isPayment === null) await db.run('DELETE FROM payment_answers WHERE tx_id = ? AND category_id = ?', [txId, categoryId]);
  else await db.run('INSERT OR REPLACE INTO payment_answers (tx_id, category_id, is_payment) VALUES (?, ?, ?)', [txId, categoryId, isPayment ? 1 : 0]);
}

/** An amount in another currency by its day's rate; null — no rate. */
export async function amountIn(minor: number, from: string, to: string, at: number): Promise<number | null> {
  if (from === to) return minor;
  return (await makeConverter())(minor, from, to, dayOfUnix(at));
}

/** SQL: lari for one unit of `cur` on `day` ('YYYY-MM-DD'): that day's rate, else the latest before, else the first (as makeConverter). */
const rateSql = (cur: string, day: string) => `(CASE WHEN ${cur} = 'GEL' THEN 1.0 ELSE coalesce(
    (SELECT r.gel_per_unit FROM fx_rates r WHERE r.currency = ${cur} AND r.date <= ${day} ORDER BY r.date DESC LIMIT 1),
    (SELECT r.gel_per_unit FROM fx_rates r WHERE r.currency = ${cur} ORDER BY r.date LIMIT 1)) END)`;

/**
 * SQL: does the operation `t` (its `amount` in its category — a split one's part there) wait for "Это оплата?": spending
 * of a category whose spending is its payment ("Траты категории", or a regular payment within the month of its month),
 * not answered, its amount off the payment's (each time's) by more than ±3% (1 ₾ at least) — in another currency, by
 * the rate of its day (no rate — not asked).
 */
export function askingSql(t: string, amount: string): string {
  const day = `strftime('%Y-%m-%d', ${t}.occurred_at, 'unixepoch', 'localtime')`;
  return `(${t}.kind IN (${sqlList(EXPENSE_KINDS)}) AND ${t}.category_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM payment_answers a WHERE a.tx_id = ${t}.id AND a.category_id = ${t}.category_id)
    AND EXISTS (SELECT 1 FROM (
      SELECT s.amount_minor AS target, s.currency AS cur FROM recurring_payments s JOIN categories rc ON rc.id = s.category_id
        WHERE s.category_id = ${t}.category_id AND s.merchant_key IS NULL AND s.deleted_at IS NULL AND rc.recurring = 1 AND rc.by_merchant = 0
      UNION ALL
      SELECT p.unit_minor, p.currency FROM plan_items p
        WHERE p.category_id = ${t}.category_id AND p.kind = 'fixed' AND p.every IS NOT NULL
          AND p.ym = strftime('%Y-%m', ${t}.occurred_at, 'unixepoch', 'localtime')
    ) x WHERE abs(round((${amount}) * ${rateSql(`${t}.currency`, day)} / ${rateSql('x.cur', day)}) - x.target) > max(round(x.target * 0.03), 100)))`;
}
