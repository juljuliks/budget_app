import { NormPeriod } from '../../db/plans';
import { DayKey, DayRange, daysInMonth } from '../dateRange';
import { isPartOfWindow, NormPart, Norms } from './norms';

export type SummaryGroupKey = NormPeriod | 'fixed' | 'outside';

/** One tile under the donut: the categories of one rhythm together (or the spending outside any limit). */
export type SummaryGroup = {
  key: SummaryGroupKey;
  /** the days measured when not the viewed period: the whole week of a weekly limit on a day, the month so far */
  window?: DayRange;
  spent: number;
  /** 'outside': the month's share for spending outside the plan (0 without one) */
  limit: number;
  /** 'outside' with a share: the period's own spending outside the plan (`spent` is the month's so far) */
  periodSpent?: number;
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

/** The month the period ends in, outside the plan: which categories have a plan, its spending so far and its share. */
export type UnplannedMonth = { planned: Set<number>; spent: number; share: number };

/**
 * The tiles of the period stats: day / week / 2-week limits measured like their category rows (a weekly one on a day
 * over its whole week), the month-rhythm ones and the obligatory payments over the month so far, and the spending
 * outside the plan (against its month's share, with `unplanned`). Only groups with planned categories (and 'outside'
 * with spending or a share).
 */
export function summaryGroups(norms: Norms, range: DayRange, totalSpent: number, today: DayKey, unplanned?: UnplannedMonth): SummaryGroup[] {
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
  const monthEnd = `${norms.ym}-${String(daysInMonth(norms.ym)).padStart(2, '0')}`;
  const soFar = { from: `${norms.ym}-01`, to: range.to };
  // obligatory payments: paid from the 1st up to the period's end against the month's plan
  const fixed = [...norms.byCategory].filter(([, p]) => p.kind === 'fixed' && p.monthLimit > 0);
  if (fixed.length > 0) {
    const items = fixed.map(([id, p]) => ({ id, name: p.name, spent: norms.monthToDate.get(id) ?? 0, limit: p.monthLimit, parts: [] }));
    out.push({
      key: 'fixed', window: soFar, end: monthEnd, ongoing: monthEnd >= today, items, change: null,
      spent: items.reduce((a, i) => a + i.spent, 0),
      limit: items.reduce((a, i) => a + i.limit, 0),
    });
  }
  // outside the plan: the period's spending in categories without the month's plan and without a category;
  // with the month known, against its share like a month's limit
  const isPlanned = (id: number, p: { kind: string; monthLimit: number }) => (unplanned ? unplanned.planned.has(id) : p.kind === 'fixed' || p.kind === 'limit');
  const inPlan = [...norms.byCategory].filter(([id, p]) => isPlanned(id, p)).reduce((a, [, p]) => a + p.periodSpent, 0);
  const outsidePeriod = Math.max(0, totalSpent - inPlan);
  if (unplanned && unplanned.share > 0) {
    out.push({
      key: 'outside', window: soFar, end: monthEnd, ongoing: monthEnd >= today, change: null, items: [],
      spent: unplanned.spent, limit: unplanned.share, periodSpent: outsidePeriod,
    });
  } else if (outsidePeriod > 0) {
    out.push({ key: 'outside', spent: outsidePeriod, limit: 0, end: range.to, ongoing: range.to >= today, change: null, items: [] });
  }
  return out;
}
