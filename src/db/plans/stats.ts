// A month's or a period's spending by category and section, against the plan.
import { getDb } from '../index';
import { categoryColors } from '../colors';
import { NEUTRAL_COLOR, NO_CATEGORY_EMOJI } from '../../domain/colors';
import { Currency } from '../fx';
import { BUDGET_CURRENCY, asCurrency, currentYm, monthRange, planRateDate, ymOf } from './months';
import { REFUND_KEY, categoryKey, convertSpending, spendRows, sumBy } from './spend';
import { PlanKind, asNorm } from './types';
import { ensureMonthPlan } from './budget';
import { placeholders } from '../sql';
import { savingSpend } from '../recurring/saving';
import { monthFunds, spentIn } from './statsOwn';
import { monthPayments } from './recurringItems';
import { type CategoryStat, groupByType, type MonthStats, spentOf, type StatGroup } from './statsShape';

// the shapes and rules are imported from here too (closePayments, history, cover)
export * from './statsShape';

type CategoryRow = {
  id: number;
  name: string;
  emoji: string | null;
  type_id: number | null;
  type_name: string | null;
  deleted_at: number | null;
  is_transfer: number | null;
};

/** A category's row of stats; `plan` (its amount in the stats' currency, kind, rhythm) when it is in the month's plan. */
function categoryStat(
  c: CategoryRow,
  spent: number,
  colorOf: Map<number, string>,
  plan?: { limit: number; kind: PlanKind | null; norm: string | null },
): CategoryStat {
  return {
    category_id: c.id,
    name: c.name,
    emoji: c.emoji,
    type_id: c.type_id,
    type_name: c.type_name,
    spent_minor: spent,
    limit_minor: plan ? plan.limit : null,
    plan_kind: plan ? plan.kind : null,
    plan_norm: plan ? asNorm(plan.norm) : null,
    color: colorOf.get(c.id) ?? NEUTRAL_COLOR,
    deleted: c.deleted_at !== null,
    transfer: c.is_transfer === 1,
  };
}

/** The spending without a category, as a row of its own. */
const uncategorizedStat = (spent: number): CategoryStat => ({
  category_id: null,
  name: 'Без категории',
  emoji: NO_CATEGORY_EMOJI,
  type_id: null,
  type_name: null,
  spent_minor: spent,
  limit_minor: null,
  plan_kind: null,
  plan_norm: null,
  color: NEUTRAL_COLOR,
  deleted: false,
  transfer: false,
});

/** Refunds without a category: subtracted from the total, shown apart ("Возвраты без категории"). */
const refundsUnassignedOf = (spentBy: Map<number | null | typeof REFUND_KEY, number>) =>
  Math.max(0, -(spentBy.get(REFUND_KEY) ?? 0));

const listTypes = async () =>
  (await getDb()).all<{ id: number; name: string }>('SELECT id, name FROM category_types ORDER BY sort_order, name');

/** The month's spending and plan by category, in `currency` (spending on each day's rate, the plan on planRateDate; subscriptions — a done charge on its operation's day). */
export async function monthStats(
  year: number,
  month: number,
  currency: Currency = BUDGET_CURRENCY,
): Promise<MonthStats> {
  const ym = ymOf(year, month);
  await ensureMonthPlan(ym);
  const db = await getDb();
  const [from, to] = monthRange(year, month);
  const planDate = planRateDate(ym);
  const rows = await spendRows(from, to);
  const { items, missing, conv } = await convertSpending(rows, currency, [planDate]);
  const spentBy = sumBy(items, categoryKey);
  const refundsUnassigned = refundsUnassignedOf(spentBy);
  // the payments saved up for: their categories spent the contributions, not what was paid from them
  for (const [id, minor] of await savingSpend(ym, (m, from) => conv(m, from, currency, planDate) ?? 0))
    spentBy.set(id, (spentBy.get(id) ?? 0) + minor);

  const colorOf = await categoryColors();

  const cats = await db.all<
    CategoryRow & {
      limit_minor: number | null;
      plan_currency: string | null;
      item_kind: PlanKind | null;
      plan_kind: PlanKind | null;
      plan_norm: string | null;
    }
  >(
    `SELECT c.id, c.name, c.emoji, c.type_id, ct.name AS type_name, p.limit_minor, p.currency AS plan_currency, p.kind AS item_kind,
      -- "Подписки" counts as a fixed payment in the stats: paid or not, by the month
      CASE WHEN p.kind = 'subs' THEN 'fixed' ELSE p.kind END AS plan_kind,
        p.norm_period AS plan_norm, c.deleted_at, ct.is_transfer
      FROM categories c
      LEFT JOIN category_types ct ON ct.id = c.type_id
      LEFT JOIN plan_items p ON p.category_id = c.id AND p.ym = ?`,
    [ym],
  );
  // the categories planned in another currency: their spending in it as well
  const foreign = cats.filter((c) => c.limit_minor && asCurrency(c.plan_currency) !== currency);
  const ownSpent = await spentIn(
    ym,
    rows,
    foreign.map((c) => asCurrency(c.plan_currency)),
  );

  const categories: CategoryStat[] = [];
  for (const c of cats) {
    const s = spentBy.get(c.id) ?? 0;
    // subscriptions: each charge on its own day (a done one — the operation's), not the whole sum on the plan's rate day
    const live =
      c.item_kind === 'subs' && c.limit_minor && ym >= currentYm()
        ? (await monthPayments(ym, currency, undefined, c.id)).total_minor
        : null;
    if (live !== null && asCurrency(c.plan_currency) === currency && c.limit_minor !== live) {
      await db.run('UPDATE plan_items SET limit_minor = ? WHERE ym = ? AND category_id = ?', [live, ym, c.id]);
    }
    const limit = live ?? (c.limit_minor ? conv(c.limit_minor, asCurrency(c.plan_currency), currency, planDate) : null);
    if (s === 0 && limit === null) continue;
    const stat = categoryStat(
      c,
      s,
      colorOf,
      limit === null ? undefined : { limit, kind: c.plan_kind, norm: c.plan_norm },
    );
    const pc = asCurrency(c.plan_currency);
    if (limit !== null && c.limit_minor && pc !== currency) {
      const ownLimit = live === null ? c.limit_minor : (await monthPayments(ym, pc, undefined, c.id)).total_minor;
      stat.own = { currency: pc, spent_minor: ownSpent.get(pc)?.get(c.id) ?? 0, limit_minor: ownLimit };
    }
    categories.push(stat);
  }
  const uncategorized = spentBy.get(null) ?? 0;
  if (uncategorized !== 0) categories.push(uncategorizedStat(uncategorized));
  categories.sort((a, b) => b.spent_minor - a.spent_minor || (b.limit_minor ?? 0) - (a.limit_minor ?? 0));

  // the funds apart: their spending is from what they saved, only a shortage is the month's
  const funds = await monthFunds(
    ym,
    currency,
    (minor, from) => conv(minor, from, currency, planDate) ?? 0,
    cats,
    colorOf,
  );
  const own = categories.filter((c) => !funds.some((f) => f.category_id === c.category_id));
  const types = await listTypes();

  return {
    ym,
    currency,
    funds,
    groups: groupByType(own, types),
    spent_minor:
      own.reduce((sum, c) => sum + spentOf(c), 0) + funds.reduce((a, f) => a + f.shortage_minor, 0) - refundsUnassigned,
    refunds_unassigned_minor: refundsUnassigned,
    planned_minor: own.reduce((sum, c) => sum + (c.limit_minor ?? 0), 0),
    categories: own,
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
export async function periodStats(
  from: number,
  to: number,
  currency: Currency = BUDGET_CURRENCY,
  planned: number[] = [],
): Promise<PeriodStats> {
  const db = await getDb();
  const { items, missing } = await convertSpending(await spendRows(from, to), currency);
  const spentBy = sumBy(items, categoryKey);
  const refundsUnassigned = refundsUnassignedOf(spentBy);
  const ids = [...new Set([...spentBy.keys(), ...planned])].filter((id): id is number => typeof id === 'number');
  const cats =
    ids.length === 0
      ? []
      : await db.all<CategoryRow>(
          `SELECT c.id, c.name, c.emoji, c.type_id, ct.name AS type_name, c.deleted_at, ct.is_transfer FROM categories c
      LEFT JOIN category_types ct ON ct.id = c.type_id WHERE c.id IN (${placeholders(ids.length)})`,
          ids,
        );
  const colorOf = await categoryColors();
  const categories: CategoryStat[] = cats.map((c) => categoryStat(c, spentBy.get(c.id) ?? 0, colorOf));
  const none = spentBy.get(null) ?? 0;
  if (none !== 0) categories.push(uncategorizedStat(none));
  const positive = categories.filter((c) => c.spent_minor > 0).sort((a, b) => b.spent_minor - a.spent_minor);
  // transfers that brought in more than went out: listed ("+"), not in the total
  const cameIn = categories
    .filter((c) => c.transfer && c.spent_minor < 0)
    .sort((a, b) => a.spent_minor - b.spent_minor);
  // planned ones with nothing spent (a refund bigger than the spending counts as nothing too)
  const untouched = categories
    .filter((c) => c.category_id !== null && c.spent_minor <= 0 && planned.includes(c.category_id) && !c.deleted)
    .map((c) => ({ ...c, spent_minor: 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const listed = [...positive, ...cameIn, ...untouched];
  const types = await listTypes();
  return {
    currency,
    groups: groupByType(listed, types),
    categories: listed,
    spent_minor: positive.reduce((s, c) => s + c.spent_minor, 0) - refundsUnassigned,
    refunds_unassigned_minor: refundsUnassigned,
    other_currencies: missing,
  };
}
