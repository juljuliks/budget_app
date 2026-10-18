// The month's budget (the amount, the share outside the plan, the locked savings), its income, the plan's creation.
import { getDb } from '../index';
import { Currency, dateKey, ensureRatesLater, makeConverter } from '../fx';
import { BUDGET_CURRENCY, asCurrency, currentYm, monthRange, parseYm, planRateDate } from './months';
import { convertSpending, spendRows, sumBy } from './spend';
import { PlanBudget } from './types';
import { refreshFundItems, ymBefore } from './funds';
import { refreshSubscriptionItem } from './subscriptionItems';

/** The unplanned share of a budget, in its currency. */
export const unplannedOf = (b: Pick<PlanBudget, 'amount_minor' | 'unplanned_pct' | 'unplanned_minor'>) =>
  b.unplanned_minor ?? b.amount_minor - plannableOf(b.amount_minor, b.unplanned_pct);

/**
 * Creates the month's plan on first access by carrying items over from the latest earlier
 * planned month: pinned items keep their amount, the others come with an empty amount to fill in.
 * Past months are never initialized automatically (history must not change by looking at it).
 */
export async function ensureMonthPlan(ym: string, nowYm = currentYm()): Promise<void> {
  if (ym < nowYm) return;
  const created = await createMonthPlan(ym);
  // the funds' contributions as what is saved now asks (the spending since changed it)
  await refreshFundItems(ym, nowYm);
  // "Подписки": a new month's charges (later — counted again by each change of a subscription)
  if (created) await refreshSubscriptionItem(ym, nowYm);
}

/** Made now: true; already there: false. */
async function createMonthPlan(ym: string): Promise<boolean> {
  const db = await getDb();
  if (await db.get('SELECT 1 FROM plan_months WHERE ym = ?', [ym])) return false;
  await db.transaction(async (tx) => {
    const source = await tx.get<{ ym: string }>('SELECT ym FROM plan_months WHERE ym < ? ORDER BY ym DESC LIMIT 1', [ym]);
    if (source) {
      await tx.run(
        `INSERT OR IGNORE INTO plan_items (ym, category_id, limit_minor, pinned, kind, currency, norm_period)
          SELECT ?, p.category_id, CASE WHEN p.pinned = 1 THEN p.limit_minor ELSE 0 END, p.pinned, p.kind, p.currency, p.norm_period
          FROM plan_items p JOIN categories c ON c.id = p.category_id
          WHERE p.ym = ? AND c.deleted_at IS NULL
            AND (p.kind != 'fund' OR EXISTS (SELECT 1 FROM funds f WHERE f.category_id = p.category_id AND f.closed_ym IS NULL))`,
        [ym, source.ym]);
    }
    // the amount to distribute (usually the salary) carries over as well, with its currency, unplanned share, savings choice
    // and what is locked for savings
    await tx.run(
      `INSERT OR IGNORE INTO plan_months (ym, budget_minor, budget_currency, unplanned_pct, to_savings, locked_minor, unplanned_minor) VALUES (?,
        (SELECT budget_minor FROM plan_months WHERE ym = ?),
        coalesce((SELECT budget_currency FROM plan_months WHERE ym = ?), ?),
        coalesce((SELECT unplanned_pct FROM plan_months WHERE ym = ?), 0),
        coalesce((SELECT to_savings FROM plan_months WHERE ym = ?), 1),
        coalesce((SELECT locked_minor FROM plan_months WHERE ym = ?), 0),
        (SELECT unplanned_minor FROM plan_months WHERE ym = ?))`,
      [ym, source?.ym ?? '', source?.ym ?? '', BUDGET_CURRENCY, source?.ym ?? '', source?.ym ?? '', source?.ym ?? '', source?.ym ?? '']);
  });
  return true;
}

/**
 * What the month before sent to `ym` when it was closed ("Итоги месяца"): an overspend owed ("Из бюджета октября") and
 * the leftover moved ("Перенести на октябрь"), in `currency`. null — nothing.
 */
export async function carryIn(ym: string, currency: Currency): Promise<PlanBudget['carry']> {
  const db = await getDb();
  const from = ymBefore(ym);
  const r = await db.get<{ debt: number; plus: number; currency: string }>(
    `SELECT carry_debt_minor AS debt, carry_plus_minor AS plus, carry_currency AS currency FROM month_closes
      WHERE ym = ? AND closed_at IS NOT NULL AND carry_currency IS NOT NULL AND (carry_debt_minor > 0 OR carry_plus_minor > 0)`, [from]);
  if (!r) return null;
  const conv = r.currency === currency ? null : await planConverter(ym);
  const to = (v: number) => (conv ? conv(v, r.currency, currency) ?? v : v);
  return { from_ym: from, debt_minor: to(r.debt), plus_minor: to(r.plus) };
}

export async function storedBudget(ym: string): Promise<PlanBudget | null> {
  const db = await getDb();
  const row = await db.get<{ budget_minor: number | null; budget_currency: string | null; unplanned_pct: number; to_savings: number; locked_minor: number; unplanned_minor: number | null }>(
    'SELECT budget_minor, budget_currency, unplanned_pct, to_savings, locked_minor, unplanned_minor FROM plan_months WHERE ym = ?', [ym]);
  if (row?.budget_minor == null) return null;
  const share = unplannedOf({ amount_minor: row.budget_minor, unplanned_pct: row.unplanned_pct, unplanned_minor: row.unplanned_minor });
  const currency = asCurrency(row.budget_currency);
  const carry = await carryIn(ym, currency);
  return {
    amount_minor: row.budget_minor, currency, unplanned_pct: row.unplanned_pct,
    unplanned_minor: row.unplanned_minor, locked_minor: row.locked_minor,
    plannable_minor: row.budget_minor - share - row.locked_minor + (carry?.plus_minor ?? 0) - (carry?.debt_minor ?? 0),
    to_savings: row.to_savings === 1, carry,
  };
}

/** What the plan can take of `amount` with `pct`% set aside for spending outside it. */
export function plannableOf(amount: number, pct: number): number {
  return Math.round((amount * (100 - pct)) / 100);
}

/** The month's amount to distribute; null = not set (no cap, no percentages). */
export async function getPlanBudget(ym: string): Promise<PlanBudget | null> {
  await ensureMonthPlan(ym);
  return storedBudget(ym);
}

/** The currency plan totals of the month are in: the amount to distribute's, else the default. */
export async function planCurrency(ym: string): Promise<Currency> {
  const db = await getDb();
  return asCurrency((await db.get<{ c: string }>('SELECT budget_currency AS c FROM plan_months WHERE ym = ?', [ym]))?.c);
}

/** A converter on the month's plan date (its rate fetched in the background if missing): plan amounts shown in another currency. */
export async function planConverter(ym: string): Promise<(minor: number, from: string, to: string) => number | null> {
  const date = planRateDate(ym);
  await ensureRatesLater([date]);
  const conv = await makeConverter();
  return (minor, from, to) => conv(minor, from, to, date);
}

/**
 * Sum of the month's plan items in `currency` (the amount to distribute's by default), optionally without one
 * category (the one being changed). Items without a rate yet are left out.
 */
export async function plannedTotal(ym: string, exceptCategoryId?: number, currency?: Currency): Promise<number> {
  const db = await getDb();
  const to = currency ?? (await planCurrency(ym));
  const rows = await db.all<{ limit_minor: number; currency: string }>(
    'SELECT limit_minor, currency FROM plan_items WHERE ym = ? AND category_id IS NOT ?', [ym, exceptCategoryId ?? null]);
  const conv = await planConverter(ym);
  return rows.reduce((s, r) => s + (conv(r.limit_minor, r.currency, to) ?? 0), 0);
}

/**
 * What came in this month, in `currency` (each on its day's rate): a hint for the amount to distribute. The deposits in
 * "Пополнение счёта", and each transfer category that brought in more than was sent (a person paying back more).
 */
export async function monthIncome(ym: string, currency: Currency = BUDGET_CURRENCY): Promise<number> {
  const { year, month } = parseYm(ym);
  const [from, to] = monthRange(year, month);
  const db = await getDb();
  const rows = await db.all<{ amount_minor: number; currency: string; occurred_at: number }>(
    `SELECT amount_minor, currency, occurred_at FROM transactions
      WHERE kind = 'deposit' AND occurred_at >= ? AND occurred_at < ? AND category_id = (SELECT id FROM categories WHERE system = 'topup')`,
    [from, to]);
  await ensureRatesLater(rows.filter((r) => r.currency !== currency).map((r) => dateKey(r.occurred_at)));
  const conv = await makeConverter();
  const topUp = rows.reduce((s, r) => s + (conv(r.amount_minor, r.currency, currency, dateKey(r.occurred_at)) ?? 0), 0);
  const transferIds = new Set((await db.all<{ id: number }>(
    'SELECT c.id FROM categories c JOIN category_types ct ON ct.id = c.type_id WHERE ct.is_transfer = 1')).map((c) => c.id));
  const { items } = await convertSpending((await spendRows(from, to)).filter((r) => r.category_id !== null && transferIds.has(r.category_id)), currency);
  const net = sumBy(items, (r) => r.category_id);
  return topUp + [...net.values()].reduce((s, v) => s + Math.max(0, -v), 0);
}

/** Thrown when a change would plan more than the month's amount to distribute (amounts in `currency`). */
export class OverBudgetError extends Error {
  constructor(public budget_minor: number, public planned_minor: number, public currency: Currency = BUDGET_CURRENCY) {
    super('plan exceeds the amount to distribute');
  }
}

/**
 * null clears the amount. `unplannedPct`: the share set aside for spending outside the plan; `toSavings`: the leftover
 * goes to "Сбережения"; `lockedMinor`: locked for savings right away, in `currency`; `unplannedMinor`: the share as an amount
 * instead of the % (null = by the %). All kept when omitted.
 * Refused (OverBudgetError, its budget_minor = what the plan can take) if what is already planned (converted) doesn't fit.
 */
export async function setPlanBudget(
  ym: string, budgetMinor: number | null, currency: Currency = BUDGET_CURRENCY, unplannedPct?: number, toSavings?: boolean, lockedMinor?: number,
  unplannedMinor?: number | null,
) {
  await ensureMonthPlan(ym);
  const db = await getDb();
  const stored = await db.get<{ p: number; s: number; l: number; u: number | null }>(
    'SELECT unplanned_pct AS p, to_savings AS s, locked_minor AS l, unplanned_minor AS u FROM plan_months WHERE ym = ?', [ym]);
  const own = unplannedMinor === undefined ? stored?.u ?? null : unplannedMinor === null ? null : Math.max(0, unplannedMinor);
  const pct = unplannedPct ?? stored?.p ?? 0;
  const savings = toSavings ?? (stored ? stored.s === 1 : true);
  const locked = Math.max(0, lockedMinor ?? stored?.l ?? 0);
  if (budgetMinor !== null) {
    const planned = await plannedTotal(ym, undefined, currency);
    const carry = await carryIn(ym, currency);
    const plannable = budgetMinor - unplannedOf({ amount_minor: budgetMinor, unplanned_pct: pct, unplanned_minor: own }) - locked
      + (carry?.plus_minor ?? 0) - (carry?.debt_minor ?? 0);
    if (plannable < planned) throw new OverBudgetError(plannable, planned, currency);
  }
  await db.transaction(async (t) => {
    await t.run('INSERT OR IGNORE INTO plan_months (ym) VALUES (?)', [ym]);
    await t.run('UPDATE plan_months SET budget_minor = ?, budget_currency = ?, unplanned_pct = ?, to_savings = ?, locked_minor = ?, unplanned_minor = ? WHERE ym = ?',
      [budgetMinor, currency, pct, savings ? 1 : 0, budgetMinor === null ? 0 : locked, budgetMinor === null ? null : own, ym]);
  });
}
