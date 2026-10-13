// What the plan screen shows, worked out from its data: the budget's split (planned / outside the plan / savings or
// free), what the overspend took of the savings, the system sections, the items by type. No React.
import type { Currency } from '@/db/fx';
import { currentYm, PlanBudget, PlanItem, unplannedOf } from '@/db/plans';
import { daysInMonth } from '@/shared/lib/dateRange';
import { MONTHS_GEN, RHYTHM_DAYS } from '@/shared/lib/dates';
import { formatPercent } from '@/shared/lib/format';
import { formatWithCurrency } from '@/shared/lib/money';
import { NO_SECTION, PER_PERIOD, SPENDING_PATTERN } from '@/shared/lib/strings';
import { chart } from '@/shared/theme/theme';
import { RING_DEBT, RING_FUNDS, RING_SAVINGS, RING_UNPLANNED } from '../parts/palette';
import type { SpentBy } from './usePlanData';
import { savingsLess } from './savingsLess';

/** how a part's amount is colored: over the budget, savings, locked, free */
export type Tone = 'over' | 'savings' | 'locked' | 'free';
/** `was`: as planned, struck before `value` (the overspend took the rest; ⓘ — what took it) */
export type BudgetPart = { key: string; label: string; value: number; color: string; note: string; tone?: Tone; noteTone?: Tone; was?: number };
/**
 * `carry`: what the month before sent (a tap: "Покрыть иначе?" / "Куда остаток?"); a moved leftover with its "+", no share.
 * `was`: as planned, struck (the overspend took part of it).
 */
export type SystemRow = { key: string; name: string; note: string; value: number; tone?: Tone; carry?: 'debt' | 'plus'; was?: number };
/** "сентября" of a month key */
const genOf = (ym: string) => MONTHS_GEN[Number(ym.slice(5)) - 1];

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

export function planView({ ym, currency, items: all, budget, toShown, income, unplannedSpentMinor, spentBy }: Data) {
  const money = (minor: number) => formatWithCurrency(minor, currency);
  // the funds' contributions apart: their own section and column ("Копилки")
  const funds = all.filter((i) => i.kind === 'fund');
  const items = all.filter((i) => i.kind !== 'fund');
  const total = items.reduce((sum, i) => sum + (i.converted_minor ?? 0), 0);
  const fundsTotal = funds.reduce((sum, i) => sum + (i.converted_minor ?? 0), 0);
  // the amount to distribute in the screen's currency (its own one if there's no rate), with the leftover the month before
  // moved in; what it owed is a part of it
  const inShown = (minor: number) => (budget ? toShown(minor, budget.currency) ?? minor : minor);
  const carry = budget?.carry ?? null;
  const debt = carry ? inShown(carry.debt_minor) : 0;
  const plus = carry ? inShown(carry.plus_minor) : 0;
  const ownBudget = budget === null ? null : inShown(budget.amount_minor);
  const shownBudget = ownBudget === null ? null : ownBudget + plus;
  // the share set aside for spending outside the plan, then what nothing claims yet
  const unplanned = shownBudget === null || !budget ? 0 : toShown(unplannedOf(budget), budget.currency) ?? unplannedOf(budget);
  // locked for savings right away (🔒), in the screen's currency
  const locked = !budget || !budget.locked_minor ? 0 : toShown(budget.locked_minor, budget.currency) ?? budget.locked_minor;
  const free = shownBudget === null ? null : shownBudget - total - fundsTotal - unplanned - locked - debt;
  const timing = ym < currentYm() ? 'past' : ym === currentYm() ? 'current' : 'future';
  // savings at the month's end if the rest is spent by plan: every category takes its plan (or what it already took,
  // if more), spending outside the plan its share (or more); a past month: what was actually left
  const savingsEnd = shownBudget === null ? null : timing === 'past' ? shownBudget - debt - spentBy.total
    : timing === 'current'
      ? shownBudget - debt - all.reduce((a, i) => a + Math.max(i.converted_minor ?? 0, spentBy.byCategory.get(i.category_id) ?? 0), 0)
        - Math.max(unplanned, unplannedSpentMinor)
      : (free ?? 0) + locked;
  const pct = (v: number) => (shownBudget ? percentOf(v, shownBudget) || '0%' : '');

  // this month: what the overspend already took of the savings (🌊 first, then 🔒)
  const less = timing === 'current' && shownBudget !== null
    ? savingsLess({ items: all, spentBy, unplanned, unplannedSpent: unplannedSpentMinor, free: free ?? 0, locked }) : null;

  // the bar's parts, left to right; what the budget leaves is shown in "Сбережения" (where it goes: "Итоги месяца")
  const saved = savingsEnd ?? 0;
  const parts: BudgetPart[] = shownBudget ? [
    // owed by the month before: first, red
    ...(carry && debt > 0 ? [{ key: 'debt', label: `Перерасход ${genOf(carry.from_ym)}`, value: debt, color: RING_DEBT, note: pct(debt), tone: 'over' as const }] : []),
    { key: 'planned', label: 'План', value: total, color: chart.meterFill, note: pct(total) },
    // the plan shows what is set aside, not what is left of it (that's the stats' job)
    { key: 'unplanned', label: 'Вне плана', value: unplanned, color: RING_UNPLANNED, note: pct(unplanned) },
    ...(fundsTotal > 0 ? [{ key: 'funds', label: 'Копилки', value: fundsTotal, color: RING_FUNDS, note: pct(fundsTotal) }] : []),
    timing === 'past'
      ? { key: 'free', label: 'Сбережения', value: Math.abs(saved), color: RING_SAVINGS, note: saved < 0 ? 'бюджет превышен' : 'сэкономлено', tone: saved < 0 ? 'over' : 'savings', noteTone: saved < 0 ? 'over' : undefined }
      // the locked part and the leftover together: one savings column; what it's made of (🔒 + 🌊) is in the section below
      : less
        ? { key: 'free', label: 'Сбережения', value: less.now, was: less.was, color: RING_SAVINGS, note: pct(less.now), tone: 'savings' }
        : { key: 'free', label: 'Сбережения', value: Math.max(0, free ?? 0) + locked, color: RING_SAVINGS, note: pct(Math.max(0, free ?? 0) + locked), tone: 'savings' },
  ] : [];

  // the plan's system sections: savings (🔒 locked + 🌊 floating: what the plan leaves) and the share outside it
  const systemGroups: Array<{ title: string; rows: SystemRow[] }> = [];
  if (shownBudget && carry) {
    const from = genOf(carry.from_ym);
    systemGroups.push({ title: `Перенос из ${from}`, rows: [
      ...(debt > 0 ? [{ key: 'debt', name: `⚠️ Перерасход ${from}`, note: `вычтен из бюджета ${genOf(ym)}`, value: debt, tone: 'over' as const, carry: 'debt' as const }] : []),
      ...(plus > 0 ? [{ key: 'plus', name: `➕ Остаток ${from}`, note: `добавлен к бюджету ${genOf(ym)}`, value: plus, tone: 'free' as const, carry: 'plus' as const }] : []),
    ] });
  }
  if (shownBudget) {
    const savingsRows: SystemRow[] = [
      ...(locked > 0 ? [{
        key: 'locked', name: '🔒 Сразу', tone: 'locked' as const, value: less ? less.locked.now : locked,
        ...(less && less.locked.now < locked ? { note: 'перерасход съел часть', was: locked } : { note: 'заблокировано в начале месяца' }),
      }] : []),
      ...((free ?? 0) > 0 ? [{
        key: 'floating', name: '🌊 Что осталось', note: 'не запланировано — решите в итогах месяца', tone: 'savings' as const,
        value: less ? less.free.now : free!, ...(less && less.free.now < free! ? { was: free! } : {}),
      }] : []),
    ];
    if (savingsRows.length) systemGroups.push({ title: 'Сбережения', rows: savingsRows });
    // the share set aside only: the spending against it is in the stats
    if (unplanned > 0) systemGroups.push({ title: 'Вне плана', rows: [{ key: 'unplanned', name: '🎲 Траты вне плана', value: unplanned, note: 'категории без плана и без категории' }] });
  }

  const budgetHint = [
    total + fundsTotal > 0 ? `Уже запланировано: ${money(total + fundsTotal)}` : '',
    // "Пополнение счёта" and the transfers more came back for (src/db/plans.ts monthIncome)
    income > 0 ? `Пришло за месяц: ${money(income)}` : '',
  ].filter(Boolean).join('\n') || 'Сколько денег на месяц, например зарплата. План не сможет его превысить.';

  // under the budget: the leftover moved in on top of its own amount
  const budgetSub = carry && plus > 0 && ownBudget !== null ? `${money(ownBudget)} + ${money(plus)} из ${genOf(carry.from_ym)}` : null;

  // what the budget sheet's parts (🔒, the share outside the plan) can't take, in the screen's currency: the plan, the
  // funds, what the month before owes, less the leftover it moved in (that one is room)
  const claimed = total + fundsTotal + debt - plus;

  return { money, total, fundsTotal, funds, shownBudget, budgetSub, claimed, unplanned, locked, free, timing, parts, less, systemGroups, budgetHint, groups: groupByType(items) };
}

export type PlanView = ReturnType<typeof planView>;
