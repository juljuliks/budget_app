// What the norms are counted from, read once: the months' plan items and the spending by day and category.
import type { Every } from './regularTimes';
import { getDb } from '../index';
import { Currency, dateKey } from '../fx';
import { asCurrency, currentYm, monthStart, parseYm, monthRange, planRateDate } from './months';
import { REFUND_KEY, categoryKey, convertSpending, spendRows } from './spend';
import { NormPeriod, PlanKind, asNorm } from './types';
import { ensureMonthPlan } from './budget';
import { placeholders } from '../sql';

/** `regular`: a regular payment within the month — its norm is its days in the days looked at × each time's amount (converted) */
export type NormPlanItem = {
  name: string; limit: number; kind: PlanKind; rhythm: NormPeriod;
  regular?: { every: Every; weekdays: number; unit: number; until: string | null };
};

export type NormsData = {
  /** each month's items with an amount (converted on its plan date), in the month stats' order; a month not started yet: none */
  plans: Map<string, Map<number, NormPlanItem>>;
  /** the spending of these months by day ('YYYY-MM-DD') and category (null: without one), converted; refunds without a category left out */
  byDay: Map<string, Map<number | null, number>>;
  /** the transfer section's categories: a period where more came than went keeps its negative sum */
  transfer: Set<number>;
};

/**
 * The months' plans and spending, `months` in order ('YYYY-MM', contiguous). A month that hasn't started isn't read
 * (that would create its plan). Each month's items are ordered as monthStats lists them: most spent first.
 */
export async function normsData(months: string[], currency: Currency, nowYm = currentYm()): Promise<NormsData> {
  const db = await getDb();
  const read = months.filter((m) => m <= nowYm);
  if (read.includes(nowYm)) await ensureMonthPlan(nowYm);
  const last = parseYm(months[months.length - 1]);
  const rows = await spendRows(monthStart(months[0]), monthRange(last.year, last.month)[1]);
  const { items, conv } = await convertSpending(rows, currency, read.map(planRateDate));

  const byDay: NormsData['byDay'] = new Map();
  const monthSpent = new Map<string, number>();
  for (const { row, value } of items) {
    const key = categoryKey(row);
    const day = dateKey(row.occurred_at);
    if (typeof key === 'number') monthSpent.set(`${day.slice(0, 7)}|${key}`, (monthSpent.get(`${day.slice(0, 7)}|${key}`) ?? 0) + value);
    if (key === REFUND_KEY) continue;
    if (!byDay.has(day)) byDay.set(day, new Map());
    const m = byDay.get(day)!;
    m.set(key, (m.get(key) ?? 0) + value);
  }

  const planRows = read.length === 0 ? [] : await db.all<{ ym: string; category_id: number; name: string; emoji: string | null; limit_minor: number; currency: string; kind: PlanKind | null; norm_period: string | null; every: Every | null; weekdays: number | null; unit_minor: number | null; until: string | null }>(
    `SELECT p.ym, p.category_id, c.name, c.emoji, p.limit_minor, p.currency,
      -- a regular payment within the month: a limit of its rhythm (every day — the amount each day; every week — the
      -- month's by its days), not a one-off payment of the whole month
      CASE WHEN p.kind = 'subs' THEN 'fixed' WHEN p.kind = 'fixed' AND p.every IS NOT NULL THEN 'limit' ELSE p.kind END AS kind,
      CASE WHEN p.kind = 'fixed' AND p.every IS NOT NULL THEN p.every ELSE p.norm_period END AS norm_period,
      CASE WHEN p.kind = 'fixed' THEN p.every END AS every, p.weekdays, p.unit_minor, p.until
      FROM plan_items p JOIN categories c ON c.id = p.category_id
      WHERE p.ym IN (${placeholders(read.length)}) ORDER BY c.id`, read);
  const plans: NormsData['plans'] = new Map(months.map((m) => [m, new Map()]));
  for (const m of read) {
    const own = planRows.filter((r) => r.ym === m)
      .map((r) => ({ r, limit: r.limit_minor ? conv(r.limit_minor, asCurrency(r.currency), currency, planRateDate(m)) : null }))
      .filter((x): x is { r: typeof x.r; limit: number } => !!x.limit);
    const spent = (id: number) => monthSpent.get(`${m}|${id}`) ?? 0;
    own.sort((a, b) => spent(b.r.category_id) - spent(a.r.category_id) || b.limit - a.limit);
    for (const { r, limit } of own) {
      const unit = r.every && r.unit_minor ? conv(r.unit_minor, asCurrency(r.currency), currency, planRateDate(m)) : null;
      plans.get(m)!.set(r.category_id, {
        name: `${r.emoji || ''} ${r.name}`.trim(), limit, kind: r.kind ?? 'limit', rhythm: asNorm(r.norm_period),
        ...(r.every && unit !== null ? { regular: { every: r.every, weekdays: r.every === 'day' ? 127 : r.weekdays ?? 0, unit, until: r.until } } : {}),
      });
    }
  }

  const transfer = new Set((await db.all<{ id: number }>(
    'SELECT c.id FROM categories c JOIN category_types ct ON ct.id = c.type_id WHERE ct.is_transfer = 1')).map((c) => c.id));
  return { plans, byDay, transfer };
}
