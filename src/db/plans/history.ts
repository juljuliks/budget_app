// Averages over full months, a category's monthly average, the plan against the spending by month.
import { getDb } from '../index';
import { Currency } from '../fx';
import { BUDGET_CURRENCY, currentYm, monthRange, parseYm, planRateDate, ymOf } from './months';
import { SpendRow, convertSpending, spendRows, sumBy } from './spend';

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
  const { items } = await convertSpending(await spendRows(from, to), currency);
  const total = items.reduce((sum, i) => sum + i.value, 0);
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
  const budgets = await db.all<{ ym: string; budget_minor: number; budget_currency: string }>(
    'SELECT ym, budget_minor, budget_currency FROM plan_months WHERE budget_minor IS NOT NULL');
  const planYms = [...new Set([...items.map((i) => i.ym), ...budgets.map((b) => b.ym)])];
  const { items: spent, conv } = await convertSpending(await spendRows(0, Number.MAX_SAFE_INTEGER), currency, planYms.map(planRateDate));
  const ymOfRow = (r: SpendRow) => { const d = new Date(r.occurred_at * 1000); return ymOf(d.getFullYear(), d.getMonth()); };
  const spentBy = sumBy(spent, ymOfRow);
  const plannedBy = new Map<string, number>();
  for (const i of items) plannedBy.set(i.ym, (plannedBy.get(i.ym) ?? 0) + (conv(i.limit_minor, i.currency, currency, planRateDate(i.ym)) ?? 0));
  const budgetBy = new Map(budgets.map((b) => [b.ym, conv(b.budget_minor, b.budget_currency, currency, planRateDate(b.ym))]));

  const out: HistoryMonth[] = [];
  let { year, month } = parseYm(nowYm);
  for (let ym = nowYm; ym >= first.ym; ym = ymOf(year, --month)) {
    out.push({ ym, planned_minor: plannedBy.get(ym) ?? 0, spent_minor: spentBy.get(ym) ?? 0, budget_minor: budgetBy.get(ym) ?? null });
  }
  return out;
}
