// The repeating payments and what is known of their merchants: the days they charged, the last operation (what a new
// subscription is made from), the merchants of "Подписки" without one ("Без даты списания"). A category's own payment
// (a regular payment of the plan) isn't matched with operations: its charges are its calendar.
import { getDb } from '../index';
import type { Db } from '../types';
import { Currency } from '../fx';
import { placeholders, sqlList } from '../sql';
import { asCurrency } from '../plans/months';
import { REMEMBERABLE_KINDS } from '../../domain/types';
import { addDays, chargesBetween, nextCharge, Period } from './schedule';
import { periodSql } from './period';

/**
 * A repeating payment: a subscription (a merchant's charge every period, or once, of a category with "Подписки"), or a
 * category's own regular payment ("Регулярный платёж" of the plan, monthly or rarer: its schedule only).
 */
export type RecurringPayment = {
  id: number;
  /** its category (one with "Регулярные платежи") */
  category_id: number | null;
  /** its merchant (a subscription: made from an operation, its charges are the merchant's); null — the category's own
   * regular payment: its charges are its days, nothing is matched */
  merchant_key: string | null;
  name: string;
  /** one charge, in `currency` */
  amount_minor: number;
  currency: Currency;
  /** how often (schedule.ts Period: months > 0, weeks < 0, once 0) */
  period: Period;
  /** a charge's day ('YYYY-MM-DD') the others are counted from; null — "Без даты списания" */
  due: string | null;
  /** the month it was made in: its charges count in plans from it */
  since_ym: string;
  /** "Дата окончания": no charges after it; null — none */
  until: string | null;
};

type Row = Omit<RecurringPayment, 'currency'> & { currency: string };
const COLUMNS = `id, category_id, merchant_key, name, amount_minor, currency, ${periodSql()} AS period, due, since_ym, until`;
const asSub = (r: Row): RecurringPayment => ({ ...r, currency: asCurrency(r.currency) });

/** The day of a moment ('YYYY-MM-DD', local). */
export function dayOfUnix(unix: number): string {
  const d = new Date(unix * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today ('YYYY-MM-DD', local). */
export const todayKey = (now = new Date()) => dayOfUnix(Math.floor(now.getTime() / 1000));

/** The payments not deleted (of `categoryId`, or of every category with the switch on), by name. */
export async function listPayments(db?: Db, categoryId?: number): Promise<RecurringPayment[]> {
  db ??= await getDb();
  return (await db.all<Row>(
    `SELECT ${COLUMNS} FROM recurring_payments WHERE deleted_at IS NULL
      AND category_id IN (SELECT id FROM categories WHERE recurring = 1 AND deleted_at IS NULL ${categoryId === undefined ? '' : 'AND id = ?'})
      ORDER BY name COLLATE NOCASE`, categoryId === undefined ? [] : [categoryId])).map(asSub);
}

/** The category's payments not deleted, its repeating payments on or off. */
export async function paymentsOfCategory(categoryId: number): Promise<RecurringPayment[]> {
  return (await (await getDb()).all<Row>(`SELECT ${COLUMNS} FROM recurring_payments WHERE deleted_at IS NULL AND category_id = ? ORDER BY id`, [categoryId])).map(asSub);
}

export async function getPayment(id: number): Promise<RecurringPayment | null> {
  const r = await (await getDb()).get<Row>(`SELECT ${COLUMNS} FROM recurring_payments WHERE id = ? AND deleted_at IS NULL`, [id]);
  return r ? asSub(r) : null;
}

/**
 * A repeating payment's next charge as its operations have it (its stored day stays as it was set: the charges after it
 * are counted, not written); null — no day, or a one-off one past.
 */
export async function paymentNext(id: number, now = new Date()): Promise<string | null> {
  const sub = await getPayment(id);
  if (!sub?.due) return null;
  return nextCharge(sub.due, sub.period, (await paymentDays([sub]))(sub), todayKey(now), sub.until);
}

/** The merchant's repeating payment (not deleted), or null. */
export async function paymentOfMerchant(merchantKey: string): Promise<RecurringPayment | null> {
  const r = await (await getDb()).get<Row>(`SELECT ${COLUMNS} FROM recurring_payments WHERE merchant_key = ? AND deleted_at IS NULL`, [merchantKey]);
  return r ? asSub(r) : null;
}

/** A subscription's charge: its merchant's purchases and payments (not a transfer) */
const MERCHANT_CHARGE = `kind IN (${sqlList(REMEMBERABLE_KINDS)})`;

/** The days the merchants were charged on (their purchases and payments), each merchant's in order. */
export async function chargeDays(keys: string[], db?: Db): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(keys.map((k) => [k, []]));
  if (!keys.length) return out;
  db ??= await getDb();
  const rows = await db.all<{ k: string; at: number }>(
    `SELECT merchant_key AS k, occurred_at AS at FROM transactions WHERE merchant_key IN (${placeholders(keys.length)}) AND ${MERCHANT_CHARGE}
      ORDER BY occurred_at`, keys);
  for (const r of rows) out.get(r.k)?.push(dayOfUnix(r.at));
  return out;
}

type Whose = Pick<RecurringPayment, 'merchant_key'> & Partial<Pick<RecurringPayment, 'period' | 'due' | 'until'>>;

/**
 * The days each payment was charged on: a subscription — its merchant's charges; the category's own — its days up to
 * yesterday (passed is done: nothing is matched with operations).
 */
export async function paymentDays(payments: Whose[], db?: Db, today = todayKey()): Promise<(p: Whose) => string[]> {
  const byMerchant = await chargeDays([...new Set(payments.flatMap((p) => (p.merchant_key ? [p.merchant_key] : [])))], db);
  return (p) => {
    if (p.merchant_key) return byMerchant.get(p.merchant_key) ?? [];
    if (!p.due || p.period === undefined) return [];
    const end = addDays(today, -1);
    return chargesBetween(p.due, p.period, p.due, p.until && p.until < end ? p.until : end);
  };
}

/** The category's own payment (a regular payment, monthly or rarer), or null. */
export async function categoryPayment(categoryId: number, db?: Db): Promise<RecurringPayment | null> {
  db ??= await getDb();
  const r = await db.get<Row>(
    `SELECT ${COLUMNS} FROM recurring_payments WHERE category_id = ? AND merchant_key IS NULL AND deleted_at IS NULL ORDER BY id LIMIT 1`, [categoryId]);
  return r ? asSub(r) : null;
}

/** Has the category a merchant's charge (a purchase or a payment with a merchant): "Подписки" are offered on its page. */
export async function hasMerchantCharges(categoryId: number): Promise<boolean> {
  return !!(await (await getDb()).get(
    `SELECT 1 FROM transactions WHERE category_id = ? AND merchant_key IS NOT NULL AND ${MERCHANT_CHARGE} LIMIT 1`, [categoryId]));
}

/** A merchant's last charge: its day, amount and currency, and the merchant's name as the SMS spells it. */
export type LastCharge = { merchant_key: string; name: string; day: string; amount_minor: number; currency: Currency };

export async function lastCharge(merchantKey: string): Promise<LastCharge | null> {
  const r = await (await getDb()).get<{ name: string | null; at: number; amount_minor: number; currency: string }>(
    `SELECT raw_merchant AS name, occurred_at AS at, amount_minor, currency FROM transactions
      WHERE merchant_key = ? AND ${MERCHANT_CHARGE} ORDER BY occurred_at DESC LIMIT 1`, [merchantKey]);
  return r ? { merchant_key: merchantKey, name: r.name ?? merchantKey, day: dayOfUnix(r.at), amount_minor: r.amount_minor, currency: asCurrency(r.currency) } : null;
}

/** The merchants charged in "Подписки" (`categoryId`) with no repeating payment: "Без даты списания", the latest first. */
export async function merchantsWithoutPayment(categoryId: number): Promise<LastCharge[]> {
  const rows = await (await getDb()).all<{ k: string; name: string | null; at: number; amount_minor: number; currency: string }>(
    `SELECT t.merchant_key AS k, t.raw_merchant AS name, t.occurred_at AS at, t.amount_minor, t.currency FROM transactions t
      WHERE t.category_id = ? AND t.merchant_key IS NOT NULL AND t.${MERCHANT_CHARGE}
        AND NOT EXISTS (SELECT 1 FROM recurring_payments s WHERE s.merchant_key = t.merchant_key AND s.deleted_at IS NULL)
        AND t.occurred_at = (SELECT max(x.occurred_at) FROM transactions x WHERE x.merchant_key = t.merchant_key AND x.category_id = t.category_id AND x.${MERCHANT_CHARGE})
      GROUP BY t.merchant_key ORDER BY t.occurred_at DESC`, [categoryId]);
  return rows.map((r) => ({ merchant_key: r.k, name: r.name ?? r.k, day: dayOfUnix(r.at), amount_minor: r.amount_minor, currency: asCurrency(r.currency) }));
}

/** An operation's merchant's subscription for its card: the next charge (with a day), this year's charges in its currency. */
export type PaymentCard = { sub: RecurringPayment; next: string | null; year_count: number; year_minor: number; last: { id: number; amount_minor: number; currency: Currency } | null };

export async function paymentCard(merchantKey: string, now = new Date()): Promise<PaymentCard | null> {
  const db = await getDb();
  const sub = await paymentOfMerchant(merchantKey);
  if (!sub) return null;
  const days = (await paymentDays([sub], db))(sub);
  const from = Math.floor(new Date(now.getFullYear(), 0, 1).getTime() / 1000);
  const year = await db.get<{ n: number; sum: number | null }>(
    `SELECT count(*) AS n, sum(CASE WHEN currency = ? THEN amount_minor END) AS sum FROM spend_parts
      WHERE merchant_key = ? AND ${MERCHANT_CHARGE} AND occurred_at >= ?`, [sub.currency, merchantKey, from]);
  const last = await db.get<{ id: number; amount_minor: number; currency: string }>(
    `SELECT id, amount_minor, currency FROM spend_parts WHERE merchant_key = ? AND ${MERCHANT_CHARGE} ORDER BY occurred_at DESC, id DESC LIMIT 1`, [merchantKey]);
  return {
    sub, next: sub.due ? nextCharge(sub.due, sub.period, days, todayKey(now), sub.until) : null,
    year_count: year?.n ?? 0, year_minor: year?.sum ?? 0, last: last ? { ...last, currency: asCurrency(last.currency) } : null,
  };
}
