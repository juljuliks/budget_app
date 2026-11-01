// The month's budget (the amount, the share outside the plan, the locked savings), its income, the plan's creation.
import { getDb } from '../index';
import type { Db } from '../types';
import { Currency, dateKey, ensureRatesLater, makeConverter } from '../fx';
import { BUDGET_CURRENCY, asCurrency, currentYm, monthRange, parseYm, planRateDate } from './months';
import { convertSpending, spendRows, sumBy } from './spend';
import { PlanBudget } from './types';
import { refreshFundItems, ymBefore } from './funds';
import { refreshRecurringItem } from './recurringItems';
import { countRegularItems } from './regular';

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
  const created = await createMonthPlan(ym, nowYm);
  // the funds' contributions as what is saved now asks (the spending since changed it)
  await refreshFundItems(ym, nowYm);
  // "Подписки": a new month's charges (later — counted again by each change of a repeating payment)
  if (created) await refreshRecurringItem(ym, nowYm);
}

/**
 * Made now: true; already there: false. A coming month made before it began follows the months before it (`follows`)
 * till it is changed by hand (ownMonth) or begins: a change of an earlier one drops it, made again on the next look.
 */
async function createMonthPlan(ym: string, nowYm: string): Promise<boolean> {
  const db = await getDb();
  const made = await db.get<{ follows: number }>('SELECT follows FROM plan_months WHERE ym = ?', [ym]);
  if (made) {
    // begun: it keeps what it has, as a month made on its first day
    if (made.follows && ym <= nowYm) await db.run('UPDATE plan_months SET follows = 0 WHERE ym = ?', [ym]);
    return false;
  }
  await db.transaction(async (tx) => {
    // a month following the ones before is no source: it may be behind them
    const source = await tx.get<{ ym: string }>('SELECT ym FROM plan_months WHERE ym < ? AND follows = 0 ORDER BY ym DESC LIMIT 1', [ym]);
    if (source) {
      // "Дата окончания" before this month: not repeated any more
      const ended = `p.until IS NOT NULL AND p.until < '${ym}-01'`;
      await tx.run(
        `INSERT OR IGNORE INTO plan_items (ym, category_id, limit_minor, pinned, kind, currency, norm_period, until, every, weekdays, unit_minor)
          -- a category with regular payments always goes on with its amount (a dated one is counted again right after)
          SELECT ?, p.category_id, CASE WHEN (p.pinned = 1 AND NOT (${ended})) OR c.recurring = 1 THEN p.limit_minor ELSE 0 END,
            CASE WHEN ${ended} THEN 0 ELSE p.pinned END, p.kind, p.currency, p.norm_period,
            CASE WHEN ${ended} THEN NULL ELSE p.until END, p.every, p.weekdays, p.unit_minor
          FROM plan_items p JOIN categories c ON c.id = p.category_id
          WHERE p.ym = ? AND c.deleted_at IS NULL
            AND (p.kind != 'fund' OR EXISTS (SELECT 1 FROM funds f WHERE f.category_id = p.category_id AND f.closed_ym IS NULL))
            -- a regular payment within the month goes on only repeated each month, till its end
            AND NOT (p.kind = 'fixed' AND p.every IS NOT NULL AND (p.pinned = 0 OR ${ended}))`,
        [ym, source.ym]);
      await countRegularItems(ym, tx);
    }
    // the amount to distribute (usually the salary) carries over as well, with its currency, unplanned share, savings choice
    // and what is locked for savings
    await tx.run(
      `INSERT OR IGNORE INTO plan_months (ym, follows, budget_minor, budget_currency, unplanned_pct, to_savings, locked_minor, unplanned_minor, locked_is_max) VALUES (?, ?,
        (SELECT budget_minor FROM plan_months WHERE ym = ?),
        coalesce((SELECT budget_currency FROM plan_months WHERE ym = ?), ?),
        coalesce((SELECT unplanned_pct FROM plan_months WHERE ym = ?), 0),
        coalesce((SELECT to_savings FROM plan_months WHERE ym = ?), 1),
        coalesce((SELECT locked_minor FROM plan_months WHERE ym = ?), 0),
        (SELECT unplanned_minor FROM plan_months WHERE ym = ?),
        coalesce((SELECT locked_is_max FROM plan_months WHERE ym = ?), 0))`,
      [ym, ym > nowYm ? 1 : 0, source?.ym ?? '', source?.ym ?? '', BUDGET_CURRENCY, source?.ym ?? '', source?.ym ?? '', source?.ym ?? '', source?.ym ?? '', source?.ym ?? '']);
  });
  return true;
}

/**
 * The month changed by hand: planned (also a past one — later months carry over from it), its own plan from now on;
 * the coming months that only followed it are dropped, to be made again from it.
 */
export async function ownMonth(ym: string, db: Db): Promise<void> {
  await db.run('INSERT OR IGNORE INTO plan_months (ym) VALUES (?)', [ym]);
  await db.run('UPDATE plan_months SET follows = 0 WHERE ym = ?', [ym]);
  await db.run('DELETE FROM plan_items WHERE ym IN (SELECT ym FROM plan_months WHERE ym > ? AND follows = 1)', [ym]);
  await db.run('DELETE FROM plan_months WHERE ym > ? AND follows = 1', [ym]);
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
  const row = await db.get<{ budget_minor: number | null; budget_currency: string | null; unplanned_pct: number; to_savings: number; locked_minor: number; unplanned_minor: number | null; locked_is_max: number }>(
    'SELECT budget_minor, budget_currency, unplanned_pct, to_savings, locked_minor, unplanned_minor, locked_is_max FROM plan_months WHERE ym = ?', [ym]);
  if (row?.budget_minor == null) return null;
  const share = unplannedOf({ amount_minor: row.budget_minor, unplanned_pct: row.unplanned_pct, unplanned_minor: row.unplanned_minor });
  const currency = asCurrency(row.budget_currency);
  const carry = await carryIn(ym, currency);
  const lockedIsMax = row.locked_is_max === 1;
  const carryDelta = (carry?.plus_minor ?? 0) - (carry?.debt_minor ?? 0);
  const locked_minor = lockedIsMax
    ? Math.max(0, row.budget_minor - share - await plannedTotal(ym, undefined, currency) + carryDelta)
    : row.locked_minor;
  // for MAX, locked auto-adjusts; plannable = the full free budget (cap = budget − share), not limited by locked
  const plannable_minor = lockedIsMax
    ? row.budget_minor - share + carryDelta
    : row.budget_minor - share - locked_minor + carryDelta;
  return {
    amount_minor: row.budget_minor, currency, unplanned_pct: row.unplanned_pct,
    unplanned_minor: row.unplanned_minor, locked_minor, locked_is_max: lockedIsMax,
    plannable_minor,
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
 * The coming months already planned get the same budget.
 */
export async function setPlanBudget(
  ym: string, budgetMinor: number | null, currency: Currency = BUDGET_CURRENCY, unplannedPct?: number, toSavings?: boolean, lockedMinor?: number,
  unplannedMinor?: number | null, lockedIsMax?: boolean,
) {
  await ensureMonthPlan(ym);
  const db = await getDb();
  const stored = await db.get<{ p: number; s: number; l: number; u: number | null; m: number }>(
    'SELECT unplanned_pct AS p, to_savings AS s, locked_minor AS l, unplanned_minor AS u, locked_is_max AS m FROM plan_months WHERE ym = ?', [ym]);
  const own = unplannedMinor === undefined ? stored?.u ?? null : unplannedMinor === null ? null : Math.max(0, unplannedMinor);
  const pct = unplannedPct ?? stored?.p ?? 0;
  const savings = toSavings ?? (stored ? stored.s === 1 : true);
  const isMax = lockedIsMax ?? (stored?.m === 1);
  // when MAX: store 0, recomputed on each read; otherwise store the explicit amount
  const locked = isMax ? 0 : Math.max(0, lockedMinor ?? stored?.l ?? 0);
  if (budgetMinor !== null && !isMax) {
    const planned = await plannedTotal(ym, undefined, currency);
    const carry = await carryIn(ym, currency);
    const plannable = budgetMinor - unplannedOf({ amount_minor: budgetMinor, unplanned_pct: pct, unplanned_minor: own }) - locked
      + (carry?.plus_minor ?? 0) - (carry?.debt_minor ?? 0);
    if (plannable < planned) throw new OverBudgetError(plannable, planned, currency);
  }
  await db.transaction(async (t) => {
    await ownMonth(ym, t);
    // the months after it planned already (changed by hand too) follow it: the budget goes on as set last; a past month's
    // is history, it doesn't move the others
    await t.run(
      `UPDATE plan_months SET budget_minor = ?, budget_currency = ?, unplanned_pct = ?, to_savings = ?, locked_minor = ?, unplanned_minor = ?, locked_is_max = ?
        WHERE ym = ? OR (ym > ? AND ? >= ?)`,
      [budgetMinor, currency, pct, savings ? 1 : 0, budgetMinor === null ? 0 : locked, budgetMinor === null ? null : own, budgetMinor === null ? 0 : (isMax ? 1 : 0),
        ym, ym, ym, currentYm()]);
  });
}
