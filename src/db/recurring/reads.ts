// The repeating payments and what is known of their merchants: the days they charged, the last operation (what a new
// repeating payment is made from), the merchants of "Подписки" without one ("Без даты списания").
import { getDb } from '../index';
import type { Db } from '../types';
import { Currency } from '../fx';
import { placeholders, sqlList } from '../sql';
import { asCurrency } from '../plans/months';
import { makeConverter } from '../fx';
import { EXPENSE_KINDS } from '../spending';
import { REMEMBERABLE_KINDS } from '../../domain/types';
import { nextCharge, paidDays, Period, windowOf } from './schedule';
import { periodSql } from './period';

/** A repeating payment ("подписка" in "Подписки"): a merchant's charge every period (or once), of a category with "Регулярные платежи". */
export type RecurringPayment = {
  id: number;
  /** its category (one with "Регулярные платежи") */
  category_id: number | null;
  /** its merchant ("Разные мерчанты": made from an operation, its charges are the merchant's); null — the category's
   * own payment: its charges are any spending of the category */
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

/** A category's spending ("Траты категории"): a purchase, a payment, a transfer (rent is often one), cash */
const CHARGE = `kind IN (${sqlList(EXPENSE_KINDS)})`;
/** A merchant's charge ("По мерчантам"): its purchases and payments — a transfer is a category's ("Траты категории") */
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

type Whose = Pick<RecurringPayment, 'merchant_key' | 'category_id'> & Partial<Pick<RecurringPayment, 'amount_minor' | 'currency' | 'period'>>;

/**
 * The days each payment was charged on: its merchant's charges; the category's own (no merchant, "Траты категории") —
 * the days its spending added up to the payment's amount (two transfers together; a small purchase isn't it).
 */
export async function paymentDays(payments: Whose[], db?: Db): Promise<(p: Whose) => string[]> {
  db ??= await getDb();
  const byMerchant = await chargeDays([...new Set(payments.flatMap((p) => (p.merchant_key ? [p.merchant_key] : [])))], db);
  const byCategory = await categorySpends([...new Set(payments.flatMap((p) => (!p.merchant_key && p.category_id !== null ? [p.category_id] : [])))], db);
  const conv = byCategory.size ? await makeConverter() : null;
  return (p) => {
    if (p.merchant_key) return byMerchant.get(p.merchant_key) ?? [];
    const spends = p.category_id === null ? [] : byCategory.get(p.category_id) ?? [];
    if (!p.amount_minor || !p.currency || !conv) return spends.map((s) => s.day);
    const cur = p.currency;
    return paidDays(spends.map((s) => ({ ...s, minor: s.currency === cur ? s.minor : conv(s.minor, s.currency, cur, s.day) ?? 0 })), p.amount_minor, windowOf(p.period ?? 1));
  };
}

/** A category's spending: each one's day, amount and currency, in order; "Это оплата?" answered (1 / 0) or not (null). */
export type Spend = { day: string; minor: number; currency: string; answer: number | null };

export async function categorySpends(ids: number[], db?: Db): Promise<Map<number, Spend[]>> {
  const out = new Map<number, Spend[]>(ids.map((c) => [c, []]));
  if (!ids.length) return out;
  db ??= await getDb();
  const rows = await db.all<{ c: number; at: number; minor: number; currency: string; answer: number | null }>(
    `SELECT s.category_id AS c, s.occurred_at AS at, s.amount_minor AS minor, s.currency, a.is_payment AS answer FROM spend_parts s
      LEFT JOIN payment_answers a ON a.tx_id = s.id AND a.category_id = s.category_id
      WHERE s.category_id IN (${placeholders(ids.length)}) AND s.${CHARGE} ORDER BY s.occurred_at`, ids);
  for (const r of rows) out.get(r.c)?.push({ day: dayOfUnix(r.at), minor: r.minor, currency: r.currency, answer: r.answer });
  return out;
}

/** The category's own payment (no merchant: "Разные мерчанты" off), or null. */
export async function categoryPayment(categoryId: number, db?: Db): Promise<RecurringPayment | null> {
  db ??= await getDb();
  const r = await db.get<Row>(
    `SELECT ${COLUMNS} FROM recurring_payments WHERE category_id = ? AND merchant_key IS NULL AND deleted_at IS NULL ORDER BY id LIMIT 1`, [categoryId]);
  return r ? asSub(r) : null;
}

/** The day of the category's last spending ('YYYY-MM-DD'), or null: its own payment is offered the next. */
export async function lastCategoryDay(categoryId: number): Promise<string | null> {
  const r = await (await getDb()).get<{ at: number | null }>(`SELECT max(occurred_at) AS at FROM spend_parts WHERE category_id = ? AND ${CHARGE}`, [categoryId]);
  return r?.at ? dayOfUnix(r.at) : null;
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

/** An operation's merchant's repeating payment for its card: the next charge (with a day), this year's charges in its currency. */
export type PaymentCard = { sub: RecurringPayment; next: string | null; year_count: number; year_minor: number; last: { id: number; amount_minor: number; currency: Currency } | null };

export async function paymentCard(merchantKey: string | null, now = new Date(), categoryId: number | null = null): Promise<PaymentCard | null> {
  const db = await getDb();
  // its merchant's payment, else its category's own
  const sub = (merchantKey ? await paymentOfMerchant(merchantKey) : null)
    ?? (categoryId === null ? null : await categoryPayment(categoryId, db));
  if (!sub) return null;
  const days = (await paymentDays([sub], db))(sub);
  const from = Math.floor(new Date(now.getFullYear(), 0, 1).getTime() / 1000);
  const whose = sub.merchant_key ? `merchant_key = ? AND ${MERCHANT_CHARGE}` : `category_id = ? AND ${CHARGE}`;
  const key = sub.merchant_key ?? sub.category_id;
  const year = await db.get<{ n: number; sum: number | null }>(
    `SELECT count(*) AS n, sum(CASE WHEN currency = ? THEN amount_minor END) AS sum FROM spend_parts
      WHERE ${whose} AND occurred_at >= ?`, [sub.currency, key, from]);
  const last = await db.get<{ id: number; amount_minor: number; currency: string }>(
    `SELECT id, amount_minor, currency FROM spend_parts WHERE ${whose} ORDER BY occurred_at DESC, id DESC LIMIT 1`, [key]);
  return {
    sub, next: sub.due ? nextCharge(sub.due, sub.period, days, todayKey(now), sub.until) : null,
    // the category's own: the times its spending paid it, not each spending
    year_count: sub.merchant_key ? year?.n ?? 0 : days.filter((d) => d >= todayKey(now).slice(0, 4)).length, year_minor: year?.sum ?? 0, last: last ? { ...last, currency: asCurrency(last.currency) } : null,
  };
}
