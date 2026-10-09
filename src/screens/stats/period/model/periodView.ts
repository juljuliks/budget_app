// What the period's screen shows, worked out from its data: the sections (by limit or by type), each row's amounts,
// the formatters. No React: the parts read it.
import { CategoryStat, NormPeriod, parseYm, PeriodStats, spentOf } from '@/db/plans';
import { categoryLabel } from '@/db/categories';
import { GROUP_TITLES, splitUnplanned, SummaryGroupKey, summaryGroups, UnplannedMonth } from '@/entities/plan';
import { DayKey, DayRange, daysInMonth, shortRange } from '@/shared/lib/dateRange';
import { MONTHS_NOM } from '@/shared/lib/dates';
import { formatPercent } from '@/shared/lib/format';
import { formatWithCurrency } from '@/shared/lib/money';
import { CategoryNorm, isPartOfWindow, NormPart, Norms } from '@/stats/norms';
import { deltaText, formulaText, noPlanText, summaryText, windowLabelText } from './periodText';

type Data = {
  stats: PeriodStats;
  norms: Norms | null;
  month: UnplannedMonth | null;
  average: { average_minor: number; months: number } | null | undefined;
  range: DayRange;
  /** "на день" / "на неделю" / "на период": the period's kind */
  normLabel?: string;
  days: number;
  pace: boolean;
  today: DayKey;
};

const LIMIT_ORDER: SummaryGroupKey[] = ['day', 'week', '2weeks'];

export function periodView({ stats, norms, month, average, range, normLabel, days, pace, today }: Data) {
  const cur = stats.currency;
  const money = (minor: number) => formatWithCurrency(minor, cur);
  /** an amount in a formula: whole minor units, "64.52 ₾" */
  const m = (v: number) => money(Math.round(v));
  // a transfer category carries its sign, as in the operations: "−" sent, "+" (green) more came back than was sent
  const signed = (c: CategoryStat) => (!c.transfer ? money(c.spent_minor) : c.spent_minor < 0 ? `+${money(-c.spent_minor)}` : `−${money(c.spent_minor)}`);
  const cameIn = (c: CategoryStat) => c.transfer && c.spent_minor < 0;
  const planOf = (c: CategoryStat): CategoryNorm | undefined => (c.category_id === null ? undefined : norms?.byCategory.get(c.category_id));
  const monthToDate = (c: CategoryStat) => (c.category_id !== null && norms?.monthToDate.get(c.category_id)) || 0;
  const monthIn = norms ? MONTHS_NOM[parseYm(norms.ym).month] : '';
  /** "31 окт": the month's last day, what the month's shares run until */
  const monthEndShort = norms ? shortRange({ from: `${norms.ym}-${daysInMonth(norms.ym)}`, to: `${norms.ym}-${daysInMonth(norms.ym)}` }) : '';
  const windowLabel = (rhythm: NormPeriod, w: DayRange) => (norms ? windowLabelText(norms.ym, range, rhythm, w) : '');

  // under the donut: the limits by rhythm, or the average per month for a long period
  const groups = pace && norms ? summaryGroups(norms, range, stats.spent_minor, today, month ?? undefined) : [];
  const limited = groups.filter((g) => g.key !== 'outside');
  /** "Недельные лимиты · 28 сен – 4 окт", "Обязательные платежи · октябрь" */
  const groupTitle = (key: SummaryGroupKey) => {
    const g = groups.find((x) => x.key === key);
    const name = key === 'outside' ? GROUP_TITLES.outside : key === 'fixed' ? 'Обязательные платежи' : `${GROUP_TITLES[key]} лимиты`;
    const byMonth = key === 'month' || key === 'fixed' || (key === 'outside' && !!g?.limit);
    return byMonth ? `${name} · ${monthIn}` : g?.window ? `${name} · ${shortRange(g.window)}` : name;
  };
  // the period's spending outside the plan, by category (the "Вне плана" block's calculation)
  const outsideCats = stats.categories.filter((c) => (c.spent_minor > 0 || cameIn(c))
    && (c.category_id === null || (month ? !month.planned.has(c.category_id) : norms?.byCategory.get(c.category_id) === undefined)));
  const summary = summaryText(pace, limited.length, average, money);
  // a day / week: the categories without a plan this month and the uncategorized in one "Вне плана" section at the bottom
  const split = month ? splitUnplanned(stats.groups, (c) => month.planned.has(c.category_id!)) : { groups: stats.groups, unplanned: [], spent: 0 };

  // shorter than a month: grouped by the limit's rhythm (the planned categories; the rest stay in "Вне плана")
  const byLimits = !!norms && days < daysInMonth(norms.ym) && !!month;
  // only the limits this period measures: a day — the daily ones; a week — daily and weekly; two weeks — also the
  // 2-week ones. A longer rhythm (a weekly limit on a day, the month's, obligatory payments) can't be judged by these
  // days: such categories go to "Другие траты" with just their spending
  const fitting = (rhythm: string) => rhythm === 'day' || (rhythm === 'week' && (normLabel === 'на неделю' || days >= 7))
    || (rhythm === '2weeks' && days >= 14);
  // a day / week / 2-week category over its month's plan (by the period's end) has no limit left: out of its
  // limit's section (whose total leaves it out too), into its own one after them
  const monthOver = (c: CategoryStat) => {
    const p = planOf(c);
    return !!p && p.kind === 'limit' && p.rhythm !== 'month' && p.monthLimit > 0 && monthToDate(c) > p.monthLimit;
  };
  const bySpent = (a: CategoryStat, b: CategoryStat) => b.spent_minor - a.spent_minor;
  const planned = split.groups.flatMap((g) => g.categories);
  const limitSections = byLimits ? LIMIT_ORDER.filter(fitting).map((key) => ({
    key,
    cats: planned.filter((c) => {
      const p = planOf(c);
      return p && !monthOver(c) ? (p.kind === 'fixed' ? 'fixed' : p.rhythm) === key : false;
    }).sort(bySpent),
  })).filter((x) => x.cats.length > 0) : [];
  const overspentCats = byLimits ? planned.filter(monthOver).sort(bySpent) : [];
  const otherCats = byLimits ? planned.filter((c) => {
    const p = planOf(c);
    return !monthOver(c) && !(p && p.kind === 'limit' && fitting(p.rhythm)) && (c.spent_minor > 0 || cameIn(c));
  }).sort(bySpent) : [];

  /** a header's % with the amounts hidden: of its plan, or of all the spending without one */
  const headerPct = (spent: number, plannedMinor: number) => (plannedMinor > 0 ? formatPercent(spent, Math.round(plannedMinor)) : formatPercent(spent, stats.spent_minor));
  /**
   * What a day / week limit's "spent / limit" on the right is measured over: the period itself, or — a day of a
   * weekly limit — its whole week so far, as the line under it ("Неделя 5 – 11 окт: осталось …")
   */
  const limitPair = (plan: CategoryNorm, c: CategoryStat) => (isPartOfWindow(plan.window, range)
    ? { spent: plan.windowSpent, limit: plan.windowNorm } : { spent: c.spent_minor, limit: plan.periodNorm });
  /** the limit on the right: a fixed payment's month plan, a day / week limit's own (see limitPair) */
  const rightLimit = (c: CategoryStat, plan?: CategoryNorm) =>
    (!plan ? 0 : plan.kind === 'fixed' ? plan.monthLimit : plan.kind === 'limit' && plan.rhythm !== 'month' ? limitPair(plan, c).limit : 0);
  /** the spending on the right: the limit's own (a week's on a day of a weekly limit), else the period's */
  const rightSpent = (c: CategoryStat, plan?: CategoryNorm) => (plan?.kind === 'limit' && plan.rhythm !== 'month' ? limitPair(plan, c).spent : c.spent_minor);
  /** a row's "% плана" (its limit as on the right) or "% трат", while the amounts are hidden */
  const hiddenShare = (c: CategoryStat, plan?: CategoryNorm) => {
    const lim = !plan ? 0 : plan.kind === 'fixed' ? plan.monthLimit
      : plan.rhythm === 'month' ? 0 : isPartOfWindow(plan.window, range) ? plan.windowNorm : plan.periodNorm;
    return lim > 0 ? `${formatPercent(c.spent_minor, Math.round(lim))} плана` : `${formatPercent(c.spent_minor, stats.spent_minor)} трат`;
  };
  // "Жизнь: Покупки" wherever the sections aren't the categories' types: by limits (shorter than a month), outside
  // the plan, the calculations
  /** a limit's category in the calculations, with its type */
  const labelOf = (id: number, name: string) => {
    const c = stats.categories.find((x) => x.category_id === id);
    return c ? categoryLabel(c) : name;
  };
  const sumSpent = (cats: CategoryStat[]) => cats.reduce((a, c) => a + spentOf(c), 0);

  return {
    stats, norms, month, range, days, pace, today, cur, money, m, signed, cameIn, planOf, monthToDate, monthIn, monthEndShort,
    windowLabel, groups, groupTitle, outsideCats, summary, split, byLimits, limitSections, overspentCats, otherCats,
    headerPct, limitPair, rightLimit, rightSpent, hiddenShare, labelOf, sumSpent,
    delta: (spent: number, norm: number) => deltaText(spent, norm, money),
    formula: (parts: NormPart[]) => formulaText(parts, m),
    noPlan: noPlanText,
  };
}

export type PeriodView = ReturnType<typeof periodView>;
