// A month's or a period's spending by category and section, against the plan.
import { getDb } from '../index';
import { categoryColors } from '../colors';
import { NEUTRAL_COLOR, NO_CATEGORY_EMOJI } from '../../colors';
import { Currency } from '../fx';
import { BUDGET_CURRENCY, asCurrency, monthRange, planRateDate, ymOf } from './months';
import { REFUND_KEY, categoryKey, convertSpending, spendRows, sumBy } from './spend';
import { NormPeriod, PlanKind, asNorm } from './types';
import { ensureMonthPlan } from './budget';
import { placeholders } from '../sql';

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
  /**
   * a category of the transfer section: what was sent minus what came back, so spent_minor < 0 = more came than went
   * (shown "+", counted as nothing spent: it goes to the month's income, see monthIncome)
   */
  transfer: boolean;
};

/** What a category adds to the spending totals: a transfer one that brought in more than went out adds nothing. */
export const spentOf = (c: Pick<CategoryStat, 'spent_minor' | 'transfer'>) => (c.transfer ? Math.max(0, c.spent_minor) : c.spent_minor);

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
      spent_minor: cats.reduce((s, c) => s + spentOf(c), 0),
      planned_minor: cats.reduce((s, c) => s + (c.limit_minor ?? 0), 0),
    });
  };
  for (const t of types) add(t.id, t.name, categories.filter((c) => c.type_id === t.id));
  add(null, 'Без раздела', categories.filter((c) => c.type_id === null && c.category_id !== null));
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
  /** refunds without a category (no merchant category known): subtracted from spent_minor, ≥ 0 */
  refunds_unassigned_minor: number;
  /** spending that couldn't be converted yet (no rate known: offline), not in the totals */
  other_currencies: Array<{ currency: string; spent_minor: number }>;
};

/** Spending outside the plan: categories without a plan amount, and spending without a category (transfers too). */
export function unplannedSpent(stats: MonthStats): number {
  return stats.categories.filter((c) => c.limit_minor === null).reduce((a, c) => a + Math.max(0, c.spent_minor), 0);
}

type CategoryRow = { id: number; name: string; emoji: string | null; type_id: number | null; type_name: string | null; deleted_at: number | null; is_transfer: number | null };

/** A category's row of stats; `plan` (its amount in the stats' currency, kind, rhythm) when it is in the month's plan. */
function categoryStat(c: CategoryRow, spent: number, colorOf: Map<number, string>, plan?: { limit: number; kind: PlanKind | null; norm: string | null }): CategoryStat {
  return {
    category_id: c.id, name: c.name, emoji: c.emoji, type_id: c.type_id, type_name: c.type_name, spent_minor: spent,
    limit_minor: plan ? plan.limit : null, plan_kind: plan ? plan.kind : null, plan_norm: plan ? asNorm(plan.norm) : null,
    color: colorOf.get(c.id) ?? NEUTRAL_COLOR, deleted: c.deleted_at !== null, transfer: c.is_transfer === 1,
  };
}

/** The spending without a category, as a row of its own. */
const uncategorizedStat = (spent: number): CategoryStat => ({
  category_id: null, name: 'Без категории', emoji: NO_CATEGORY_EMOJI, type_id: null, type_name: null,
  spent_minor: spent, limit_minor: null, plan_kind: null, plan_norm: null, color: NEUTRAL_COLOR, deleted: false, transfer: false,
});

/** Refunds without a category: subtracted from the total, shown apart ("Возвраты без категории"). */
const refundsUnassignedOf = (spentBy: Map<number | null | typeof REFUND_KEY, number>) => Math.max(0, -(spentBy.get(REFUND_KEY) ?? 0));

const listTypes = async () => (await getDb()).all<{ id: number; name: string }>('SELECT id, name FROM category_types ORDER BY sort_order, name');

/** The month's spending and plan by category, in `currency` (spending on each day's rate, the plan on planRateDate). */
export async function monthStats(year: number, month: number, currency: Currency = BUDGET_CURRENCY): Promise<MonthStats> {
  const ym = ymOf(year, month);
  await ensureMonthPlan(ym);
  const db = await getDb();
  const [from, to] = monthRange(year, month);
  const planDate = planRateDate(ym);
  const { items, missing, conv } = await convertSpending(await spendRows(from, to), currency, [planDate]);
  const spentBy = sumBy(items, categoryKey);
  const refundsUnassigned = refundsUnassignedOf(spentBy);

  const colorOf = await categoryColors();

  const cats = await db.all<CategoryRow & { limit_minor: number | null; plan_currency: string | null; plan_kind: PlanKind | null; plan_norm: string | null }>(
    `SELECT c.id, c.name, c.emoji, c.type_id, ct.name AS type_name, p.limit_minor, p.currency AS plan_currency, p.kind AS plan_kind,
        p.norm_period AS plan_norm, c.deleted_at, ct.is_transfer
      FROM categories c
      LEFT JOIN category_types ct ON ct.id = c.type_id
      LEFT JOIN plan_items p ON p.category_id = c.id AND p.ym = ?`, [ym]);

  const categories: CategoryStat[] = [];
  for (const c of cats) {
    const s = spentBy.get(c.id) ?? 0;
    const limit = c.limit_minor ? conv(c.limit_minor, asCurrency(c.plan_currency), currency, planDate) : null;
    if (s === 0 && limit === null) continue;
    categories.push(categoryStat(c, s, colorOf, limit === null ? undefined : { limit, kind: c.plan_kind, norm: c.plan_norm }));
  }
  const uncategorized = spentBy.get(null) ?? 0;
  if (uncategorized !== 0) categories.push(uncategorizedStat(uncategorized));
  categories.sort((a, b) => b.spent_minor - a.spent_minor || (b.limit_minor ?? 0) - (a.limit_minor ?? 0));

  const types = await listTypes();

  return {
    ym,
    currency,
    groups: groupByType(categories, types),
    spent_minor: categories.reduce((sum, c) => sum + spentOf(c), 0) - refundsUnassigned,
    refunds_unassigned_minor: refundsUnassigned,
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
  /** refunds without a category: subtracted from spent_minor, ≥ 0 */
  refunds_unassigned_minor: number;
  other_currencies: Array<{ currency: string; spent_minor: number }>;
};

/**
 * Spending by category for any period [from, to) (unix seconds), e.g. one day, in `currency`; no plan. `planned`:
 * categories listed even with nothing spent in the period (0 ₾), after the ones with spending.
 */
export async function periodStats(from: number, to: number, currency: Currency = BUDGET_CURRENCY, planned: number[] = []): Promise<PeriodStats> {
  const db = await getDb();
  const { items, missing } = await convertSpending(await spendRows(from, to), currency);
  const spentBy = sumBy(items, categoryKey);
  const refundsUnassigned = refundsUnassignedOf(spentBy);
  const ids = [...new Set([...spentBy.keys(), ...planned])].filter((id): id is number => typeof id === 'number');
  const cats = ids.length === 0 ? [] : await db.all<CategoryRow>(
    `SELECT c.id, c.name, c.emoji, c.type_id, ct.name AS type_name, c.deleted_at, ct.is_transfer FROM categories c
      LEFT JOIN category_types ct ON ct.id = c.type_id WHERE c.id IN (${placeholders(ids.length)})`, ids);
  const colorOf = await categoryColors();
  const categories: CategoryStat[] = cats.map((c) => categoryStat(c, spentBy.get(c.id) ?? 0, colorOf));
  const none = spentBy.get(null) ?? 0;
  if (none !== 0) categories.push(uncategorizedStat(none));
  const positive = categories.filter((c) => c.spent_minor > 0).sort((a, b) => b.spent_minor - a.spent_minor);
  // transfers that brought in more than went out: listed ("+"), not in the total
  const cameIn = categories.filter((c) => c.transfer && c.spent_minor < 0).sort((a, b) => a.spent_minor - b.spent_minor);
  // planned ones with nothing spent (a refund bigger than the spending counts as nothing too)
  const untouched = categories.filter((c) => c.category_id !== null && c.spent_minor <= 0 && planned.includes(c.category_id) && !c.deleted)
    .map((c) => ({ ...c, spent_minor: 0 })).sort((a, b) => a.name.localeCompare(b.name));
  const listed = [...positive, ...cameIn, ...untouched];
  const types = await listTypes();
  return {
    currency, groups: groupByType(listed, types), categories: listed,
    spent_minor: positive.reduce((s, c) => s + c.spent_minor, 0) - refundsUnassigned, refunds_unassigned_minor: refundsUnassigned,
    other_currencies: missing,
  };
}
