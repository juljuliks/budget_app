import { NormPeriod } from '../../db/plans';
import { DayKey, DayRange, daysInMonth } from '../dateRange';
import { isPartOfWindow, NormPart, Norms } from './norms';

export type SummaryGroupKey = NormPeriod | 'outside';

/** One tile under the donut: the categories of one rhythm together (or the spending outside any limit). */
export type SummaryGroup = {
  key: SummaryGroupKey;
  /** the days measured when not the viewed period: the whole week of a weekly limit on a day, the month so far */
  window?: DayRange;
  spent: number;
  /** 0 for 'outside' */
  limit: number;
  /** the measured days go on after today: "осталось", else "сэкономлено" */
  ongoing: boolean;
  /** last day of the measured days ("до вс") */
  end: DayKey;
  /** the limit per rhythm at the period's start and after it, all the group's categories together; null for month / outside */
  change: { before: number; after: number | null } | null;
  /** the categories, for the explanation */
  items: Array<{ id: number; name: string; spent: number; limit: number; parts: NormPart[] }>;
};

const RHYTHMS: Array<Exclude<NormPeriod, 'month'>> = ['day', 'week', '2weeks'];

/** "12%", "<1%" for a tiny non-zero share. */
export function pct(part: number, whole: number): string {
  const p = whole > 0 ? Math.round((part / whole) * 100) : 0;
  return p === 0 && part > 0 ? '<1%' : `${p}%`;
}

/**
 * The tiles of the period stats: day / week / 2-week limits measured like their category rows (a weekly one on a day
 * over its whole week), the month-rhythm ones over the month so far, and what was spent outside any limit. Only
 * groups with planned categories (and 'outside' with spending).
 */
export function summaryGroups(norms: Norms, range: DayRange, totalSpent: number, today: DayKey): SummaryGroup[] {
  const cats = [...norms.byCategory].filter(([, p]) => p.kind === 'limit' && (p.monthLimit > 0 || p.periodNorm > 0));
  const out: SummaryGroup[] = [];
  for (const rhythm of RHYTHMS) {
    const group = cats.filter(([, p]) => p.rhythm === rhythm);
    if (group.length === 0) continue;
    // every category of a rhythm has the same window (it depends on the rhythm and the period only)
    const window = isPartOfWindow(group[0][1].window, range) ? group[0][1].window : undefined;
    const items = group.map(([id, p]) => ({
      id, name: p.name,
      spent: window ? p.windowSpent : p.periodSpent,
      limit: window ? p.windowNorm : p.periodNorm,
      parts: window ? p.windowParts : p.periodParts,
    }));
    const effects = group.map(([, p]) => p.effect).filter((e): e is NonNullable<typeof e> => e !== null);
    const end = window ? window.to : range.to;
    out.push({
      key: rhythm, window, end, ongoing: end >= today, items,
      spent: items.reduce((a, i) => a + i.spent, 0),
      limit: items.reduce((a, i) => a + i.limit, 0),
      change: effects.length === 0 ? null : {
        before: effects.reduce((a, e) => a + e.before, 0),
        after: effects.some((e) => e.after === null) ? null : effects.reduce((a, e) => a + e.after!, 0),
      },
    });
  }
  const monthly = cats.filter(([, p]) => p.rhythm === 'month');
  if (monthly.length > 0) {
    const items = monthly.map(([id, p]) => ({ id, name: p.name, spent: p.windowSpent, limit: p.monthLimit, parts: [] }));
    const end = `${norms.ym}-${String(daysInMonth(norms.ym)).padStart(2, '0')}`;
    out.push({
      key: 'month', window: { from: `${norms.ym}-01`, to: range.to }, end, ongoing: end >= today, items, change: null,
      spent: items.reduce((a, i) => a + i.spent, 0),
      limit: items.reduce((a, i) => a + i.limit, 0),
    });
  }
  // the period's spending in no limit: fixed payments, transfers, categories without a plan
  const inLimits = [...norms.byCategory].filter(([, p]) => p.kind === 'limit').reduce((a, [, p]) => a + p.periodSpent, 0);
  const outside = totalSpent - inLimits;
  if (outside > 0) out.push({ key: 'outside', spent: outside, limit: 0, end: range.to, ongoing: range.to >= today, change: null, items: [] });
  return out;
}
