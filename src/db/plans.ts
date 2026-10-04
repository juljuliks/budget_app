import { getDb } from './index';
import { categoryColors } from './colors';
import { NEUTRAL_COLOR } from '../colors';
import { Converter, Currency, dateKey, ensureRates, isCurrency, makeConverter } from './fx';

/** The default currency: plans start in it, and stats show it until another is picked. */
export const BUDGET_CURRENCY: Currency = 'GEL';

/**
 * Kinds that count as spending; deposits are income and ignored. A refund is subtracted only when the user
 * put it into a category; otherwise it is settled on the purchase itself (reduced or deleted, see refunds.ts)
 * and must not count twice — or turn "Без категории" negative while waiting.
 */
const EXPENSE_KINDS = ['purchase', 'payment', 'withdrawal', 'transfer'];

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

export function currentYm(now = new Date()): string {
  return ymOf(now.getFullYear(), now.getMonth());
}

/** The day a month's plan amounts are converted on: its last day, or today for the current / a coming month. */
export function planRateDate(ym: string): string {
  const { year, month } = parseYm(ym);
  return dateKey(Math.min(monthRange(year, month)[1] - 1, Date.now() / 1000));
}

const asCurrency = (v: string | null | undefined): Currency => (isCurrency(v) ? v : BUDGET_CURRENCY);

// --- spending, converted to the currency stats are shown in ---

type SpendRow = { id: number; category_id: number | null; kind: string; amount_minor: number; currency: string; occurred_at: number };

/** A transaction's contribution to spending (see EXPENSE_KINDS), in its own currency. */
function spendOf(r: SpendRow): number {
  if (r.kind === 'refund') return r.category_id === null ? 0 : -r.amount_minor;
  return EXPENSE_KINDS.includes(r.kind) ? r.amount_minor : 0;
}

async function spendRows(from: number, to: number): Promise<SpendRow[]> {
  const db = await getDb();
  return db.all<SpendRow>(
    `SELECT id, category_id, kind, amount_minor, currency, occurred_at FROM transactions
      WHERE occurred_at >= ? AND occurred_at < ? AND kind IN (${[...EXPENSE_KINDS, 'refund'].map((k) => `'${k}'`).join(',')})`,
    [from, to]);
}

type Converted = {
  items: Array<{ row: SpendRow; value: number }>;
  /** spending that couldn't be converted (no rate known yet, offline), per currency */
  missing: Array<{ currency: string; spent_minor: number }>;
  conv: Converter;
};

/** Converts each row's spending on its day's rate (fetching rates not cached yet); `extraDates` are fetched too. */
async function convertSpending(rows: SpendRow[], to: Currency, extraDates: string[] = []): Promise<Converted> {
  await ensureRates([...rows.filter((r) => r.currency !== to).map((r) => dateKey(r.occurred_at)), ...extraDates]);
  const conv = await makeConverter();
  const items: Converted['items'] = [];
  const missing = new Map<string, number>();
  for (const r of rows) {
    const v = spendOf(r);
    if (v === 0) continue;
    const c = conv(v, r.currency, to, dateKey(r.occurred_at));
    if (c === null) missing.set(r.currency, (missing.get(r.currency) ?? 0) + v);
    else items.push({ row: r, value: c });
  }
  return { items, missing: [...missing].map(([currency, spent_minor]) => ({ currency, spent_minor })), conv };
}

// --- plan ---

/** 'limit' = spending cap (progress bar); 'fixed' = fixed payment like rent (paid / not paid). */
export type PlanKind = 'limit' | 'fixed';

/**
 * The rhythm a flexible item's norm is counted in for period stats: food every day, bars per week, clothes per
 * month. The norm of a window is the month's plan / days in the month × days of the window ('month' = the plan).
 */
export type NormPeriod = 'day' | 'week' | '2weeks' | 'month';
export const NORM_PERIODS: NormPeriod[] = ['day', 'week', '2weeks', 'month'];
const asNorm = (v: string | null | undefined): NormPeriod => (NORM_PERIODS.includes(v as NormPeriod) ? (v as NormPeriod) : 'day');

export type PlanItem = {
  category_id: number;
  name: string;
  emoji: string | null;
  type_id: number | null;
  type_name: string | null;
  /** 0 = amount not set yet this month; in `currency` */
  limit_minor: number;
  currency: Currency;
  /** limit_minor converted (to the currency asked for in listPlan); null without a rate */
  converted_minor: number | null;
  kind: PlanKind;
  norm_period: NormPeriod;
  pinned: boolean;
  /** amount of the same item in the month this plan was carried over from (placeholder hint) */
  previous_minor: number | null;
};

/** The month's amount to distribute and its currency. */
export type PlanBudget = { amount_minor: number; currency: Currency };

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
        `INSERT OR IGNORE INTO plan_items (ym, category_id, limit_minor, pinned, kind, currency, norm_period)
          SELECT ?, p.category_id, CASE WHEN p.pinned = 1 THEN p.limit_minor ELSE 0 END, p.pinned, p.kind, p.currency, p.norm_period
          FROM plan_items p JOIN categories c ON c.id = p.category_id
          WHERE p.ym = ? AND c.deleted_at IS NULL`,
        [ym, source.ym]);
    }
    // the amount to distribute (usually the salary) carries over as well, with its currency
    await db.run(
      `INSERT OR IGNORE INTO plan_months (ym, budget_minor, budget_currency) VALUES (?,
        (SELECT budget_minor FROM plan_months WHERE ym = ?),
        coalesce((SELECT budget_currency FROM plan_months WHERE ym = ?), ?))`,
      [ym, source?.ym ?? '', source?.ym ?? '', BUDGET_CURRENCY]);
  });
}

async function storedBudget(ym: string): Promise<PlanBudget | null> {
  const db = await getDb();
  const row = await db.get<{ budget_minor: number | null; budget_currency: string | null }>(
    'SELECT budget_minor, budget_currency FROM plan_months WHERE ym = ?', [ym]);
  return row?.budget_minor == null ? null : { amount_minor: row.budget_minor, currency: asCurrency(row.budget_currency) };
}

/** The month's amount to distribute; null = not set (no cap, no percentages). */
export async function getPlanBudget(ym: string): Promise<PlanBudget | null> {
  await ensureMonthPlan(ym);
  return storedBudget(ym);
}

/** The currency plan totals of the month are in: the amount to distribute's, else the default. */
async function planCurrency(ym: string): Promise<Currency> {
  const db = await getDb();
  return asCurrency((await db.get<{ c: string }>('SELECT budget_currency AS c FROM plan_months WHERE ym = ?', [ym]))?.c);
}

/** A converter on the month's plan date (its rate fetched if needed): plan amounts shown in another currency. */
export async function planConverter(ym: string): Promise<(minor: number, from: string, to: string) => number | null> {
  const date = planRateDate(ym);
  await ensureRates([date]);
  const conv = await makeConverter();
  return (minor, from, to) => conv(minor, from, to, date);
}

/** The month's plan items; `converted_minor` in `to` (default: the amount to distribute's currency). */
export async function listPlan(ym: string, to?: Currency): Promise<PlanItem[]> {
  await ensureMonthPlan(ym);
  const db = await getDb();
  const prev = await db.get<{ ym: string }>('SELECT ym FROM plan_months WHERE ym < ? ORDER BY ym DESC LIMIT 1', [ym]);
  const rows = await db.all<Omit<PlanItem, 'pinned' | 'converted_minor' | 'currency'> & { pinned: number; currency: string }>(
    `SELECT p.category_id, c.name, c.emoji, c.type_id, ct.name AS type_name, p.limit_minor, p.currency, p.kind, p.norm_period, p.pinned,
        (SELECT q.limit_minor FROM plan_items q WHERE q.ym = ? AND q.category_id = p.category_id) AS previous_minor
      FROM plan_items p
      JOIN categories c ON c.id = p.category_id
      LEFT JOIN category_types ct ON ct.id = c.type_id
      WHERE p.ym = ?
      ORDER BY ct.id IS NULL, ct.sort_order, ct.name, c.sort_order, c.name`,
    [prev?.ym ?? '', ym]);
  const target = to ?? (await planCurrency(ym));
  const conv = await planConverter(ym);
  return rows.map((r) => ({
    ...r,
    currency: asCurrency(r.currency),
    norm_period: asNorm(r.norm_period),
    converted_minor: conv(r.limit_minor, asCurrency(r.currency), target),
    pinned: r.pinned === 1,
    previous_minor: r.previous_minor || null,
  }));
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

/** Income (deposits, converted on their day) of the month in `currency`: a hint for the amount to distribute. */
export async function monthIncome(ym: string, currency: Currency = BUDGET_CURRENCY): Promise<number> {
  const { year, month } = parseYm(ym);
  const [from, to] = monthRange(year, month);
  const db = await getDb();
  const rows = await db.all<{ amount_minor: number; currency: string; occurred_at: number }>(
    "SELECT amount_minor, currency, occurred_at FROM transactions WHERE kind = 'deposit' AND occurred_at >= ? AND occurred_at < ?",
    [from, to]);
  await ensureRates(rows.filter((r) => r.currency !== currency).map((r) => dateKey(r.occurred_at)));
  const conv = await makeConverter();
  return rows.reduce((s, r) => s + (conv(r.amount_minor, r.currency, currency, dateKey(r.occurred_at)) ?? 0), 0);
}

/** Thrown when a change would plan more than the month's amount to distribute (amounts in `currency`). */
export class OverBudgetError extends Error {
  constructor(public budget_minor: number, public planned_minor: number, public currency: Currency = BUDGET_CURRENCY) {
    super('plan exceeds the amount to distribute');
  }
}

/** null clears the amount. Refused (OverBudgetError) if it is less than what is already planned (converted). */
export async function setPlanBudget(ym: string, budgetMinor: number | null, currency: Currency = BUDGET_CURRENCY) {
  await ensureMonthPlan(ym);
  if (budgetMinor !== null) {
    const planned = await plannedTotal(ym, undefined, currency);
    if (budgetMinor < planned) throw new OverBudgetError(budgetMinor, planned, currency);
  }
  const db = await getDb();
  await db.run('INSERT OR IGNORE INTO plan_months (ym) VALUES (?)', [ym]);
  await db.run('UPDATE plan_months SET budget_minor = ?, budget_currency = ? WHERE ym = ?', [budgetMinor, currency, ym]);
}

async function markPlanned(ym: string) {
  // editing a month (also a past one) makes it a planned month that later months carry over from
  const db = await getDb();
  await db.run('INSERT OR IGNORE INTO plan_months (ym) VALUES (?)', [ym]);
}

/** The category's amount, currency and kind in the latest earlier month that planned it with an amount. */
export async function lastPlanItem(ym: string, categoryId: number): Promise<{ limit_minor: number; currency: Currency; kind: PlanKind; norm_period: NormPeriod } | null> {
  const db = await getDb();
  const row = await db.get<{ limit_minor: number; currency: string; kind: PlanKind; norm_period: string }>(
    `SELECT limit_minor, currency, kind, norm_period FROM plan_items WHERE ym < ? AND category_id = ? AND limit_minor > 0
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
  return planned > budget.amount_minor ? new OverBudgetError(budget.amount_minor, planned, budget.currency) : null;
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
  await db.run('INSERT OR IGNORE INTO plan_items (ym, category_id, limit_minor, kind, currency, norm_period) VALUES (?, ?, ?, ?, ?, ?)',
    [ym, categoryId, amount, kind, cur, norm]);
  await markPlanned(ym);
}

/**
 * Sets (and adds, if missing) a plan item. `kind` is kept as is when omitted; `currency` too (a new item takes
 * the amount to distribute's). Refused (OverBudgetError) if the month's plan would exceed its amount to distribute.
 */
export async function setPlanAmount(ym: string, categoryId: number, limitMinor: number, kind?: PlanKind, currency?: Currency, normPeriod?: NormPeriod) {
  // also adds the item (from the stats screen), so the month must exist with its carried-over items first
  await ensureMonthPlan(ym);
  limitMinor = Math.max(0, limitMinor);
  const db = await getDb();
  const existing = await db.get<{ currency: string }>('SELECT currency FROM plan_items WHERE ym = ? AND category_id = ?', [ym, categoryId]);
  const cur = currency ?? (existing ? asCurrency(existing.currency) : await planCurrency(ym));
  const over = await fits(ym, categoryId, limitMinor, cur);
  if (over) throw over;
  await db.run(
    `INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency, norm_period) VALUES (?, ?, ?, coalesce(?, 'limit'), ?, coalesce(?, 'day'))
      ON CONFLICT(ym, category_id) DO UPDATE SET limit_minor = excluded.limit_minor, kind = coalesce(?, kind), currency = excluded.currency,
        norm_period = coalesce(?, norm_period)`,
    [ym, categoryId, limitMinor, kind ?? null, cur, normPeriod ?? null, kind ?? null, normPeriod ?? null]);
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

// --- stats ---

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
  /** a flexible plan item's norm rhythm for period stats; null without a plan */
  plan_norm: NormPeriod | null;
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
  /** every amount below is in this currency */
  currency: Currency;
  groups: StatGroup[];
  spent_minor: number;
  planned_minor: number;
  categories: CategoryStat[];
  /** spending that couldn't be converted yet (no rate known: offline), not in the totals */
  other_currencies: Array<{ currency: string; spent_minor: number }>;
};

function sumBy<K>(items: Converted['items'], key: (r: SpendRow) => K): Map<K, number> {
  const m = new Map<K, number>();
  for (const { row, value } of items) m.set(key(row), (m.get(key(row)) ?? 0) + value);
  return m;
}

/** The month's spending and plan by category, in `currency` (spending on each day's rate, the plan on planRateDate). */
export async function monthStats(year: number, month: number, currency: Currency = BUDGET_CURRENCY): Promise<MonthStats> {
  const ym = ymOf(year, month);
  await ensureMonthPlan(ym);
  const db = await getDb();
  const [from, to] = monthRange(year, month);
  const planDate = planRateDate(ym);
  const { items, missing, conv } = await convertSpending(await spendRows(from, to), currency, [planDate]);
  const spentBy = sumBy(items, (r) => r.category_id);

  const colorOf = await categoryColors();

  const cats = await db.all<{ id: number; name: string; emoji: string | null; type_id: number | null; type_name: string | null; limit_minor: number | null; plan_currency: string | null; plan_kind: PlanKind | null; plan_norm: string | null; deleted_at: number | null }>(
    `SELECT c.id, c.name, c.emoji, c.type_id, ct.name AS type_name, p.limit_minor, p.currency AS plan_currency, p.kind AS plan_kind,
        p.norm_period AS plan_norm, c.deleted_at
      FROM categories c
      LEFT JOIN category_types ct ON ct.id = c.type_id
      LEFT JOIN plan_items p ON p.category_id = c.id AND p.ym = ?`, [ym]);

  const categories: CategoryStat[] = [];
  for (const c of cats) {
    const s = spentBy.get(c.id) ?? 0;
    const limit = c.limit_minor ? conv(c.limit_minor, asCurrency(c.plan_currency), currency, planDate) : null;
    if (s === 0 && limit === null) continue;
    categories.push({
      category_id: c.id, name: c.name, emoji: c.emoji, type_id: c.type_id, type_name: c.type_name, spent_minor: s, limit_minor: limit,
      plan_kind: limit === null ? null : c.plan_kind,
      plan_norm: limit === null ? null : asNorm(c.plan_norm),
      color: colorOf.get(c.id) ?? NEUTRAL_COLOR, deleted: c.deleted_at !== null,
    });
  }
  const uncategorized = spentBy.get(null) ?? 0;
  if (uncategorized !== 0) {
    categories.push({
      category_id: null, name: 'Без категории', emoji: null, type_id: null, type_name: null,
      spent_minor: uncategorized, limit_minor: null, plan_kind: null, plan_norm: null, color: NEUTRAL_COLOR, deleted: false,
    });
  }
  categories.sort((a, b) => b.spent_minor - a.spent_minor || (b.limit_minor ?? 0) - (a.limit_minor ?? 0));

  const types = await db.all<{ id: number; name: string }>('SELECT id, name FROM category_types ORDER BY sort_order, name');

  return {
    ym,
    currency,
    groups: groupByType(categories, types),
    spent_minor: categories.reduce((sum, c) => sum + c.spent_minor, 0),
    planned_minor: categories.reduce((sum, c) => sum + (c.limit_minor ?? 0), 0),
    categories,
    other_currencies: missing,
  };
}

export type PeriodStats = {
  currency: Currency;
  groups: StatGroup[];
  spent_minor: number;
  categories: CategoryStat[];
  other_currencies: Array<{ currency: string; spent_minor: number }>;
};

/** Spending by category for any period [from, to) (unix seconds), e.g. one day, in `currency`; no plan. */
export async function periodStats(from: number, to: number, currency: Currency = BUDGET_CURRENCY): Promise<PeriodStats> {
  const db = await getDb();
  const { items, missing } = await convertSpending(await spendRows(from, to), currency);
  const spentBy = sumBy(items, (r) => r.category_id);
  const ids = [...spentBy.keys()].filter((id): id is number => id !== null);
  const cats = ids.length === 0 ? [] : await db.all<{ id: number; name: string; emoji: string | null; type_id: number | null; type_name: string | null; deleted_at: number | null }>(
    `SELECT c.id, c.name, c.emoji, c.type_id, ct.name AS type_name, c.deleted_at FROM categories c
      LEFT JOIN category_types ct ON ct.id = c.type_id WHERE c.id IN (${ids.map(() => '?').join(',')})`, ids);
  const colorOf = await categoryColors();
  const categories: CategoryStat[] = cats.map((c) => ({
    category_id: c.id, name: c.name, emoji: c.emoji, type_id: c.type_id, type_name: c.type_name, spent_minor: spentBy.get(c.id)!,
    limit_minor: null, plan_kind: null, plan_norm: null, color: colorOf.get(c.id) ?? NEUTRAL_COLOR, deleted: c.deleted_at !== null,
  }));
  const none = spentBy.get(null) ?? 0;
  if (none !== 0) {
    categories.push({
      category_id: null, name: 'Без категории', emoji: null, type_id: null, type_name: null, spent_minor: none,
      limit_minor: null, plan_kind: null, plan_norm: null, color: NEUTRAL_COLOR, deleted: false,
    });
  }
  const positive = categories.filter((c) => c.spent_minor > 0).sort((a, b) => b.spent_minor - a.spent_minor);
  const types = await db.all<{ id: number; name: string }>('SELECT id, name FROM category_types ORDER BY sort_order, name');
  return {
    currency, groups: groupByType(positive, types), categories: positive,
    spent_minor: positive.reduce((s, c) => s + c.spent_minor, 0), other_currencies: missing,
  };
}

/** Each transaction's contribution to spending in [from, to), converted to `currency`, for per-day totals. */
export async function spendingEntries(from: number, to: number, currency: Currency = BUDGET_CURRENCY): Promise<Array<{ occurred_at: number; spent_minor: number }>> {
  const { items } = await convertSpending(await spendRows(from, to), currency);
  return items.map(({ row, value }) => ({ occurred_at: row.occurred_at, spent_minor: value }));
}

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

export default {
  ymOf, parseYm, currentYm, monthRange, monthStart, lastPlanItem, ensureMonthPlan, listPlan, addPlanItem, setPlanAmount,
  setPlanPinned, removePlanItem, monthStats, planHistory, getPlanBudget, setPlanBudget, plannedTotal, monthIncome,
};
