// The subscriptions and what is known of their merchants: the days they charged, the last operation (what a new
// subscription is made from), the merchants of "Подписки" without one ("Без даты списания").
import { getDb } from '../index';
import type { Db } from '../types';
import { Currency } from '../fx';
import { placeholders, sqlList } from '../sql';
import { asCurrency } from '../plans/months';
import { REMEMBERABLE_KINDS } from '../../domain/types';
import { nextCharge } from './schedule';

/** A repeating payment ("подписка" in "Подписки"): a merchant's charge every N months, of a category with "Повторяющиеся платежи". */
export type Subscription = {
  id: number;
  /** its category (one with "Повторяющиеся платежи") */
  category_id: number | null;
  /** its merchant; null — one without (put in by name) */
  merchant_key: string | null;
  name: string;
  /** one charge, in `currency` */
  amount_minor: number;
  currency: Currency;
  /** charged every N months */
  period_months: number;
  /** a charge's day ('YYYY-MM-DD') the others are counted from; null — "Без даты списания" */
  due: string | null;
  /** the month it was made in: its charges count in plans from it */
  since_ym: string;
};

type Row = Omit<Subscription, 'currency'> & { currency: string };
const COLUMNS = 'id, category_id, merchant_key, name, amount_minor, currency, period_months, due, since_ym';
const asSub = (r: Row): Subscription => ({ ...r, currency: asCurrency(r.currency) });

/** The day of a moment ('YYYY-MM-DD', local). */
export function dayOfUnix(unix: number): string {
  const d = new Date(unix * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today ('YYYY-MM-DD', local). */
export const todayKey = (now = new Date()) => dayOfUnix(Math.floor(now.getTime() / 1000));

/** The payments not deleted (of `categoryId`, or of every category with the switch on), by name. */
export async function listSubscriptions(db?: Db, categoryId?: number): Promise<Subscription[]> {
  db ??= await getDb();
  return (await db.all<Row>(
    `SELECT ${COLUMNS} FROM subscriptions WHERE deleted_at IS NULL
      AND category_id IN (SELECT id FROM categories WHERE recurring = 1 AND deleted_at IS NULL ${categoryId === undefined ? '' : 'AND id = ?'})
      ORDER BY name COLLATE NOCASE`, categoryId === undefined ? [] : [categoryId])).map(asSub);
}

export async function getSubscription(id: number): Promise<Subscription | null> {
  const r = await (await getDb()).get<Row>(`SELECT ${COLUMNS} FROM subscriptions WHERE id = ? AND deleted_at IS NULL`, [id]);
  return r ? asSub(r) : null;
}

/** The merchant's subscription (not deleted), or null. */
export async function subscriptionOfMerchant(merchantKey: string): Promise<Subscription | null> {
  const r = await (await getDb()).get<Row>(`SELECT ${COLUMNS} FROM subscriptions WHERE merchant_key = ? AND deleted_at IS NULL`, [merchantKey]);
  return r ? asSub(r) : null;
}

const CHARGE = `kind IN (${sqlList(REMEMBERABLE_KINDS)})`;

/** The days the merchants were charged on (their purchases and payments), each merchant's in order. */
export async function chargeDays(keys: string[], db?: Db): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>(keys.map((k) => [k, []]));
  if (!keys.length) return out;
  db ??= await getDb();
  const rows = await db.all<{ k: string; at: number }>(
    `SELECT merchant_key AS k, occurred_at AS at FROM transactions WHERE merchant_key IN (${placeholders(keys.length)}) AND ${CHARGE}
      ORDER BY occurred_at`, keys);
  for (const r of rows) out.get(r.k)?.push(dayOfUnix(r.at));
  return out;
}

/** A merchant's last charge: its day, amount and currency, and the merchant's name as the SMS spells it. */
export type LastCharge = { merchant_key: string; name: string; day: string; amount_minor: number; currency: Currency };

export async function lastCharge(merchantKey: string): Promise<LastCharge | null> {
  const r = await (await getDb()).get<{ name: string | null; at: number; amount_minor: number; currency: string }>(
    `SELECT raw_merchant AS name, occurred_at AS at, amount_minor, currency FROM transactions
      WHERE merchant_key = ? AND ${CHARGE} ORDER BY occurred_at DESC LIMIT 1`, [merchantKey]);
  return r ? { merchant_key: merchantKey, name: r.name ?? merchantKey, day: dayOfUnix(r.at), amount_minor: r.amount_minor, currency: asCurrency(r.currency) } : null;
}

/** The merchants charged in "Подписки" (`categoryId`) with no subscription: "Без даты списания", the latest first. */
export async function merchantsWithoutSubscription(categoryId: number): Promise<LastCharge[]> {
  const rows = await (await getDb()).all<{ k: string; name: string | null; at: number; amount_minor: number; currency: string }>(
    `SELECT t.merchant_key AS k, t.raw_merchant AS name, t.occurred_at AS at, t.amount_minor, t.currency FROM transactions t
      WHERE t.category_id = ? AND t.merchant_key IS NOT NULL AND t.${CHARGE}
        AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.merchant_key = t.merchant_key AND s.deleted_at IS NULL)
        AND t.occurred_at = (SELECT max(x.occurred_at) FROM transactions x WHERE x.merchant_key = t.merchant_key AND x.category_id = t.category_id AND x.${CHARGE})
      GROUP BY t.merchant_key ORDER BY t.occurred_at DESC`, [categoryId]);
  return rows.map((r) => ({ merchant_key: r.k, name: r.name ?? r.k, day: dayOfUnix(r.at), amount_minor: r.amount_minor, currency: asCurrency(r.currency) }));
}

/**
 * Merchants with no subscription for step 1 of "Добавить подписку": those charged the same amount in two months or more
 * first ("похожи на подписку"), then the others by their last charge; `query` — by name.
 */
export async function merchantsToSubscribe(query = '', limit = 40): Promise<Array<LastCharge & { likely: boolean }>> {
  const like = `%${query.trim().toLowerCase()}%`;
  const rows = await (await getDb()).all<{ k: string; name: string | null; at: number; amount_minor: number; currency: string; likely: number }>(
    `SELECT t.merchant_key AS k, t.raw_merchant AS name, t.occurred_at AS at, t.amount_minor, t.currency,
        (SELECT count(DISTINCT strftime('%Y-%m', x.occurred_at, 'unixepoch', 'localtime')) FROM transactions x
          WHERE x.merchant_key = t.merchant_key AND x.amount_minor = t.amount_minor AND x.${CHARGE}) >= 2 AS likely
      FROM transactions t
      WHERE t.merchant_key IS NOT NULL AND t.${CHARGE} AND lower(t.merchant_key) LIKE ?
        AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.merchant_key = t.merchant_key AND s.deleted_at IS NULL)
        AND t.occurred_at = (SELECT max(y.occurred_at) FROM transactions y WHERE y.merchant_key = t.merchant_key AND y.${CHARGE})
      GROUP BY t.merchant_key ORDER BY likely DESC, t.occurred_at DESC LIMIT ?`, [like, limit]);
  return rows.map((r) => ({ merchant_key: r.k, name: r.name ?? r.k, day: dayOfUnix(r.at), amount_minor: r.amount_minor, currency: asCurrency(r.currency), likely: r.likely === 1 }));
}

/** An operation's merchant's subscription for its card: the next charge (with a day), this year's charges in its currency. */
export type SubscriptionCard = { sub: Subscription; next: string | null; year_count: number; year_minor: number; last: { id: number; amount_minor: number; currency: Currency } | null };

export async function subscriptionCard(merchantKey: string, now = new Date()): Promise<SubscriptionCard | null> {
  const sub = await subscriptionOfMerchant(merchantKey);
  if (!sub) return null;
  const db = await getDb();
  const days = (await chargeDays([merchantKey], db)).get(merchantKey) ?? [];
  const from = Math.floor(new Date(now.getFullYear(), 0, 1).getTime() / 1000);
  const year = await db.get<{ n: number; sum: number | null }>(
    `SELECT count(*) AS n, sum(CASE WHEN currency = ? THEN amount_minor END) AS sum FROM transactions
      WHERE merchant_key = ? AND ${CHARGE} AND occurred_at >= ?`, [sub.currency, merchantKey, from]);
  const last = await db.get<{ id: number; amount_minor: number; currency: string }>(
    `SELECT id, amount_minor, currency FROM transactions WHERE merchant_key = ? AND ${CHARGE} ORDER BY occurred_at DESC, id DESC LIMIT 1`, [merchantKey]);
  return {
    sub, next: sub.due ? nextCharge(sub.due, sub.period_months, days, todayKey(now)) : null,
    year_count: year?.n ?? 0, year_minor: year?.sum ?? 0, last: last ? { ...last, currency: asCurrency(last.currency) } : null,
  };
}
