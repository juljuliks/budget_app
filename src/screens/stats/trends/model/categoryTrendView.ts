// One category's page of «Динамика трат»: its spending against the usual, the chart, the weekdays, the months (its
// merchants are read apart: useCategoryMerchants).
import { categoryLabel } from '@/db/categories';
import type { TrendsData } from '@/db/plans';
import { MONTHS_NOM } from '@/shared/lib/dates';
import type { DayKey } from '@/shared/lib/dateRange';
import { monthBars, monthsSummary, spentThisMonth, thisWeek, trendOf, trendWindows, weekdayHabits } from '@/stats/trends';
import { trendKind } from '@/stats/trendKind';
import { Bar, barsOf, MONDAY_FIRST, spendsByCategory } from './trendsView';

/** The weekdays spent on most, highlighted. */
const TOP_DAYS = 2;

export type CategoryTrendView = ReturnType<typeof categoryTrendView>;

/** null — no such category (deleted meanwhile). */
export function categoryTrendView(data: TrendsData, id: number, today: DayKey) {
  const category = data.categories.find((c) => c.id === id);
  if (!category) return null;
  const spends = spendsByCategory(data.spends).get(id) ?? [];
  const trend = trendOf(spends, today, data.since);

  const habits = weekdayHabits(spends, today, data.since);
  const week = habits.reduce((a, b) => a + b, 0);
  const top = habits.map((v, i) => ({ v, i })).filter((d) => d.v > 0).sort((a, b) => b.v - a.v).slice(0, TOP_DAYS).map((d) => d.i);
  // this week's days over the usual ones (grey under): what goes on now against the habit
  const days = thisWeek(spends, today);
  const habitBars: Bar[] = habits.map((v, i) => ({ key: MONDAY_FIRST[i], label: MONDAY_FIRST[i], value: days[i], usual: v, tone: 'now' }));
  // today's place in the week, Monday first: the week so far against the usual by the same days
  const at = days.findIndex((d) => d === null);
  const upTo = at < 0 ? 6 : at - 1;
  const sumTo = (xs: Array<number | null>) => xs.slice(0, upTo + 1).reduce<number>((a, b) => a + (b ?? 0), 0);

  const summary = monthsSummary(monthBars(spends, today), data.since);
  const monthName = (ym: string) => MONTHS_NOM[Number(ym.slice(5)) - 1].slice(0, 3);
  return {
    category,
    /** which page: frequent — this one; rare, subs, fund — their own (parts/KindTrend) */
    kind: trendKind(category, spends, today),
    spends,
    /** the 12 months, the current one marked: the rare, subscriptions' pages */
    months: barsOf(spends, today).map((b): Bar => ({ ...b, tone: b.tone === 'now' ? 'now' : 'other' })),
    label: categoryLabel(category),
    trend,
    /** this month so far (the head): also with no usual yet (`trend` null) */
    spent: spentThisMonth(spends, today),
    bars: barsOf(spends, today),
    window: trendWindows(today).cur,
    habits: week > 0 ? {
      bars: habitBars,
      /** "Эта неделя: 120 ₾ · обычно 90 ₾ к четвергу": this week so far and the average weekdays up to today */
      week: { cur: sumTo(days), usual: sumTo(habits), upTo },
      /** "Больше всего — пт и сб · 50% трат недели" */
      top: top.map((i) => MONDAY_FIRST[i]).join(' и '),
      share: Math.round((top.reduce((a, i) => a + habits[i], 0) / week) * 100),
    } : null,
    summary: summary ? { ...summary, least: { ...summary.least, name: monthName(summary.least.ym) }, most: { ...summary.most, name: monthName(summary.most.ym) } } : null,
    /** operations of the period: its "N операций · X ₾ ›" */
    count: spends.filter((s) => s.value > 0 && s.day >= trendWindows(today).cur.from).length,
  };
}
