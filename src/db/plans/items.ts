// The plan's items: listed, added, their amount, pinned, removed; within the budget.
import { getDb } from '../index';
import type { Db, SqlParam } from '../types';
import { placeholders } from '../sql';
import { Currency } from '../fx';
import { asCurrency } from './months';
import { NormPeriod, PlanItem, PlanKind, asNorm } from './types';
import { activeFunds, fundLedger } from './funds';
import { monthPayments } from './recurringItems';
import { OverBudgetError, ensureMonthPlan, planConverter, planCurrency, plannedTotal, storedBudget } from './budget';

/** The month's plan items; `converted_minor` in `to` (default: the amount to distribute's currency). */
export async function listPlan(ym: string, to?: Currency): Promise<PlanItem[]> {
  await ensureMonthPlan(ym);
  const db = await getDb();
  const prev = await db.get<{ ym: string }>('SELECT ym FROM plan_months WHERE ym < ? ORDER BY ym DESC LIMIT 1', [ym]);
  const rows = await db.all<Omit<PlanItem, 'pinned' | 'converted_minor' | 'currency'> & { pinned: number; currency: string }>(
    `SELECT p.category_id, c.name, c.emoji, c.system, c.recurring = 1 AS recurring, c.type_id, ct.name AS type_name, p.limit_minor, p.currency, p.kind, p.norm_period, p.pinned,
        (SELECT q.limit_minor FROM plan_items q WHERE q.ym = ? AND q.category_id = p.category_id) AS previous_minor
      FROM plan_items p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN category_types ct ON ct.id = c.type_id
      WHERE p.ym = ?
      ORDER BY ct.id IS NULL, ct.sort_order, ct.name, c.sort_order, c.name`,
    [prev?.ym ?? '', ym]);
  const target = to ?? (await planCurrency(ym));
  const conv = await planConverter(ym);
  const funds = await fundsOf(ym, rows.filter((r) => r.kind === 'fund').map((r) => r.category_id));
  // a category with repeating payments: their names, those saved up for, the contributions
  const subsInfo = new Map<number, NonNullable<PlanItem['subs']>>();
  for (const r of rows.filter((x) => x.recurring)) {
    const subs = await monthPayments(ym, target, undefined, r.category_id);
    const savingIds = new Set(subs.saving.map((v) => v.payment_id));
    const subNames = (keep: (id: number) => boolean) => [...subs.charges.map((c) => c.sub), ...subs.later.map((l) => l.sub)]
      .filter((s) => keep(s.id)).map((s) => s.name).filter((n, i, all) => all.indexOf(n) === i);
    const all = [...subs.charges.map((c) => c.sub), ...subs.later.map((l) => l.sub), ...subs.undated].filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i);
    const only = all.length === 1 ? all[0] : null;
    const charge = only ? subs.charges.find((c) => c.sub.id === only.id) : undefined;
    subsInfo.set(r.category_id, {
      names: subNames((id) => !savingIds.has(id)), saving_names: subNames((id) => savingIds.has(id)),
      saving_minor: subs.saving.reduce((a, v) => a + (v.converted_minor ?? 0), 0),
      ...(only ? { single: {
        period_months: only.period_months, done: !!charge?.done,
        day: charge?.day ?? subs.later.find((l) => l.sub.id === only.id)?.next ?? null,
      } } : {}),
    });
  }
  return rows.map((r) => ({
    ...r,
    currency: asCurrency(r.currency),
    norm_period: asNorm(r.norm_period),
    converted_minor: conv(r.limit_minor, asCurrency(r.currency), target),
    pinned: r.pinned === 1,
    previous_minor: r.previous_minor || null,
    ...(funds.has(r.category_id) ? { fund: funds.get(r.category_id) } : {}),
    recurring: !!r.recurring,
    ...(subsInfo.has(r.category_id) ? { subs: subsInfo.get(r.category_id) } : {}),
  }));
}

/** The funds among the month's items: how much by when, and what each has by the month's end. */
async function fundsOf(ym: string, ids: number[]): Promise<Map<number, NonNullable<PlanItem['fund']>>> {
  const out = new Map<number, NonNullable<PlanItem['fund']>>();
  for (const fund of await activeFunds(ym)) {
    if (!ids.includes(fund.category_id)) continue;
    const m = (await fundLedger(fund, ym)).months.find((x) => x.ym === ym);
    out.set(fund.category_id, { target_minor: fund.target_minor, due: fund.due, saved_minor: m?.end ?? fund.start_minor, start_minor: fund.start_minor });
  }
  return out;
}

async function markPlanned(ym: string, db: Db) {
  // editing a month (also a past one) makes it a planned month that later months carry over from
  await db.run('INSERT OR IGNORE INTO plan_months (ym) VALUES (?)', [ym]);
}

/** The category's amount, currency and kind in the latest earlier month that planned it with an amount. */
export async function lastPlanItem(ym: string, categoryId: number): Promise<{ ym: string; limit_minor: number; currency: Currency; kind: PlanKind; norm_period: NormPeriod } | null> {
  const db = await getDb();
  const row = await db.get<{ ym: string; limit_minor: number; currency: string; kind: PlanKind; norm_period: string }>(
    `SELECT ym, limit_minor, currency, kind, norm_period FROM plan_items WHERE ym < ? AND category_id = ? AND limit_minor > 0
      ORDER BY ym DESC LIMIT 1`, [ym, categoryId]);
  return row ? { ...row, currency: asCurrency(row.currency), norm_period: asNorm(row.norm_period) } : null;
}

/** Would `minor` in `currency` for this category still fit the month's amount to distribute? */
async function fits(ym: string, categoryId: number, minor: number, currency: Currency): Promise<OverBudgetError | null> {
  const budget = await storedBudget(ym);
  if (budget === null) return null;
  const conv = await planConverter(ym);
  const own = conv(minor, currency, budget.currency);
  if (own === null) return null; // no rate at all: can't check
  const planned = (await plannedTotal(ym, categoryId, budget.currency)) + own;
  // the unplanned share isn't for the plan
  return planned > budget.plannable_minor ? new OverBudgetError(budget.plannable_minor, planned, budget.currency) : null;
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
  let cur = currency ?? (await planCurrency(ym));
  if (limitMinor === undefined) {
    const last = await lastPlanItem(ym, categoryId);
    if (last) {
      kind = last.kind;
      norm = last.norm_period;
      cur = last.currency;
      if (!(await fits(ym, categoryId, last.limit_minor, last.currency))) amount = last.limit_minor;
    }
  }
  await db.transaction(async (t) => {
    await t.run('INSERT OR IGNORE INTO plan_items (ym, category_id, limit_minor, kind, currency, norm_period) VALUES (?, ?, ?, ?, ?, ?)',
      [ym, categoryId, amount, kind, cur, norm]);
    await markPlanned(ym, t);
  });
}

/**
 * Sets (and adds, if missing) a plan item. `kind` is kept as is when omitted; `currency` too (a new item takes
 * the amount to distribute's). Refused (OverBudgetError) if the month's plan would exceed its amount to distribute —
 * unless `takeLocked`: then what is short is taken from "🔒 Отложить сразу", if it has that much.
 */
export async function setPlanAmount(
  ym: string, categoryId: number, limitMinor: number, kind?: PlanKind, currency?: Currency, normPeriod?: NormPeriod, takeLocked = false,
) {
  // also adds the item (from the stats screen), so the month must exist with its carried-over items first
  await ensureMonthPlan(ym);
  limitMinor = Math.max(0, limitMinor);
  const db = await getDb();
  const existing = await db.get<{ currency: string }>('SELECT currency FROM plan_items WHERE ym = ? AND category_id = ?', [ym, categoryId]);
  const cur = currency ?? (existing ? asCurrency(existing.currency) : await planCurrency(ym));
  const over = await fits(ym, categoryId, limitMinor, cur);
  const short = over ? over.planned_minor - over.budget_minor : 0;
  if (over && (!takeLocked || short > ((await storedBudget(ym))?.locked_minor ?? 0))) throw over;
  // the checks above read the rates outside: the writes alone in the transaction
  await db.transaction(async (t) => {
    if (short > 0) await t.run('UPDATE plan_months SET locked_minor = locked_minor - ? WHERE ym = ?', [short, ym]);
    await t.run(
      `INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency, norm_period) VALUES (?, ?, ?, coalesce(?, 'limit'), ?, coalesce(?, 'day'))
        ON CONFLICT(ym, category_id) DO UPDATE SET limit_minor = excluded.limit_minor, kind = coalesce(?, kind), currency = excluded.currency,
          norm_period = coalesce(?, norm_period)`,
      [ym, categoryId, limitMinor, kind ?? null, cur, normPeriod ?? null, kind ?? null, normPeriod ?? null]);
    await markPlanned(ym, t);
  });
}

/** Pinned items move to the next month together with their amount. */
export async function setPlanPinned(ym: string, categoryId: number, pinned: boolean) {
  const db = await getDb();
  await db.run('UPDATE plan_items SET pinned = ? WHERE ym = ? AND category_id = ?', [pinned ? 1 : 0, ym, categoryId]);
}

export async function removePlanItem(ym: string, categoryId: number): Promise<RemovedPlanItem | null> {
  const db = await getDb();
  return db.transaction(async (t) => {
    const row = await t.get<RemovedPlanItem>('SELECT * FROM plan_items WHERE ym = ? AND category_id = ?', [ym, categoryId]);
    await t.run('DELETE FROM plan_items WHERE ym = ? AND category_id = ?', [ym, categoryId]);
    await markPlanned(ym, t);
    return row ?? null;
  });
}

/** A plan item's whole row as it was removed: "Отменить" puts it back (amount, currency, 📌, how it is spent). */
export type RemovedPlanItem = Record<string, SqlParam>;

/** Puts a removed item back as it was (its month already has it again: left as it is). */
export async function restorePlanItem(row: RemovedPlanItem) {
  const cols = Object.keys(row);
  const db = await getDb();
  await db.run(`INSERT OR IGNORE INTO plan_items (${cols.join(', ')}) VALUES (${placeholders(cols.length)})`, cols.map((c) => row[c]));
}
