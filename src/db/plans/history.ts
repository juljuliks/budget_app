// Averages over full months, a category's monthly average, the plan against the spending by month.
import { getDb } from '../index';
import { Currency } from '../fx';
import { BUDGET_CURRENCY, currentYm, monthRange, parseYm, planRateDate, ymOf } from './months';
import { convertSpending, spendByDay, spendRows } from './spend';
import { unplannedOf } from './budget';
import { monthStats, spentOf } from './stats';

/**
 * Average spending per month over the full months of [fromKey, toKey] ('YYYY-MM-DD') that have data: not the
 * current month (not over yet) and not the first one if tracking started after its 1st. null = no such month yet.
 */
export async function averageFullMonths(fromKey: string, toKey: string, currency: Currency = BUDGET_CURRENCY, now = new Date()):
  Promise<{ average_minor: number; months: number } | null> {
  const db = await getDb();
  const first = await db.get<{ at: number | null }>('SELECT min(occurred_at) AS at FROM transactions');
  if (first?.at == null) return null;
  const f = new Date(first.at * 1000);
  // the first full month with data
  let { year, month } = { year: f.getFullYear(), month: f.getMonth() + (f.getDate() > 1 ? 1 : 0) };
  const [fy, fm] = fromKey.split('-').map(Number);
  const startOfRange = fromKey.endsWith('-01') ? { year: fy, month: fm - 1 } : { year: fy, month: fm };
  if (ymOf(startOfRange.year, startOfRange.month) > ymOf(year, month)) ({ year, month } = startOfRange);
  const [ty, tm, td] = toKey.split('-').map(Number);
  // the last month fully inside the range, and before the current one
  const lastInRange = new Date(ty, tm - 1, td + 1).getDate() === 1 ? ymOf(ty, tm - 1) : ymOf(ty, tm - 2);
  const lastDone = ymOf(now.getFullYear(), now.getMonth() - 1);
  const last = lastInRange < lastDone ? lastInRange : lastDone;
  const first_ = ymOf(year, month);
  if (first_ > last) return null;
  const { year: ly, month: lm } = parseYm(last);
  const [from] = monthRange(year, month);
  const [, to] = monthRange(ly, lm);
  const { days } = await spendByDay(from, to, currency);
  const total = days.reduce((sum, d) => sum + d.value, 0);
  const months = (ly - year) * 12 + (lm - month) + 1;
  return { average_minor: Math.round(total / months), months };
}

/** How many full months a category's usual spending is averaged over (the latest ones). */
export const CATEGORY_AVERAGE_MONTHS = 3;

/**
 * A category's usual spending per month: the average of the latest full months before `ym` (and before the
 * current month), at most CATEGORY_AVERAGE_MONTHS, counted from the first full month of tracking. `from` / `to`
 * name the months averaged ('YYYY-MM'). null = no such month yet.
 */
export async function categoryMonthlyAverage(categoryId: number, ym: string, currency: Currency = BUDGET_CURRENCY, now = new Date()):
  Promise<{ average_minor: number; months: number; from: string; to: string } | null> {
  const db = await getDb();
  const first = await db.get<{ at: number | null }>('SELECT min(occurred_at) AS at FROM transactions');
  if (first?.at == null) return null;
  const f = new Date(first.at * 1000);
  // the first full month with data
  const firstFull = ymOf(f.getFullYear(), f.getMonth() + (f.getDate() > 1 ? 1 : 0));
  const before = ym < currentYm(now) ? ym : currentYm(now);
  const { year: by, month: bm } = parseYm(before);
  const last = ymOf(by, bm - 1);
  const { year: ly, month: lm } = parseYm(last);
  let start = ymOf(ly, lm - (CATEGORY_AVERAGE_MONTHS - 1));
  if (start < firstFull) start = firstFull;
  if (start > last) return null;
  const { year: sy, month: sm } = parseYm(start);
  const [fromSec] = monthRange(sy, sm);
  const [, toSec] = monthRange(ly, lm);
  const rows = (await spendRows(fromSec, toSec)).filter((r) => r.category_id === categoryId);
  const { items } = await convertSpending(rows, currency);
  const total = items.reduce((sum, i) => sum + i.value, 0);
  const months = (ly - sy) * 12 + (lm - sm) + 1;
  return { average_minor: Math.round(total / months), months, from: start, to: last };
}

export type HistoryMonth = {
  ym: string;
  planned_minor: number;
  spent_minor: number;
  /** amount to distribute; null = not set */
  budget_minor: number | null;
  /** locked for savings at the month's start (🔒 "Сразу"); 0 without */
  locked_minor: number;
  /** the share set aside for spending outside the plan */
  unplanned_minor: number;
  /** the leftover goes to savings (the budget's switch) */
  to_savings: boolean;
  /** the current month only: obligatory payments planned and not paid yet (not leftover, they're still to go) */
  unpaid_fixed_minor: number;
};

/** Every month from the first transaction / plan up to the current month, newest first, in `currency`. */
export async function planHistory(nowYm = currentYm(), currency: Currency = BUDGET_CURRENCY): Promise<HistoryMonth[]> {
  const db = await getDb();
  const first = await db.get<{ ym: string | null }>(
    `SELECT min(ym) AS ym FROM (
      SELECT strftime('%Y-%m', min(occurred_at), 'unixepoch', 'localtime') AS ym FROM transactions
      UNION ALL SELECT min(ym) FROM plan_months)`);
  if (!first?.ym) return [];

  const items = await db.all<{ ym: string; limit_minor: number; currency: string }>('SELECT ym, limit_minor, currency FROM plan_items');
  const budgets = await db.all<{
    ym: string; budget_minor: number; budget_currency: string; locked_minor: number; to_savings: number; unplanned_pct: number; unplanned_minor: number | null;
  }>('SELECT ym, budget_minor, budget_currency, locked_minor, to_savings, unplanned_pct, unplanned_minor FROM plan_months WHERE budget_minor IS NOT NULL');
  const planYms = [...new Set([...items.map((i) => i.ym), ...budgets.map((b) => b.ym)])];
  const { days, conv } = await spendByDay(0, Number.MAX_SAFE_INTEGER, currency, planYms.map(planRateDate));
  const spentBy = new Map<string, number>();
  for (const { day, value } of days) spentBy.set(day.slice(0, 7), (spentBy.get(day.slice(0, 7)) ?? 0) + value);
  const plannedBy = new Map<string, number>();
  for (const i of items) plannedBy.set(i.ym, (plannedBy.get(i.ym) ?? 0) + (conv(i.limit_minor, i.currency, currency, planRateDate(i.ym)) ?? 0));
  const budgetBy = new Map(budgets.map((b) => [b.ym, conv(b.budget_minor, b.budget_currency, currency, planRateDate(b.ym))]));
  const savingsBy = new Map(budgets.map((b) => {
    const toShown = (v: number) => conv(v, b.budget_currency, currency, planRateDate(b.ym)) ?? 0;
    const share = unplannedOf({ amount_minor: b.budget_minor, unplanned_pct: b.unplanned_pct, unplanned_minor: b.unplanned_minor });
    return [b.ym, { locked_minor: toShown(b.locked_minor), unplanned_minor: toShown(share), to_savings: b.to_savings === 1 }];
  }));
  // the current month: what the obligatory payments still need (each one's plan less what's paid of it)
  let unpaidFixed = 0;
  if (budgetBy.has(nowYm)) {
    const { year: ny, month: nm } = parseYm(nowYm);
    const stats = await monthStats(ny, nm, currency);
    unpaidFixed = stats.categories.filter((c) => c.plan_kind === 'fixed' && c.limit_minor)
      .reduce((a, c) => a + Math.max(0, c.limit_minor! - spentOf(c)), 0);
  }

  const out: HistoryMonth[] = [];
  let { year, month } = parseYm(nowYm);
  for (let ym = nowYm; ym >= first.ym; ym = ymOf(year, --month)) {
    out.push({
      ym, planned_minor: plannedBy.get(ym) ?? 0, spent_minor: spentBy.get(ym) ?? 0, budget_minor: budgetBy.get(ym) ?? null,
      locked_minor: 0, unplanned_minor: 0, to_savings: false, ...savingsBy.get(ym), unpaid_fixed_minor: ym === nowYm ? unpaidFixed : 0,
    });
  }
  return out;
}
