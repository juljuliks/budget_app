// The month's payments with a day, for the marks over the stats' bar: the charges of the regular payments (subscriptions
// and a category's own, monthly or rarer, with "Дата списания") and the one-off payments given a day in their sheet
// (plan_items.due); and the obligatory payments without a day (a weekly tutor, a monthly one with no date) — each day
// their category was spent on this month, a mark per day with what was spent. The marks' places and paid / not paid are worked out by the stats (with the spending).
import { getDb } from '../index';
import { type Currency, makeConverter } from '../fx';
import { monthPayments } from './recurringItems';
import { monthStart } from './months';
import { EXPENSE_KINDS } from '../spending';
import { sqlList } from '../sql';

/** A one-off payment's day in its month (null — none). */
export async function itemDue(ym: string, categoryId: number): Promise<string | null> {
  const r = await (
    await getDb()
  ).get<{ due: string | null }>('SELECT due FROM plan_items WHERE ym = ? AND category_id = ?', [ym, categoryId]);
  return r?.due ?? null;
}

/** A one-off payment's day set (or taken off: null); outside its month — none. */
export async function setItemDue(ym: string, categoryId: number, due: string | null): Promise<void> {
  const day = due && due.startsWith(`${ym}-`) ? due : null;
  await (await getDb()).run('UPDATE plan_items SET due = ? WHERE ym = ? AND category_id = ?', [day, ym, categoryId]);
}

/**
 * One payment on its day. `minor` — its amount in the stats' currency (a one-off payment's: null, its item's whole plan);
 * `done` — a subscription matched with its merchant's operation (true / false); null — the category's own payment or a
 * one-off one, nothing matched: paid as far as the category's spending covers it. `undated` — a payment without a day:
 * a day its category was spent on, `minor` what was spent that day, done.
 */
export type PaymentMark = {
  category_id: number;
  day: string;
  minor: number | null;
  done: boolean | null;
  undated?: boolean;
};

export async function monthPaymentMarks(ym: string, currency: Currency, now = new Date()): Promise<PaymentMark[]> {
  const db = await getDb();
  const payments = await monthPayments(ym, currency, now);
  const marks: PaymentMark[] = payments.charges
    // paid from what was saved for it: not the month's spending
    .filter((c) => !c.saved && c.sub.category_id !== null)
    .map((c) => ({
      category_id: c.sub.category_id!,
      day: c.day,
      minor: c.converted_minor,
      done: c.sub.merchant_key ? c.done : null,
    }));
  const oneOff = await db.all<{ category_id: number; due: string }>(
    "SELECT category_id, due FROM plan_items WHERE ym = ? AND kind = 'fixed' AND every IS NULL AND due IS NOT NULL AND limit_minor > 0",
    [ym],
  );
  for (const r of oneOff) marks.push({ category_id: r.category_id, day: r.due, minor: null, done: null });
  // the others without a day: each day their category was spent on this month, with what was spent (in `currency`)
  const dated = new Set(marks.map((m) => m.category_id));
  const [y, mo] = ym.split('-').map(Number);
  const undated = await db.all<{ category_id: number; day: string; currency: string; amount: number }>(
    `SELECT p.category_id, strftime('%Y-%m-%d', t.occurred_at, 'unixepoch', 'localtime') AS day, t.currency, sum(t.amount_minor) AS amount
      FROM plan_items p JOIN spend_parts t ON t.category_id = p.category_id
      WHERE p.ym = ? AND p.kind = 'fixed' AND p.due IS NULL AND p.limit_minor > 0
        AND t.occurred_at >= ? AND t.occurred_at < ? AND t.kind IN (${sqlList([...EXPENSE_KINDS])})
      GROUP BY p.category_id, day, t.currency`,
    [ym, monthStart(ym), new Date(y, mo, 1).getTime() / 1000],
  );
  const conv = undated.length ? await makeConverter() : null;
  const byDay = new Map<string, PaymentMark>();
  for (const r of undated) {
    if (dated.has(r.category_id)) continue;
    const key = `${r.category_id}|${r.day}`;
    const minor = r.currency === currency ? r.amount : (conv!(r.amount, r.currency, currency, r.day) ?? 0);
    const m = byDay.get(key);
    if (m) m.minor! += minor;
    else byDay.set(key, { category_id: r.category_id, day: r.day, minor, done: true, undated: true });
  }
  marks.push(...byDay.values());
  return marks.sort((a, b) => a.day.localeCompare(b.day));
}
