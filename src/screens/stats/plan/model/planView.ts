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
import { RING_DEBT, RING_SAVINGS, RING_UNPLANNED } from '../parts/palette';
import type { SpentBy } from './usePlanData';
import { savingsLess } from './savingsLess';

/** how a part's amount is colored: over the budget, savings, locked, free */
export type Tone = 'over' | 'savings' | 'locked' | 'free';
/** `was`: as planned, struck before `value` (the overspend took the rest; ⓘ — what took it) */
export type BudgetPart = { key: string; label: string; value: number; color: string; note: string; tone?: Tone; noteTone?: Tone; was?: number };
/**
 * `carry`: what the month before sent (a tap: "Покрыть иначе?" / "Куда остаток?"); a moved leftover with its "+", no share.
 * `was`: as planned, struck (the overspend took part of it). `inBudget`: it in the budget's currency (the one 🔒 is typed
 * in) when the screen shows another — "(300 ₾)" before it.
 */
export type SystemRow = { key: string; name: string; note: string; value: number; tone?: Tone; carry?: 'debt' | 'plus'; was?: number; inBudget?: number };
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

/**
 * Plan items in sections by category type (listPlan returns them in type order); untyped last. Totals converted. In a
 * section, those charged in a later month only (0 this month, "30 ₾ в ноябре") go last.
 */
export function groupByType(items: PlanItem[]): Array<{ title: string; planned: number; items: PlanItem[] }> {
  const groups: Array<{ title: string; planned: number; items: PlanItem[] }> = [];
  for (const item of items) {
    const title = item.type_name ?? NO_SECTION;
    let g = groups[groups.length - 1];
    if (!g || g.title !== title) { g = { title, planned: 0, items: [] }; groups.push(g); }
    g.items.push(item);
    g.planned += item.converted_minor ?? 0;
  }
  for (const g of groups) g.items = [...g.items.filter((i) => !i.subs?.upcoming), ...g.items.filter((i) => i.subs?.upcoming)];
  return groups;
}

type Data = {
  ym: string;
  currency: Currency;
  items: PlanItem[];
  budget: PlanBudget | null;
  toShown: (minor: number, from: Currency) => number | null;
  fromShown: (minor: number, to: Currency) => number | null;
  income: number;
  unplannedSpentMinor: number;
  spentBy: SpentBy;
  hidden: boolean;
};

/** A category's spending less what it saved up for its repeating payments: as its row in the plan, the charges only. */
function withoutSaving(spentBy: SpentBy, saving: PlanItem[]): SpentBy {
  const byCategory = new Map(spentBy.byCategory);
  for (const i of saving) byCategory.set(i.category_id, (byCategory.get(i.category_id) ?? 0) - i.subs!.saving_minor);
  return { ...spentBy, byCategory };
}

export function planView({ ym, currency, items: all, budget, toShown, fromShown, income, unplannedSpentMinor, spentBy }: Data) {
  const money = (minor: number) => formatWithCurrency(minor, currency);
  // the funds' contributions apart: in "Сбережения" (its section and its column)
  const funds = all.filter((i) => i.kind === 'fund');
  // what a category saves up for its repeating payments goes to "Сбережения" (as a fund's contribution): its row in its
  // section is the month's charges only
  const saving = all.filter((i) => i.kind !== 'fund' && !!i.subs?.saving_minor && i.converted_minor !== null);
  const items = all.filter((i) => i.kind !== 'fund')
    .map((i) => (saving.includes(i) ? { ...i, converted_minor: i.converted_minor! - i.subs!.saving_minor } : i));
  // the categories with repeating payments stay in their sections (🔁 in the pin's place)
  const recurring = items.filter((i) => i.recurring);
  const total = items.reduce((sum, i) => sum + (i.converted_minor ?? 0), 0);
  // set aside in the plan: the funds' and the repeating payments' contributions
  const fundsTotal = funds.reduce((sum, i) => sum + (i.converted_minor ?? 0), 0) + saving.reduce((sum, i) => sum + i.subs!.saving_minor, 0);
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
  // what a category is expected to take: its plan; a regular payment within the month — its days paid and to come (one
  // gone unpaid goes to the savings), in the screen's currency as its plan is
  const expectedOf = (i: PlanItem) => (i.expected_minor !== undefined && i.limit_minor
    ? Math.round((i.converted_minor ?? 0) * (i.expected_minor / i.limit_minor)) : i.converted_minor ?? 0);
  // savings at the month's end if the rest is spent by plan: every category takes its plan (or what it already took,
  // if more), spending outside the plan its share (or more); a past month: what was actually left
  const savingsEnd = shownBudget === null ? null : timing === 'past' ? shownBudget - debt - spentBy.total
    : timing === 'current'
      ? shownBudget - debt - all.reduce((a, i) => a + Math.max(expectedOf(i), spentBy.byCategory.get(i.category_id) ?? 0), 0)
        - Math.max(unplanned, unplannedSpentMinor)
      : (free ?? 0) + locked;
  const pct = (v: number) => (shownBudget ? percentOf(v, shownBudget) || '0%' : '');

  // this month: what the overspend already took of the savings (💰 first, then 🔒)
  const less = timing === 'current' && shownBudget !== null
    ? savingsLess({ items: [...items, ...funds], spentBy: withoutSaving(spentBy, saving), unplanned, unplannedSpent: unplannedSpentMinor, free: free ?? 0, locked }) : null;

  // the bar's parts, left to right; what the budget leaves is shown in "Сбережения" (where it goes: "Итоги месяца") with
  // the funds' contributions
  const saved = (savingsEnd ?? 0) + fundsTotal;
  const parts: BudgetPart[] = shownBudget ? [
    // owed by the month before: first, red
    ...(carry && debt > 0 ? [{ key: 'debt', label: `Перерасход ${genOf(carry.from_ym)}`, value: debt, color: RING_DEBT, note: pct(debt), tone: 'over' as const }] : []),
    { key: 'planned', label: 'План', value: total, color: chart.meterFill, note: pct(total) },
    // the plan shows what is set aside, not what is left of it (that's the stats' job)
    { key: 'unplanned', label: 'Вне плана', value: unplanned, color: RING_UNPLANNED, note: pct(unplanned) },
    timing === 'past'
      ? { key: 'free', label: 'Сбережения', value: Math.abs(saved), color: RING_SAVINGS, note: saved < 0 ? 'бюджет превышен' : 'сэкономлено', tone: saved < 0 ? 'over' : 'savings', noteTone: saved < 0 ? 'over' : undefined }
      // the locked part and the leftover together: one savings column; what it's made of (🔒 + 💰) is in the section below
      : less
        ? { key: 'free', label: 'Сбережения', value: less.now + fundsTotal, was: less.was + fundsTotal, color: RING_SAVINGS, note: pct(less.now + fundsTotal), tone: 'savings' }
        : { key: 'free', label: 'Сбережения', value: Math.max(0, free ?? 0) + locked + fundsTotal, color: RING_SAVINGS, note: pct(Math.max(0, free ?? 0) + locked + fundsTotal), tone: 'savings' },
  ] : [];

  // the plan's system sections: savings (🔒 locked, the funds, 💰 floating: what the plan leaves) and the share outside it
  const systemGroups: Array<{ title: string; rows: SystemRow[]; funds?: PlanItem[]; saving?: PlanItem[]; inBudget?: number }> = [];
  // "(300 ₾)": an amount in the budget's currency, when the screen shows another; null — the same one
  const budgetMoney = budget && budget.currency !== currency ? (minor: number) => `(${formatWithCurrency(minor, budget.currency)})` : null;
  // a fund's contribution in it: its own amount if it's in it, else converted (null — no rate)
  const fundInBudget = (i: PlanItem): number | null => {
    if (!budgetMoney || !budget) return null;
    if (i.currency === budget.currency) return i.limit_minor;
    return i.converted_minor === null ? null : fromShown(i.converted_minor, budget.currency);
  };
  // a category's contributions to its repeating payments in it
  const savingInBudget = (i: PlanItem): number | null => (!budgetMoney || !budget ? null : fromShown(i.subs?.saving_minor ?? 0, budget.currency));
  if (shownBudget && carry) {
    const from = genOf(carry.from_ym);
    systemGroups.push({ title: `Перенос из ${from}`, rows: [
      ...(debt > 0 ? [{ key: 'debt', name: `⚠️ Перерасход ${from}`, note: `вычтен из бюджета ${genOf(ym)}`, value: debt, tone: 'over' as const, carry: 'debt' as const }] : []),
      ...(plus > 0 ? [{ key: 'plus', name: `➕ Остаток ${from}`, note: `добавлен к бюджету ${genOf(ym)}`, value: plus, tone: 'free' as const, carry: 'plus' as const }] : []),
    ] });
  }
  if (shownBudget) {
    // a savings amount in the budget's currency, if the screen shows another (none without a rate)
    const inBudget = (shown: number, own?: number) => {
      if (!budget || budget.currency === currency) return {};
      const minor = own ?? fromShown(shown, budget.currency);
      return minor === null ? {} : { inBudget: minor };
    };
    const floating = less ? less.free.now : free ?? 0;
    const savingsRows: SystemRow[] = [
      ...(locked > 0 ? [{
        key: 'locked', name: '🔒 Отложено сразу', tone: 'locked' as const, value: less ? less.locked.now : locked,
        // as typed while the overspend took none of it
        ...inBudget(less ? less.locked.now : locked, less && less.locked.now < locked ? undefined : budget!.locked_minor),
        ...(less && less.locked.now < locked ? { note: 'перерасход', was: locked } : { note: 'заблокировано в начале месяца' }),
      }] : []),
      // none left — not shown
      ...(floating > 0 ? [{
        key: 'floating', name: '💰 Сэкономлено', tone: 'savings' as const,
        value: less ? less.free.now : free!, ...inBudget(less ? less.free.now : free!),
        ...(less && less.free.now < free! ? { note: 'перерасход', was: free! } : { note: 'не запланировано — решите в итогах месяца' }),
      }] : []),
    ];
    if (savingsRows.length || funds.length || saving.length) {
      // the section's total in the budget's currency: its rows', funds' and contributions' (any without a rate — none)
      const amounts = [...savingsRows.map((r) => r.inBudget ?? null), ...funds.map(fundInBudget), ...saving.map(savingInBudget)];
      const inBudgetTotal = budgetMoney && amounts.every((m) => m !== null) ? amounts.reduce<number>((a, m) => a + m!, 0) : undefined;
      systemGroups.push({ title: 'Сбережения', rows: savingsRows, funds, saving, inBudget: inBudgetTotal });
    }
    // the share set aside only: the spending against it is in the stats
    if (unplanned > 0) systemGroups.push({ title: 'Вне плана', rows: [{ key: 'unplanned', name: '🎲 Траты вне плана', value: unplanned, note: 'категории без плана и без категории' }] });
  } else if (funds.length || saving.length) systemGroups.push({ title: 'Сбережения', rows: [], funds, saving });

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

  return { currency, money, budgetMoney, fundInBudget, savingInBudget, total, fundsTotal, funds, recurring, shownBudget, budgetSub, claimed, unplanned, locked, free, timing, parts, less, systemGroups, budgetHint, groups: groupByType(items) };
}

export type PlanView = ReturnType<typeof planView>;
