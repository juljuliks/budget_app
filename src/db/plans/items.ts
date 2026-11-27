// The plan's items: added, their amount, pinned, removed; within the budget. Listed — itemsList.ts.
import { getDb } from '../index';
import { systemCurrency } from '../settings';
import type { SqlParam } from '../types';
import { placeholders } from '../sql';
import { Currency } from '../fx';
import { asCurrency } from './months';
import { followItem, itemShape } from './carry';
import { categoryPlanKind, kindFromItem } from './categoryKind';
import { NormPeriod, PlanKind, asNorm } from './types';
import type { Every } from './regularTimes';
import type {} from '../recurring/reads';
import { OverBudgetError, ensureMonthPlan, ownMonth, planConverter, plannedTotal, storedBudget } from './budget';

/** The category's amount, currency and kind in the latest earlier month that planned it with an amount. */
export async function lastPlanItem(
  ym: string,
  categoryId: number,
): Promise<{ ym: string; limit_minor: number; currency: Currency; kind: PlanKind; norm_period: NormPeriod } | null> {
  const db = await getDb();
  const row = await db.get<{ ym: string; limit_minor: number; currency: string; kind: PlanKind; norm_period: string }>(
    `SELECT ym, limit_minor, currency, kind, norm_period FROM plan_items WHERE ym < ? AND category_id = ? AND limit_minor > 0
      ORDER BY ym DESC LIMIT 1`,
    [ym, categoryId],
  );
  return row ? { ...row, currency: asCurrency(row.currency), norm_period: asNorm(row.norm_period) } : null;
}

/** The category's current plan item for this month: the fields needed to open its edit sheet. */
export async function getPlanItemBasics(ym: string, categoryId: number) {
  type R = {
    limit_minor: number;
    currency: string;
    kind: string;
    norm_period: string;
    pinned: number;
    until: string | null;
    recurring: number;
    by_merchant: number;
    every: string | null;
    weekdays: number | null;
    unit_minor: number | null;
  };
  const db = await getDb();
  const r = await db.get<R>(
    `SELECT p.limit_minor, p.currency, p.kind, p.norm_period, p.pinned, p.until, c.recurring, coalesce(c.system = 'subs', 0) AS by_merchant, CASE WHEN p.kind = 'fixed' THEN p.every END AS every, p.weekdays, p.unit_minor FROM plan_items p JOIN categories c ON c.id = p.category_id WHERE p.ym = ? AND p.category_id = ?`,
    [ym, categoryId],
  );
  if (!r) return null;
  return {
    limit_minor: r.limit_minor,
    currency: asCurrency(r.currency),
    kind: r.kind as PlanKind,
    norm_period: asNorm(r.norm_period),
    pinned: r.pinned === 1,
    until: r.until,
    recurring: !!r.recurring,
    by_merchant: !!r.by_merchant,
    every: r.every as Every | null,
    weekdays: r.weekdays,
    unit_minor: r.unit_minor,
  };
}

/** Would `minor` in `currency` for this category still fit the month's amount to distribute? */
async function fits(
  ym: string,
  categoryId: number,
  minor: number,
  currency: Currency,
): Promise<OverBudgetError | null> {
  const budget = await storedBudget(ym);
  if (budget === null) return null;
  const conv = await planConverter(ym);
  const own = conv(minor, currency, budget.currency);
  if (own === null) return null; // no rate at all: can't check
  const planned = (await plannedTotal(ym, categoryId, budget.currency)) + own;
  // the unplanned share isn't for the plan
  return planned > budget.plannable_minor
    ? new OverBudgetError(budget.plannable_minor, planned, budget.currency)
    : null;
}

/**
 * Adds a category to the month's plan. Without an amount it takes the category's amount, currency and kind from
 * the last month that planned it — unless that no longer fits the amount to distribute, then it starts empty.
 */
export async function addPlanItem(ym: string, categoryId: number, limitMinor?: number, currency?: Currency) {
  await ensureMonthPlan(ym);
  const db = await getDb();
  let amount = limitMinor ?? 0;
  let kind: PlanKind = 'limit';
  let norm: NormPeriod = 'day';
  // a new one in the app's currency (Настройки → Валюта), not the budget's
  let cur = currency ?? (await systemCurrency(db));
  if (limitMinor === undefined) {
    const last = await lastPlanItem(ym, categoryId);
    if (last) {
      kind = last.kind;
      norm = last.norm_period;
      cur = last.currency;
      if (!(await fits(ym, categoryId, last.limit_minor, last.currency))) amount = last.limit_minor;
    }
  }
  // the category's kind, when set, says what its item is
  const own = await categoryPlanKind(categoryId, db);
  if (own === 'limit') kind = 'limit';
  if (own === 'oneoff') kind = 'fixed';
  await db.transaction(async (t) => {
    await t.run(
      'INSERT OR IGNORE INTO plan_items (ym, category_id, limit_minor, kind, currency, norm_period) VALUES (?, ?, ?, ?, ?, ?)',
      [ym, categoryId, amount, kind, cur, norm],
    );
    await ownMonth(ym, t);
    await kindFromItem(ym, categoryId, t);
  });
}

/**
 * Sets (and adds, if missing) a plan item. `kind` is kept as is when omitted; `currency` too (a new item takes
 * the app's, Настройки → Валюта). Refused (OverBudgetError) if the month's plan would exceed its amount to distribute —
 * unless `takeLocked`: then what is short is taken from "🔒 Отложить сразу", if it has that much; 'all' — what it has,
 * the plan over its budget by the rest (an obligation: a regular payment).
 */
export async function setPlanAmount(
  ym: string,
  categoryId: number,
  limitMinor: number,
  kind?: PlanKind,
  currency?: Currency,
  normPeriod?: NormPeriod,
  takeLocked: boolean | 'all' = false,
) {
  // also adds the item (from the stats screen), so the month must exist with its carried-over items first
  await ensureMonthPlan(ym);
  limitMinor = Math.max(0, limitMinor);
  const db = await getDb();
  const existing = await db.get<{ currency: string }>(
    'SELECT currency FROM plan_items WHERE ym = ? AND category_id = ?',
    [ym, categoryId],
  );
  const cur = currency ?? (existing ? asCurrency(existing.currency) : await systemCurrency(db));
  const over = await fits(ym, categoryId, limitMinor, cur);
  const locked = over && takeLocked ? ((await storedBudget(ym))?.locked_minor ?? 0) : 0;
  const short = over
    ? takeLocked === 'all'
      ? Math.min(over.planned_minor - over.budget_minor, locked)
      : over.planned_minor - over.budget_minor
    : 0;
  if (over && (!takeLocked || (takeLocked !== 'all' && short > locked))) throw over;
  const before = await itemShape(ym, categoryId, db);
  // the checks above read the rates outside: the writes alone in the transaction
  await db.transaction(async (t) => {
    if (short > 0)
      await t.run(
        'UPDATE plan_months SET locked_minor = locked_minor - ?, locked_taken_minor = locked_taken_minor + ? WHERE ym = ?',
        [short, short, ym],
      );
    await t.run(
      `INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency, norm_period) VALUES (?, ?, ?, coalesce(?, 'limit'), ?, coalesce(?, 'day'))
        ON CONFLICT(ym, category_id) DO UPDATE SET limit_minor = excluded.limit_minor, kind = coalesce(?, kind), currency = excluded.currency,
          norm_period = coalesce(?, norm_period), every = NULL, weekdays = NULL, unit_minor = NULL`,
      [ym, categoryId, limitMinor, kind ?? null, cur, normPeriod ?? null, kind ?? null, normPeriod ?? null],
    );
    await ownMonth(ym, t);
    await kindFromItem(ym, categoryId, t);
    await followItem(ym, categoryId, before, t);
  });
}

/** Pinned items move to the next month together with their amount, till `until` ("Дата окончания"; null — always). */
export async function setPlanPinned(ym: string, categoryId: number, pinned: boolean, until: string | null = null) {
  const db = await getDb();
  await db.transaction(async (t) => {
    const before = await itemShape(ym, categoryId, t);
    await t.run('UPDATE plan_items SET pinned = ?, until = ? WHERE ym = ? AND category_id = ?', [
      pinned ? 1 : 0,
      pinned ? until : null,
      ym,
      categoryId,
    ]);
    await ownMonth(ym, t);
    await followItem(ym, categoryId, before, t);
  });
}

export async function removePlanItem(ym: string, categoryId: number): Promise<RemovedPlanItem | null> {
  const db = await getDb();
  return db.transaction(async (t) => {
    const row = await t.get<RemovedPlanItem>('SELECT * FROM plan_items WHERE ym = ? AND category_id = ?', [
      ym,
      categoryId,
    ]);
    const before = await itemShape(ym, categoryId, t);
    await t.run('DELETE FROM plan_items WHERE ym = ? AND category_id = ?', [ym, categoryId]);
    await ownMonth(ym, t);
    await followItem(ym, categoryId, before, t);
    return row ?? null;
  });
}

/** A plan item's whole row as it was removed: "Отменить" puts it back (amount, currency, 📌, how it is spent). */
export type RemovedPlanItem = Record<string, SqlParam>;

/** Puts a removed item back as it was (its month already has it again: left as it is). */
export async function restorePlanItem(row: RemovedPlanItem) {
  const cols = Object.keys(row);
  const db = await getDb();
  await db.run(
    `INSERT OR IGNORE INTO plan_items (${cols.join(', ')}) VALUES (${placeholders(cols.length)})`,
    cols.map((c) => row[c]),
  );
  // back in the months after it too, if it repeats
  await followItem(String(row.ym), Number(row.category_id), null, db);
}
