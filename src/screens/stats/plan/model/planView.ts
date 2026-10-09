// What the plan screen shows, worked out from its data: the budget's split (planned / outside the plan / savings or
// free), the savings forecast, the system sections, the items by type. No React.
import type { Currency } from '@/db/fx';
import { currentYm, PlanBudget, PlanItem, unplannedOf } from '@/db/plans';
import { daysInMonth } from '@/shared/lib/dateRange';
import { RHYTHM_DAYS } from '@/shared/lib/dates';
import { formatPercent } from '@/shared/lib/format';
import { formatWithCurrency } from '@/shared/lib/money';
import { NO_SECTION, PER_PERIOD, SPENDING_PATTERN } from '@/shared/lib/strings';
import { chart } from '@/shared/theme/theme';
import { RING_FREE, RING_LOCKED, RING_SAVINGS, RING_UNPLANNED } from '../parts/palette';
import type { SpentBy } from './usePlanData';

/** how a part's amount is colored: over the budget, savings, locked, free */
export type Tone = 'over' | 'savings' | 'locked' | 'free';
export type BudgetPart = { key: string; label: string; value: number; color: string; note: string; tone?: Tone; noteTone?: Tone };
export type SystemRow = { key: string; name: string; note: string; value: number; tone?: Tone };

/** "лимит ≈ 46 ₾ в неделю": a flexible item's plan per its spending pattern (the month's plan / days in the month × days). */
export function normText(item: PlanItem, ym: string, currency: Currency): string {
  const amount = item.converted_minor ?? 0;
  if (!amount) return '';
  if (item.norm_period === 'month') return SPENDING_PATTERN.month.title.toLowerCase();
  const per = (amount / daysInMonth(ym)) * RHYTHM_DAYS[item.norm_period];
  return `лимит ≈ ${formatWithCurrency(Math.round(per), currency)} ${PER_PERIOD[item.norm_period]}`;
}

/** Share of the amount to distribute, "35%"; "<1%" for tiny non-zero amounts. */
export function percentOf(part: number, whole: number): string {
  return part > 0 && whole > 0 ? formatPercent(part, whole) : '';
}

/** Plan items in sections by category type (listPlan returns them in type order); untyped last. Totals converted. */
export function groupByType(items: PlanItem[]): Array<{ title: string; planned: number; items: PlanItem[] }> {
  const groups: Array<{ title: string; planned: number; items: PlanItem[] }> = [];
  for (const item of items) {
    const title = item.type_name ?? NO_SECTION;
    let g = groups[groups.length - 1];
    if (!g || g.title !== title) { g = { title, planned: 0, items: [] }; groups.push(g); }
    g.items.push(item);
    g.planned += item.converted_minor ?? 0;
  }
  return groups;
}

type Data = {
  ym: string;
  currency: Currency;
  items: PlanItem[];
  budget: PlanBudget | null;
  toShown: (minor: number, from: Currency) => number | null;
  income: number;
  unplannedSpentMinor: number;
  spentBy: SpentBy;
  hidden: boolean;
};

export function planView({ ym, currency, items, budget, toShown, income, unplannedSpentMinor, spentBy, hidden }: Data) {
  const money = (minor: number) => formatWithCurrency(minor, currency);
  const total = items.reduce((sum, i) => sum + (i.converted_minor ?? 0), 0);
  // the amount to distribute in the screen's currency (its own one if there's no rate)
  const shownBudget = budget === null ? null : toShown(budget.amount_minor, budget.currency) ?? budget.amount_minor;
  // the share set aside for spending outside the plan, then what nothing claims yet
  const unplanned = shownBudget === null || !budget ? 0 : toShown(unplannedOf(budget), budget.currency) ?? unplannedOf(budget);
  // locked for savings right away (🔒), in the screen's currency
  const locked = !budget || !budget.locked_minor ? 0 : toShown(budget.locked_minor, budget.currency) ?? budget.locked_minor;
  const free = shownBudget === null ? null : shownBudget - total - unplanned - locked;
  // "Сбережения" instead of "Свободно": what the budget leaves goes there
  const toSavings = !!budget?.to_savings && shownBudget !== null;
  const timing = ym < currentYm() ? 'past' : ym === currentYm() ? 'current' : 'future';
  // savings at the month's end if the rest is spent by plan: every category takes its plan (or what it already took,
  // if more), spending outside the plan its share (or more); a past month: what was actually left
  const savingsEnd = shownBudget === null ? null : timing === 'past' ? shownBudget - spentBy.total
    : timing === 'current'
      ? shownBudget - items.reduce((a, i) => a + Math.max(i.converted_minor ?? 0, spentBy.byCategory.get(i.category_id) ?? 0), 0)
        - Math.max(unplanned, unplannedSpentMinor)
      : (free ?? 0) + locked;
  const pct = (v: number) => (shownBudget ? percentOf(v, shownBudget) || '0%' : '');

  // the bar's parts, left to right; "Свободно" becomes "Сбережения" when the leftover goes there
  const saved = savingsEnd ?? 0;
  const parts: BudgetPart[] = shownBudget ? [
    { key: 'planned', label: 'План', value: total, color: chart.meterFill, note: pct(total) },
    // the plan shows what is set aside, not what is left of it (that's the stats' job)
    { key: 'unplanned', label: 'Вне плана', value: unplanned, color: RING_UNPLANNED, note: pct(unplanned) },
    toSavings && timing === 'past'
      ? { key: 'free', label: 'Сбережения', value: Math.abs(saved), color: RING_SAVINGS, note: saved < 0 ? 'бюджет превышен' : 'сэкономлено', tone: saved < 0 ? 'over' : 'savings', noteTone: saved < 0 ? 'over' : undefined }
      : toSavings
        // the locked part and the leftover together: one savings column; what it's made of (🔒 + 🌊) is in the section below
        ? { key: 'free', label: 'Сбережения', value: Math.max(0, free ?? 0) + locked, color: RING_SAVINGS, note: pct(Math.max(0, free ?? 0) + locked), tone: 'savings' }
        : { key: 'free', label: 'Свободно', value: Math.max(0, free ?? 0), color: RING_FREE, note: percentOf(free ?? 0, shownBudget) || '0%', tone: 'free' },
    // the locked part apart when the leftover doesn't go to savings
    ...(!toSavings && locked > 0 ? [{ key: 'locked', label: 'Отложено', value: locked, color: RING_LOCKED, note: pct(locked), tone: 'locked' as const }] : []),
  ] : [];

  // overspent already: less will be saved by the month's end (a difference under 1% of the budget is noise)
  const notes: Array<{ text: string; warn?: boolean }> = [];
  if (toSavings && timing === 'current' && savingsEnd !== null && (free ?? 0) + locked - savingsEnd >= shownBudget! / 100) {
    notes.push({
      text: savingsEnd <= 0 ? 'Перерасход съел сбережения месяца'
        : hidden ? 'Сбережения к концу месяца будут меньше из-за перерасхода'
          : `Сбережения к концу месяца ≈ ${money(savingsEnd)}, если тратить по плану`,
      warn: true,
    });
  }

  // the plan's system sections: savings (🔒 locked + 🌊 floating: what the plan leaves) and the share outside it
  const systemGroups: Array<{ title: string; rows: SystemRow[] }> = [];
  if (shownBudget) {
    const savingsRows: SystemRow[] = [
      ...(locked > 0 ? [{ key: 'locked', name: '🔒 Сразу', note: 'заблокировано в начале месяца', value: locked, tone: 'locked' as const }] : []),
      ...(toSavings && (free ?? 0) > 0 ? [{ key: 'floating', name: '🌊 Что осталось', note: 'что не запланировано, плюс сэкономленное', value: free!, tone: 'savings' as const }] : []),
    ];
    if (savingsRows.length) systemGroups.push({ title: 'Сбережения', rows: savingsRows });
    // the share set aside only: the spending against it is in the stats
    if (unplanned > 0) systemGroups.push({ title: 'Вне плана', rows: [{ key: 'unplanned', name: '🎲 Траты вне плана', value: unplanned, note: 'категории без плана и без категории' }] });
  }

  const budgetHint = [
    total > 0 ? `Уже запланировано: ${money(total)}` : '',
    // "Пополнение счёта" and the transfers more came back for (src/db/plans.ts monthIncome)
    income > 0 ? `Пришло за месяц: ${money(income)}` : '',
  ].filter(Boolean).join('\n') || 'Сколько денег на месяц, например зарплата. План не сможет его превысить.';

  return { money, total, shownBudget, unplanned, locked, free, toSavings, timing, parts, notes, systemGroups, budgetHint, groups: groupByType(items) };
}

export type PlanView = ReturnType<typeof planView>;
