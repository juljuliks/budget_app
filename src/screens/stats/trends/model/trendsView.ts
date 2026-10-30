// «Динамика трат»: the categories spent more / less than usual, their bars, and the words of a change.
import { categoryLabel } from '@/db/categories';
import type { TrendCategory, TrendSpend, TrendsData } from '@/db/plans';
import { MONTHS_NOM, WEEKDAYS } from '@/shared/lib/dates';
import { plural } from '@/shared/lib/format';
import type { DayKey } from '@/shared/lib/dateRange';
import { monthBars, Trend, TrendMode, trendOf, USUAL_OF, weekBars } from '@/stats/trends';

/** A bar of a chart: `tone` — the period looked at, the usual it's put against, or the others. */
export type Bar = {
  /** the day ('YYYY-MM-DD') or month ('YYYY-MM') it is */
  key: string;
  label: string; value: number | null; usual?: number; tone: 'now' | 'base' | 'other';
};

export type TrendRow = { category: TrendCategory; label: string; trend: Trend; bars: Bar[] };

/** At most this many in «Больше обычного» / «Меньше обычного». */
export const MORE_COUNT = 3;
export const LESS_COUNT = 2;

/** Each category's spending, by its id. */
export function spendsByCategory(spends: TrendSpend[]): Map<number, TrendSpend[]> {
  const by = new Map<number, TrendSpend[]>();
  for (const s of spends) { if (!by.has(s.category)) by.set(s.category, []); by.get(s.category)!.push(s); }
  return by;
}

/** «пн» … «вс» */
export const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0].map((d) => WEEKDAYS[d]);

/** The bars of a category: this week by day (with the usual of each weekday), or the last 12 months (the usual ones pale). */
export function barsOf(spends: TrendSpend[], mode: TrendMode, today: DayKey): Bar[] {
  if (mode === 'week') {
    return weekBars(spends, today).map((b, i) => ({ key: b.day, label: MONDAY_FIRST[i], value: b.value, usual: b.usual, tone: 'now' }));
  }
  const bars = monthBars(spends, today);
  return bars.map((b, i) => ({
    key: b.ym,
    label: MONTHS_NOM[Number(b.ym.slice(5)) - 1].slice(0, 3),
    value: b.value,
    tone: i === bars.length - 1 ? 'now' : i >= bars.length - 1 - USUAL_OF.month ? 'base' : 'other',
  }));
}

/**
 * The compared categories that moved off their usual: the most up first, the most down first; `max` of each (all of
 * them: Infinity) — MORE_COUNT / LESS_COUNT.
 */
export function trendLists(data: TrendsData, mode: TrendMode, today: DayKey, max?: number): { more: TrendRow[]; less: TrendRow[]; early: boolean } {
  const by = spendsByCategory(data.spends);
  const rows: TrendRow[] = [];
  let early = true;
  for (const c of data.categories) {
    if (!c.compared) continue;
    const spends = by.get(c.id) ?? [];
    const trend = trendOf(spends, mode, today, data.since);
    if (trend) early = false;
    if (!trend?.notable) continue;
    rows.push({ category: c, label: categoryLabel(c), trend, bars: barsOf(spends, mode, today) });
  }
  return {
    more: rows.filter((r) => r.trend.delta > 0).sort((a, b) => b.trend.delta - a.trend.delta).slice(0, max ?? MORE_COUNT),
    less: rows.filter((r) => r.trend.delta < 0).sort((a, b) => a.trend.delta - b.trend.delta).slice(0, max ?? LESS_COUNT),
    early: data.categories.some((c) => c.compared) && early,
  };
}

/** "+62% к обычному", "−100% к обычному"; nothing usually — "раньше не было". */
export function pctText(t: Trend): string {
  if (t.pct === null) return 'раньше не было';
  return `${t.pct > 0 ? '+' : '−'}${Math.abs(t.pct)}% к обычному`;
}

const purchases = (n: number) => `${n} ${plural(n, ['покупка', 'покупки', 'покупок'])}`;

/** A change of the average check this big (a share of it) says "дороже" / "дешевле". */
const CHECK_MOVE = 0.15;

/**
 * Why it moved: more / fewer purchases, or a dearer / cheaper average check. "Чаще: 7 покупок вместо 4, средний чек тот
 * же ≈ 15 ₾"; null — nothing usually to compare with.
 */
export function whyText(t: Trend, money: (minor: number) => string): string | null {
  if (t.usualCount === 0) return null;
  if (t.count === 0) return `Покупок не было, обычно ${purchases(t.usualCount)}`;
  const avg = t.cur / t.count;
  const usualAvg = t.usual / t.usualCount;
  if (usualAvg <= 0) return null;
  const moved = Math.abs(avg - usualAvg) / usualAvg >= CHECK_MOVE;
  if (!moved) {
    if (t.count === t.usualCount) return null;
    return `${t.count > t.usualCount ? 'Чаще' : 'Реже'}: ${purchases(t.count)} вместо ${t.usualCount}, средний чек тот же ≈ ${money(avg)}`;
  }
  const count = t.count === t.usualCount ? '' : `, ${purchases(t.count)} вместо ${t.usualCount}`;
  return `${avg > usualAvg ? 'Дороже' : 'Дешевле'}: средний чек ${money(avg)} вместо ${money(usualAvg)}${count}`;
}
