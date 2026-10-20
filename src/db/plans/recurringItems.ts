// A category with "Регулярные платежи" ("Подписки" one) in a month's plan: its item (kind 'subs') is the month's
// charges, counted from its payments (repeating payments) with a day
// (db/recurring/schedule.ts). Until one has a day the item keeps the amount put in by hand (what it had before the
// repeating payments). The current and the coming months are counted again on each look; past ones stay as they were. A
// repeating payment saved up for ("Откладывать каждый месяц?") puts its contribution in instead of its charge (paid from
// what was saved).
import { getDb } from '../index';
import { Currency, makeConverter } from '../fx';
import { dayOfUnix, listPayments, paymentDays, RecurringPayment, todayKey } from '../recurring/reads';
import { chargeAt, chargesBetween, monthCharges, monthDays, nextCharge, ONCE, Period } from '../recurring/schedule';
import { savingEffects, storeContributions } from '../recurring/saving';
import { asCurrency, currentYm, planRateDate } from './months';

/** `saved`: paid from what was saved for it (not in the month's sum) */
export type PaymentCharge = { sub: RecurringPayment; day: string; done: boolean; converted_minor: number | null; saved: boolean };

/** A repeating payment saved up for in the month: what it has at the month's start, the contribution, in its currency. */
export type PaymentSavingMonth = { payment_id: number; start_minor: number; contribution_minor: number; end_minor: number; converted_minor: number | null; from_day: string };

export type MonthPayments = {
  /** the month's charges by day */
  charges: PaymentCharge[];
  /** the others with a day: the next charge after the month (or the next one, for the current month) */
  later: Array<{ sub: RecurringPayment; next: string }>;
  /** those without a day */
  undated: RecurringPayment[];
  /** the repeating payments saved up for */
  saving: PaymentSavingMonth[];
  /** the charges' sum (but those paid from what was saved) and the contributions, in `currency` (those without a rate left out) */
  total_minor: number;
  currency: Currency;
};

/** The month's payments of `categoryId` (all — every such category's) as the plan counts them; amounts in `to` (the plan's currency by default). */
export async function monthPayments(ym: string, to?: Currency, now = new Date(), categoryId?: number): Promise<MonthPayments> {
  const db = await getDb();
  const currency = to ?? asCurrency((await db.get<{ c: string }>('SELECT budget_currency AS c FROM plan_months WHERE ym = ?', [ym]))?.c);
  const subs = await listPayments(db, categoryId);
  const daysOf = await paymentDays(subs, db);
  const conv = await makeConverter();
  const rateDay = planRateDate(ym);
  const today = todayKey(now);
  const [, last] = monthDays(ym);
  const out: MonthPayments = { charges: [], later: [], undated: [], saving: [], total_minor: 0, currency };
  for (const e of await savingEffects(ym, currentYm(now), db)) {
    if (!e.month || (categoryId !== undefined && e.saving.category_id !== categoryId)) continue;
    const converted = conv(e.month.contribution, e.currency, currency, rateDay);
    out.saving.push({
      payment_id: e.saving.payment_id, start_minor: e.month.start, contribution_minor: e.month.contribution, end_minor: e.month.end, converted_minor: converted,
      from_day: e.saving.created_at ? dayOfUnix(e.saving.created_at) : '',
    });
    out.total_minor += converted ?? 0;
  }
  // a charge before the saving was made isn't paid from it
  const savedFrom = new Map(out.saving.map((v) => [v.payment_id, v.from_day]));
  for (const sub of subs) {
    if (!sub.due) { out.undated.push(sub); continue; }
    const ops = daysOf(sub);
    const charges = monthCharges(sub.due, sub.period, ym, ops, `${sub.since_ym}-01`, sub.until);
    for (const c of charges) {
      const converted = conv(sub.amount_minor, sub.currency, currency, rateDay);
      const saved = savedFrom.has(sub.id) && c.day >= savedFrom.get(sub.id)!;
      out.charges.push({ sub, ...c, converted_minor: converted, saved });
      if (!saved) out.total_minor += converted ?? 0;
    }
    if (!charges.length) {
      // the current month: the next one waited for (a late one too); a coming month: the first after it; a one-off one
      // done — none
      const next = nextCharge(sub.due, sub.period, ops, today, sub.until);
      const after = next === null ? null : next > last || ym === currentYm(now) ? next : firstAfter(sub.due, sub.period, last);
      // past its end ("Дата окончания"): none
      const later = after && sub.until && after > sub.until ? null : after;
      if (later) out.later.push({ sub, next: later });
    }
  }
  out.charges.sort((a, b) => a.day.localeCompare(b.day));
  out.later.sort((a, b) => a.next.localeCompare(b.next));
  return out;
}

/** A repeating payment's first charge after `day` (and not before its set day); null — a one-off one before it. */
function firstAfter(due: string, p: Period, day: string): string | null {
  if (p === ONCE) return due > day ? due : null;
  const from = day > due ? day : due;
  return chargesBetween(due, p, from, chargeAt(from, p, 1)).find((d) => d > day) ?? due;
}

/**
 * The items of the categories with "Регулярные платежи" in `ym` (the current or a coming month with a plan) set to
 * their charges, in the plan's currency; made if the month has none and the category has payments. An amount by hand
 * stays until one of them has a day.
 */
export async function refreshRecurringItem(ym: string, nowYm = currentYm()): Promise<void> {
  if (ym < nowYm) return;
  const db = await getDb();
  const c = (await db.get<{ c: string | null }>('SELECT budget_currency AS c FROM plan_months WHERE ym = ?', [ym]))?.c;
  if (!c) return;
  await storeContributions(ym, nowYm, db);
  // one look for every such category: its item, has it payments, has one a day
  const cats = await db.all<{ id: number; kind: string | null; any: number; dated: number }>(
    `SELECT c.id, (SELECT p.kind FROM plan_items p WHERE p.ym = ? AND p.category_id = c.id) AS kind,
        EXISTS (SELECT 1 FROM recurring_payments s WHERE s.category_id = c.id AND s.deleted_at IS NULL) AS any,
        EXISTS (SELECT 1 FROM recurring_payments s WHERE s.category_id = c.id AND s.deleted_at IS NULL AND s.due IS NOT NULL) AS dated
      FROM categories c WHERE c.recurring = 1 AND c.deleted_at IS NULL`, [ym]);
  for (const r of cats) {
    // an amount by hand stays until a payment has a day (once counted, it's counted on — 0 with none left); no item and
    // no payments — none made
    if (r.kind === null ? !r.any : r.kind !== 'subs' && !r.dated) continue;
    const { total_minor, currency } = await monthPayments(ym, asCurrency(c), undefined, r.id);
    await db.run(
      `INSERT INTO plan_items (ym, category_id, limit_minor, pinned, kind, currency) VALUES (?, ?, ?, 0, 'subs', ?)
        ON CONFLICT (ym, category_id) DO UPDATE SET limit_minor = excluded.limit_minor, kind = 'subs', currency = excluded.currency`,
      [ym, r.id, total_minor, currency]);
  }
}

/** Every month with a plan from the current one on, counted again (a repeating payment was changed). */
export async function refreshRecurringItems(nowYm = currentYm()): Promise<void> {
  const db = await getDb();
  for (const { ym } of await db.all<{ ym: string }>('SELECT ym FROM plan_months WHERE ym >= ? ORDER BY ym', [nowYm])) {
    await refreshRecurringItem(ym, nowYm);
  }
}

export type PaymentDraft = { merchant_key: string; category_id?: number | null; amount_minor: number; currency: Currency; period: Period; due: string | null; until?: string | null };

/**
 * What saving a repeating payment does to the plan: the first month from this one it is charged in ("В план октября +30 ₾"),
 * and by how much that month's "Подписки" changes (the repeating payment `id` as it was taken off), and its charges there,
 * in the month's plan currency. No day — null.
 */
export async function planEffect(draft: PaymentDraft, id?: number, now = new Date()): Promise<{ ym: string; delta_minor: number; after_minor: number; currency: Currency } | null> {
  if (!draft.due) return null;
  const db = await getDb();
  const nowYm = currentYm(now);
  const old = id === undefined ? null : (await listPayments(db)).find((s) => s.id === id) ?? null;
  const own = { merchant_key: draft.merchant_key };
  const daysOf = await paymentDays(old ? [own, old] : [own], db);
  const since = `${old?.since_ym ?? nowYm}-01`;
  const chargesIn = (ym: string) => monthCharges(draft.due!, draft.period, ym, daysOf(own), since, draft.until).length;
  // a one-off one already past: this month
  const next = nextCharge(draft.due, draft.period, daysOf(own), todayKey(now)) ?? draft.due;
  const ym = chargesIn(nowYm) ? nowYm : next.slice(0, 7) < nowYm ? nowYm : next.slice(0, 7);
  const currency = asCurrency((await db.get<{ c: string }>('SELECT budget_currency AS c FROM plan_months WHERE ym = ?', [ym]))?.c);
  const conv = await makeConverter();
  const rateDay = planRateDate(ym);
  const was = old?.due ? monthCharges(old.due, old.period, ym, daysOf(old), `${old.since_ym}-01`, old.until).length * (conv(old.amount_minor, old.currency, currency, rateDay) ?? 0) : 0;
  const after = chargesIn(ym) * (conv(draft.amount_minor, draft.currency, currency, rateDay) ?? 0);
  return { ym, delta_minor: after - was, after_minor: after, currency };
}
