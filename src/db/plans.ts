import { getDb } from './index';
import { categoryColors } from './colors';
import { NEUTRAL_COLOR } from '../colors';

export const BUDGET_CURRENCY = 'GEL';

/**
 * Kinds that count as spending; deposits are income and ignored. A refund is subtracted only when the user
 * put it into a category; otherwise it is settled on the purchase itself (reduced or deleted, see refunds.ts)
 * and must not count twice — or turn "Без категории" negative while waiting.
 */
const EXPENSE_KINDS = ['purchase', 'payment', 'withdrawal', 'transfer'];
const SPEND_EXPR = `sum(CASE WHEN t.kind = 'refund' THEN CASE WHEN t.category_id IS NULL THEN 0 ELSE -t.amount_minor END
  WHEN t.kind IN (${EXPENSE_KINDS.map((k) => `'${k}'`).join(',')}) THEN t.amount_minor ELSE 0 END)`;

/** Month key "2026-10". month is 0-based like Date#getMonth. */
export function ymOf(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function parseYm(ym: string): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number);
  return { year: y, month: m - 1 };
}

/** [start, end) of a calendar month in unix seconds, local time. month is 0-based. */
export function monthRange(year: number, month: number): [number, number] {
  return [new Date(year, month, 1).getTime() / 1000, new Date(year, month + 1, 1).getTime() / 1000];
}

/** Start of the month `ym` in unix seconds (local time). */
export function monthStart(ym: string): number {
  const { year, month } = parseYm(ym);
  return monthRange(year, month)[0];
}

/** 'limit' = spending cap (progress bar); 'fixed' = fixed payment like rent (paid / not paid). */
export type PlanKind = 'limit' | 'fixed';

export type PlanItem = {
  category_id: number;
  name: string;
  emoji: string | null;
  type_id: number | null;
  type_name: string | null;
  /** 0 = amount not set yet this month */
  limit_minor: number;
  kind: PlanKind;
  pinned: boolean;
  /** amount of the same item in the month this plan was carried over from (placeholder hint) */
  previous_minor: number | null;
};

/**
 * Creates the month's plan on first access by carrying items over from the latest earlier
 * planned month: pinned items keep their amount, the others come with an empty amount to fill in.
 * Past months are never initialized automatically (history must not change by looking at it).
 */
export async function ensureMonthPlan(ym: string, nowYm = currentYm()): Promise<void> {
  if (ym < nowYm) return;
  const db = await getDb();
  if (await db.get('SELECT 1 FROM plan_months WHERE ym = ?', [ym])) return;
  await db.transaction(async () => {
    const source = await db.get<{ ym: string }>('SELECT ym FROM plan_months WHERE ym < ? ORDER BY ym DESC LIMIT 1', [ym]);
    if (source) {
      await db.run(
        `INSERT OR IGNORE INTO plan_items (ym, category_id, limit_minor, pinned, kind)
          SELECT ?, p.category_id, CASE WHEN p.pinned = 1 THEN p.limit_minor ELSE 0 END, p.pinned, p.kind
          FROM plan_items p JOIN categories c ON c.id = p.category_id
          WHERE p.ym = ? AND c.deleted_at IS NULL`,
        [ym, source.ym]);
    }
    // the amount to distribute (usually the salary) carries over as well
    await db.run(
      'INSERT OR IGNORE INTO plan_months (ym, budget_minor) VALUES (?, (SELECT budget_minor FROM plan_months WHERE ym = ?))',
      [ym, source?.ym ?? '']);
  });
}

export function currentYm(now = new Date()): string {
  return ymOf(now.getFullYear(), now.getMonth());
}

export async function listPlan(ym: string): Promise<PlanItem[]> {
  await ensureMonthPlan(ym);
  const db = await getDb();
  const prev = await db.get<{ ym: string }>('SELECT ym FROM plan_months WHERE ym < ? ORDER BY ym DESC LIMIT 1', [ym]);
  const rows = await db.all<Omit<PlanItem, 'pinned'> & { pinned: number }>(
    `SELECT p.category_id, c.name, c.emoji, c.type_id, ct.name AS type_name, p.limit_minor, p.kind, p.pinned,
        (SELECT q.limit_minor FROM plan_items q WHERE q.ym = ? AND q.category_id = p.category_id) AS previous_minor
      FROM plan_items p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN category_types ct ON ct.id = c.type_id
      WHERE p.ym = ?
      ORDER BY ct.id IS NULL, ct.sort_order, ct.name, c.sort_order, c.name`,
    [prev?.ym ?? '', ym]);
  return rows.map((r) => ({ ...r, pinned: r.pinned === 1, previous_minor: r.previous_minor || null }));
}

/** The month's amount to distribute; null = not set (no cap, no percentages). */
export async function getPlanBudget(ym: string): Promise<number | null> {
  await ensureMonthPlan(ym);
  return storedBudget(ym);
}

async function storedBudget(ym: string): Promise<number | null> {
  const db = await getDb();
  const row = await db.get<{ budget_minor: number | null }>('SELECT budget_minor FROM plan_months WHERE ym = ?', [ym]);
  return row?.budget_minor ?? null;
}

/** Sum of the month's plan items, optionally without one category (the one being changed). */
export async function plannedTotal(ym: string, exceptCategoryId?: number): Promise<number> {
  const db = await getDb();
  const row = await db.get<{ s: number | null }>(
    'SELECT sum(limit_minor) AS s FROM plan_items WHERE ym = ? AND category_id IS NOT ?', [ym, exceptCategoryId ?? null]);
  return row?.s ?? 0;
}

/** Income (deposits in the budget currency) of the month: a hint for the amount to distribute. */
export async function monthIncome(ym: string): Promise<number> {
  const { year, month } = parseYm(ym);
  const [from, to] = monthRange(year, month);
  const db = await getDb();
  const row = await db.get<{ s: number | null }>(
    "SELECT sum(amount_minor) AS s FROM transactions WHERE kind = 'deposit' AND currency = ? AND occurred_at >= ? AND occurred_at < ?",
    [BUDGET_CURRENCY, from, to]);
  return row?.s ?? 0;
}

/** Thrown when a change would plan more than the month's amount to distribute. */
export class OverBudgetError extends Error {
  constructor(public budget_minor: number, public planned_minor: number) {
    super('plan exceeds the amount to distribute');
  }
}

/** null clears the amount. Refused (OverBudgetError) if it is less than what is already planned. */
export async function setPlanBudget(ym: string, budgetMinor: number | null) {
  await ensureMonthPlan(ym);
  const planned = await plannedTotal(ym);
  if (budgetMinor !== null && budgetMinor < planned) throw new OverBudgetError(budgetMinor, planned);
  const db = await getDb();
  await db.run('INSERT OR IGNORE INTO plan_months (ym) VALUES (?)', [ym]);
  await db.run('UPDATE plan_months SET budget_minor = ? WHERE ym = ?', [budgetMinor, ym]);
}

async function markPlanned(ym: string) {
  // editing a month (also a past one) makes it a planned month that later months carry over from
  const db = await getDb();
  await db.run('INSERT OR IGNORE INTO plan_months (ym) VALUES (?)', [ym]);
}

/** The category's amount and kind in the latest earlier month that planned it with an amount. */
export async function lastPlanItem(ym: string, categoryId: number): Promise<{ limit_minor: number; kind: PlanKind } | null> {
  const db = await getDb();
  return (await db.get<{ limit_minor: number; kind: PlanKind }>(
    `SELECT limit_minor, kind FROM plan_items WHERE ym < ? AND category_id = ? AND limit_minor > 0
      ORDER BY ym DESC LIMIT 1`, [ym, categoryId])) ?? null;
}

/**
 * Adds a category to the month's plan. Without an amount it takes the category's amount (and kind) from the
 * last month that planned it — unless that no longer fits the amount to distribute, then it starts empty.
 */
export async function addPlanItem(ym: string, categoryId: number, limitMinor?: number) {
  await ensureMonthPlan(ym);
  const db = await getDb();
  let amount = limitMinor ?? 0;
  let kind: PlanKind = 'limit';
  if (limitMinor === undefined) {
    const last = await lastPlanItem(ym, categoryId);
    const budget = await storedBudget(ym);
    if (last && (budget === null || (await plannedTotal(ym)) + last.limit_minor <= budget)) {
      amount = last.limit_minor;
      kind = last.kind;
    } else if (last) {
      kind = last.kind;
    }
  }
  await db.run('INSERT OR IGNORE INTO plan_items (ym, category_id, limit_minor, kind) VALUES (?, ?, ?, ?)', [ym, categoryId, amount, kind]);
  await markPlanned(ym);
}

/**
 * Sets (and adds, if missing) a plan item. `kind` is kept as is when omitted.
 * Refused (OverBudgetError) if the month's plan would exceed its amount to distribute.
 */
export async function setPlanAmount(ym: string, categoryId: number, limitMinor: number, kind?: PlanKind) {
  // also adds the item (from the stats screen), so the month must exist with its carried-over items first
  await ensureMonthPlan(ym);
  limitMinor = Math.max(0, limitMinor);
  const budget = await storedBudget(ym);
  if (budget !== null) {
    const planned = (await plannedTotal(ym, categoryId)) + limitMinor;
    if (planned > budget) throw new OverBudgetError(budget, planned);
  }
  const db = await getDb();
  await db.run(
    `INSERT INTO plan_items (ym, category_id, limit_minor, kind) VALUES (?, ?, ?, coalesce(?, 'limit'))
      ON CONFLICT(ym, category_id) DO UPDATE SET limit_minor = excluded.limit_minor, kind = coalesce(?, kind)`,
    [ym, categoryId, limitMinor, kind ?? null, kind ?? null]);
  await markPlanned(ym);
}

/** Pinned items move to the next month together with their amount. */
export async function setPlanPinned(ym: string, categoryId: number, pinned: boolean) {
  const db = await getDb();
  await db.run('UPDATE plan_items SET pinned = ? WHERE ym = ? AND category_id = ?', [pinned ? 1 : 0, ym, categoryId]);
}

export async function removePlanItem(ym: string, categoryId: number) {
  const db = await getDb();
  await db.run('DELETE FROM plan_items WHERE ym = ? AND category_id = ?', [ym, categoryId]);
  await markPlanned(ym);
}

export type CategoryStat = {
  category_id: number | null; // null = uncategorized
  name: string;
  emoji: string | null;
  type_id: number | null;
  type_name: string | null;
  spent_minor: number;
  /** null = no plan (or amount not set) for this category this month */
  limit_minor: number | null;
  /** how the plan amount is shown: a progress bar (limit) or paid / not paid (fixed); null without a plan */
  plan_kind: PlanKind | null;
  /** chart color: the type's palette shade or the category's own (src/colors.ts) */
  color: string;
  /** deleted category that still has spending in this month: can't be added to a plan */
  deleted: boolean;
};

export type StatGroup = {
  /** null: categories without a type, then "Без категории" */
  type_id: number | null;
  title: string;
  spent_minor: number;
  planned_minor: number;
  categories: CategoryStat[];
};

/** Sections for the stats list: types in their order, untyped categories last, uncategorized at the very end. */
export function groupByType(categories: CategoryStat[], types: Array<{ id: number; name: string }>): StatGroup[] {
  const groups: StatGroup[] = [];
  const add = (type_id: number | null, title: string, cats: CategoryStat[]) => {
    if (cats.length === 0) return;
    groups.push({
      type_id, title, categories: cats,
      spent_minor: cats.reduce((s, c) => s + c.spent_minor, 0),
      planned_minor: cats.reduce((s, c) => s + (c.limit_minor ?? 0), 0),
    });
  };
  for (const t of types) add(t.id, t.name, categories.filter((c) => c.type_id === t.id));
  add(null, 'Без типа', categories.filter((c) => c.type_id === null && c.category_id !== null));
  add(null, 'Без категории', categories.filter((c) => c.category_id === null));
  return groups;
}

export type MonthStats = {
  ym: string;
  groups: StatGroup[];
  spent_minor: number;
  planned_minor: number;
  categories: CategoryStat[];
  /** spending in other currencies, not included in the totals (no offline FX rates) */
  other_currencies: Array<{ currency: string; spent_minor: number }>;
};

export async function monthStats(year: number, month: number): Promise<MonthStats> {
  const ym = ymOf(year, month);
  await ensureMonthPlan(ym);
  const db = await getDb();
  const [from, to] = monthRange(year, month);

  const spent = await db.all<{ category_id: number | null; spent_minor: number }>(
    `SELECT t.category_id, ${SPEND_EXPR} AS spent_minor
      FROM transactions t
      WHERE t.occurred_at >= ? AND t.occurred_at < ? AND t.currency = ?
      GROUP BY t.category_id`, [from, to, BUDGET_CURRENCY]);
  const spentBy = new Map(spent.map((s) => [s.category_id, s.spent_minor]));

  const colorOf = await categoryColors();

  const cats = await db.all<{ id: number; name: string; emoji: string | null; type_id: number | null; type_name: string | null; limit_minor: number | null; plan_kind: PlanKind | null; deleted_at: number | null }>(
    `SELECT c.id, c.name, c.emoji, c.type_id, ct.name AS type_name, p.limit_minor, p.kind AS plan_kind, c.deleted_at
      FROM categories c
      LEFT JOIN category_types ct ON ct.id = c.type_id
      LEFT JOIN plan_items p ON p.category_id = c.id AND p.ym = ?`, [ym]);

  const categories: CategoryStat[] = [];
  for (const c of cats) {
    const s = spentBy.get(c.id) ?? 0;
    const limit = c.limit_minor ? c.limit_minor : null;
    if (s === 0 && limit === null) continue;
    categories.push({
      category_id: c.id, name: c.name, emoji: c.emoji, type_id: c.type_id, type_name: c.type_name, spent_minor: s, limit_minor: limit,
      plan_kind: limit === null ? null : c.plan_kind,
      color: colorOf.get(c.id) ?? NEUTRAL_COLOR, deleted: c.deleted_at !== null,
    });
  }
  const uncategorized = spentBy.get(null) ?? 0;
  if (uncategorized !== 0) {
    categories.push({
      category_id: null, name: 'Без категории', emoji: null, type_id: null, type_name: null,
      spent_minor: uncategorized, limit_minor: null, plan_kind: null, color: NEUTRAL_COLOR, deleted: false,
    });
  }
  categories.sort((a, b) => b.spent_minor - a.spent_minor || (b.limit_minor ?? 0) - (a.limit_minor ?? 0));

  const other = await db.all<{ currency: string; spent_minor: number }>(
    `SELECT t.currency, ${SPEND_EXPR} AS spent_minor FROM transactions t
      WHERE t.occurred_at >= ? AND t.occurred_at < ? AND t.currency != ?
      GROUP BY t.currency HAVING spent_minor != 0`, [from, to, BUDGET_CURRENCY]);

  const types = await db.all<{ id: number; name: string }>('SELECT id, name FROM category_types ORDER BY sort_order, name');

  return {
    ym,
    groups: groupByType(categories, types),
    spent_minor: categories.reduce((sum, c) => sum + c.spent_minor, 0),
    planned_minor: categories.reduce((sum, c) => sum + (c.limit_minor ?? 0), 0),
    categories,
    other_currencies: other,
  };
}

export type PeriodStats = {
  groups: StatGroup[];
  spent_minor: number;
  categories: CategoryStat[];
};

/** Spending by category for any period [from, to) (unix seconds), e.g. one day; no plan. Like monthStats. */
export async function periodStats(from: number, to: number): Promise<PeriodStats> {
  const db = await getDb();
  const rows = await db.all<{ category_id: number | null; name: string | null; emoji: string | null; type_id: number | null; type_name: string | null; deleted_at: number | null; spent_minor: number }>(
    `SELECT t.category_id, c.name, c.emoji, c.type_id, ct.name AS type_name, c.deleted_at, ${SPEND_EXPR} AS spent_minor
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN category_types ct ON ct.id = c.type_id
      WHERE t.occurred_at >= ? AND t.occurred_at < ? AND t.currency = ?
      GROUP BY t.category_id HAVING spent_minor > 0`, [from, to, BUDGET_CURRENCY]);
  const colorOf = await categoryColors();
  const categories: CategoryStat[] = rows.map((r) => ({
    category_id: r.category_id,
    name: r.category_id === null ? 'Без категории' : r.name ?? '?',
    emoji: r.emoji, type_id: r.type_id, type_name: r.type_name, spent_minor: r.spent_minor,
    limit_minor: null, plan_kind: null,
    color: r.category_id === null ? NEUTRAL_COLOR : colorOf.get(r.category_id) ?? NEUTRAL_COLOR,
    deleted: r.deleted_at !== null,
  })).sort((a, b) => b.spent_minor - a.spent_minor);
  const types = await db.all<{ id: number; name: string }>('SELECT id, name FROM category_types ORDER BY sort_order, name');
  return { groups: groupByType(categories, types), spent_minor: categories.reduce((s, c) => s + c.spent_minor, 0), categories };
}

/**
 * Each transaction's contribution to spending in [from, to) (same rule as the stats; budget currency only),
 * for per-day totals in the transactions list.
 */
export async function spendingEntries(from: number, to: number): Promise<Array<{ occurred_at: number; spent_minor: number }>> {
  const db = await getDb();
  return db.all(
    `SELECT t.occurred_at, ${SPEND_EXPR} AS spent_minor FROM transactions t
      WHERE t.occurred_at >= ? AND t.occurred_at < ? AND t.currency = ?
      GROUP BY t.id HAVING spent_minor != 0`, [from, to, BUDGET_CURRENCY]);
}

export type HistoryMonth = {
  ym: string;
  planned_minor: number;
  spent_minor: number;
  /** amount to distribute; null = not set */
  budget_minor: number | null;
};

/** Every month from the first transaction / plan up to the current month, newest first. */
export async function planHistory(nowYm = currentYm()): Promise<HistoryMonth[]> {
  const db = await getDb();
  const first = await db.get<{ ym: string | null }>(
    `SELECT min(ym) AS ym FROM (
      SELECT strftime('%Y-%m', min(occurred_at), 'unixepoch', 'localtime') AS ym FROM transactions
      UNION ALL SELECT min(ym) FROM plan_months)`);
  if (!first?.ym) return [];

  const spent = await db.all<{ ym: string; spent_minor: number }>(
    `SELECT strftime('%Y-%m', t.occurred_at, 'unixepoch', 'localtime') AS ym, ${SPEND_EXPR} AS spent_minor
      FROM transactions t WHERE t.currency = ? GROUP BY ym`, [BUDGET_CURRENCY]);
  const planned = await db.all<{ ym: string; planned_minor: number }>(
    'SELECT ym, sum(limit_minor) AS planned_minor FROM plan_items GROUP BY ym');
  const budgets = await db.all<{ ym: string; budget_minor: number }>(
    'SELECT ym, budget_minor FROM plan_months WHERE budget_minor IS NOT NULL');
  const spentBy = new Map(spent.map((r) => [r.ym, r.spent_minor]));
  const plannedBy = new Map(planned.map((r) => [r.ym, r.planned_minor]));
  const budgetBy = new Map(budgets.map((r) => [r.ym, r.budget_minor]));

  const out: HistoryMonth[] = [];
  let { year, month } = parseYm(nowYm);
  for (let ym = nowYm; ym >= first.ym; ym = ymOf(year, --month)) {
    out.push({ ym, planned_minor: plannedBy.get(ym) ?? 0, spent_minor: spentBy.get(ym) ?? 0, budget_minor: budgetBy.get(ym) ?? null });
  }
  return out;
}

export default {
  ymOf, parseYm, currentYm, monthRange, monthStart, lastPlanItem, ensureMonthPlan, listPlan, addPlanItem, setPlanAmount,
  setPlanPinned, removePlanItem, monthStats, planHistory, getPlanBudget, setPlanBudget, plannedTotal, monthIncome,
};
