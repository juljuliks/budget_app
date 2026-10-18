// "Подписки" in a month's plan: its item (kind 'subs') is the month's charges, counted from the subscriptions with a day
// (db/subscriptions/schedule.ts). Until one has a day the item keeps the amount put in by hand (what it had before the
// subscriptions). The current and the coming months are counted again on each look; past ones stay as they were.
import { getDb } from '../index';
import { Currency, makeConverter } from '../fx';
import { chargeDays, listSubscriptions, Subscription, todayKey } from '../subscriptions/reads';
import { addMonths, chargesBetween, monthCharges, monthDays, nextCharge } from '../subscriptions/schedule';
import { asCurrency, currentYm, planRateDate } from './months';

export type SubCharge = { sub: Subscription; day: string; done: boolean; converted_minor: number | null };

export type MonthSubscriptions = {
  /** the month's charges by day */
  charges: SubCharge[];
  /** the others with a day: the next charge after the month (or the next one, for the current month) */
  later: Array<{ sub: Subscription; next: string }>;
  /** those without a day */
  undated: Subscription[];
  /** the charges' sum in `currency` (those without a rate left out) */
  total_minor: number;
  currency: Currency;
};

/** The month's subscriptions as the plan counts them; amounts in `to` (the plan's currency by default). */
export async function monthSubscriptions(ym: string, to?: Currency, now = new Date()): Promise<MonthSubscriptions> {
  const db = await getDb();
  const currency = to ?? asCurrency((await db.get<{ c: string }>('SELECT budget_currency AS c FROM plan_months WHERE ym = ?', [ym]))?.c);
  const subs = await listSubscriptions(db);
  const days = await chargeDays(subs.flatMap((s) => (s.merchant_key ? [s.merchant_key] : [])), db);
  const conv = await makeConverter();
  const rateDay = planRateDate(ym);
  const today = todayKey(now);
  const [, last] = monthDays(ym);
  const out: MonthSubscriptions = { charges: [], later: [], undated: [], total_minor: 0, currency };
  for (const sub of subs) {
    if (!sub.due) { out.undated.push(sub); continue; }
    const ops = sub.merchant_key ? days.get(sub.merchant_key) ?? [] : [];
    const charges = monthCharges(sub.due, sub.period_months, ym, ops, `${sub.since_ym}-01`);
    for (const c of charges) {
      const converted = conv(sub.amount_minor, sub.currency, currency, rateDay);
      out.charges.push({ sub, ...c, converted_minor: converted });
      out.total_minor += converted ?? 0;
    }
    if (!charges.length) {
      // the current month: the next one waited for (a late one too); a coming month: the first after it
      const next = nextCharge(sub.due, sub.period_months, ops, today);
      out.later.push({ sub, next: next > last || ym === currentYm(now) ? next : firstAfter(sub.due, sub.period_months, last) });
    }
  }
  out.charges.sort((a, b) => a.day.localeCompare(b.day));
  out.later.sort((a, b) => a.next.localeCompare(b.next));
  return out;
}

/** A subscription's first charge after `day` (and not before its set day). */
function firstAfter(due: string, periodMonths: number, day: string): string {
  const from = day > due ? day : due;
  return chargesBetween(due, periodMonths, from, addMonths(from, periodMonths)).find((d) => d > day) ?? due;
}

/**
 * The item of "Подписки" in `ym` (the current or a coming month with a plan) set to its charges, in the plan's currency;
 * made if the month has none and there are subscriptions. An amount by hand stays until one has a day.
 */
export async function refreshSubscriptionItem(ym: string, nowYm = currentYm()): Promise<void> {
  if (ym < nowYm) return;
  const db = await getDb();
  // one look when there's nothing to count (the stats open months often)
  const r = await db.get<{ c: string | null; category: number | null; kind: string | null; any: number; dated: number }>(
    `SELECT (SELECT budget_currency FROM plan_months WHERE ym = ?) AS c, (SELECT id FROM categories WHERE system = 'subs') AS category,
        (SELECT p.kind FROM plan_items p JOIN categories c ON c.id = p.category_id WHERE p.ym = ? AND c.system = 'subs') AS kind,
        EXISTS (SELECT 1 FROM subscriptions WHERE deleted_at IS NULL) AS any,
        EXISTS (SELECT 1 FROM subscriptions WHERE deleted_at IS NULL AND due IS NOT NULL) AS dated`, [ym, ym]);
  if (!r || r.c === null || r.category === null) return;
  const categoryId = r.category;
  // an amount by hand stays until a subscription has a day (once counted, it's counted on — 0 with none left); no item and
  // no subscriptions — none made
  if (r.kind === null ? !r.any : r.kind !== 'subs' && !r.dated) return;
  const { total_minor, currency } = await monthSubscriptions(ym, asCurrency(r.c));
  await db.run(
    `INSERT INTO plan_items (ym, category_id, limit_minor, pinned, kind, currency) VALUES (?, ?, ?, 0, 'subs', ?)
      ON CONFLICT (ym, category_id) DO UPDATE SET limit_minor = excluded.limit_minor, kind = 'subs', currency = excluded.currency`,
    [ym, categoryId, total_minor, currency]);
}

/** Every month with a plan from the current one on, counted again (a subscription was changed). */
export async function refreshSubscriptionItems(nowYm = currentYm()): Promise<void> {
  const db = await getDb();
  for (const { ym } of await db.all<{ ym: string }>('SELECT ym FROM plan_months WHERE ym >= ? ORDER BY ym', [nowYm])) {
    await refreshSubscriptionItem(ym, nowYm);
  }
}
