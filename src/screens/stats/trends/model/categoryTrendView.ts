// One category's page of «Динамика трат»: its spending against the usual, the chart, the weekdays, the months, the merchants.
import { categoryLabel } from '@/db/categories';
import type { TrendsData } from '@/db/plans';
import { MONTHS_NOM } from '@/shared/lib/dates';
import type { DayKey } from '@/shared/lib/dateRange';
import { monthBars, monthsSummary, topMerchants, TrendMode, trendOf, trendWindows, weekdayHabits } from '@/stats/trends';
import { Bar, barsOf, MONDAY_FIRST, spendsByCategory } from './trendsView';

/** The weekdays spent on most, highlighted. */
const TOP_DAYS = 2;

export type CategoryTrendView = ReturnType<typeof categoryTrendView>;

/** null — no such category (deleted meanwhile). */
export function categoryTrendView(data: TrendsData, id: number, mode: TrendMode, today: DayKey) {
  const category = data.categories.find((c) => c.id === id);
  if (!category) return null;
  const spends = spendsByCategory(data.spends).get(id) ?? [];
  const trend = trendOf(spends, mode, today, data.since);

  const habits = weekdayHabits(spends, today, data.since);
  const week = habits.reduce((a, b) => a + b, 0);
  const top = habits.map((v, i) => ({ v, i })).filter((d) => d.v > 0).sort((a, b) => b.v - a.v).slice(0, TOP_DAYS).map((d) => d.i);
  const habitBars: Bar[] = habits.map((v, i) => ({ key: MONDAY_FIRST[i], label: MONDAY_FIRST[i], value: v, tone: top.includes(i) ? 'now' : 'other' }));

  const summary = monthsSummary(monthBars(spends, today), data.since);
  const monthName = (ym: string) => MONTHS_NOM[Number(ym.slice(5)) - 1].slice(0, 3);
  return {
    category,
    label: categoryLabel(category),
    trend,
    bars: barsOf(spends, mode, today),
    window: trendWindows(mode, today).cur,
    habits: week > 0 ? {
      bars: habitBars,
      /** "Больше всего — пт и сб · 50% трат недели" */
      top: top.map((i) => MONDAY_FIRST[i]).join(' и '),
      share: Math.round((top.reduce((a, i) => a + habits[i], 0) / week) * 100),
    } : null,
    summary: summary ? { ...summary, least: { ...summary.least, name: monthName(summary.least.ym) }, most: { ...summary.most, name: monthName(summary.most.ym) } } : null,
    merchants: topMerchants(spends, mode, today),
    /** operations of the period: its "N операций · X ₾ ›" */
    count: spends.filter((s) => s.value > 0 && s.day >= trendWindows(mode, today).cur.from).length,
  };
}
