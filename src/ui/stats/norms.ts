import { currentYm, monthStats, NormPeriod, parseYm, periodStats, PlanKind } from '../../db/plans';
import { DayKey, DayRange, daysByMonth, daysInMonth, normWindow, rangeDays, rangeToUnix } from '../dateRange';

/** One month's share of a norm: its plan / days in it × the days that fall into it (0 when it has no plan). */
export type NormPart = { ym: string; days: number; dim: number; limit: number; norm: number };

/**
 * Norms for a period. Every day gets its own month's plan / days in that month, so a period or a rhythm window
 * across two months (a week from Sep 28 to Oct 4) is counted by both plans; a month where the category has no plan
 * counts as 0. The share of the month's plan and the colors are about the month the period ends in.
 */
export type Norms = {
  /** the month the period ends in: 'YYYY-MM' */
  ym: string;
  /** the flexible categories' norm for the period (fixed and month-rhythm ones aren't split by days) */
  total: number;
  /** their spending in the period */
  flexSpent: number;
  /** those categories, for the explanation */
  flex: Array<{ id: number; name: string; parts: NormPart[]; norm: number; spent: number }>;
  byCategory: Map<number, {
    kind: PlanKind;
    /** the plan for the month the period ends in (0 if none) */
    monthLimit: number;
    /** spending in the period's part in that month (for the share of the month's plan) */
    spent: number;
    /** the norm checked over the category's own rhythm window (see normWindow), across months if it spans two */
    rhythm: NormPeriod; window: DayRange; windowParts: NormPart[]; windowNorm: number; windowSpent: number;
  }>;
  /** spending from the 1st of the month up to the period's end: can a period's overspend still fit the month? */
  monthToDate: Map<number | null, number>;
};

export async function loadNorms(range: DayRange, currency: Parameters<typeof monthStats>[2]): Promise<Norms> {
  const ym = range.to.slice(0, 7);
  const monthStart = `${ym}-01`;
  const thisYm = currentYm();
  const spentIn = async (r: DayRange) => {
    const u = rangeToUnix(r);
    return new Map((await periodStats(u.from, u.to, currency)).categories.map((c) => [c.category_id, c.spent_minor]));
  };
  const spentCache = new Map<string, Map<number | null, number>>();
  const spentOver = async (r: DayRange) => {
    const key = `${r.from}|${r.to}`;
    if (!spentCache.has(key)) spentCache.set(key, await spentIn(r));
    return spentCache.get(key)!;
  };

  // each month's plan (converted), cached; a month that hasn't started isn't read (that would create its plan)
  type Item = { name: string; limit: number; kind: PlanKind; rhythm: NormPeriod };
  const plans = new Map<string, Map<number, Item>>();
  const planOf = async (m: string) => {
    if (!plans.has(m)) {
      const items = new Map<number, Item>();
      if (m <= thisYm) {
        const { year, month } = parseYm(m);
        for (const c of (await monthStats(year, month, currency)).categories) {
          if (c.category_id === null || !c.limit_minor) continue;
          items.set(c.category_id, { name: `${c.emoji || ''} ${c.name}`.trim(), limit: c.limit_minor, kind: c.plan_kind ?? 'limit', rhythm: c.plan_norm ?? 'day' });
        }
      }
      plans.set(m, items);
    }
    return plans.get(m)!;
  };
  const partsOf = async (id: number, r: DayRange): Promise<NormPart[]> => {
    const out: NormPart[] = [];
    for (const [m, days] of daysByMonth(r)) {
      const limit = (await planOf(m)).get(id)?.limit ?? 0;
      const dim = daysInMonth(m);
      out.push({ ym: m, days, dim, limit, norm: (limit * days) / dim });
    }
    return out;
  };
  const sum = (parts: NormPart[]) => parts.reduce((a, p) => a + p.norm, 0);

  // the categories planned in any month of the period; kind and rhythm from the latest of them
  const months = [...daysByMonth(range).keys()];
  const items = new Map<number, Item>();
  for (const m of months) for (const [id, item] of await planOf(m)) items.set(id, item);

  const lastPlan = await planOf(ym);
  const periodSpent = await spentOver(range);
  const partSpent = await spentOver({ from: range.from > monthStart ? range.from : monthStart, to: range.to });
  const norms: Norms = {
    ym, total: 0, flexSpent: 0, flex: [], byCategory: new Map(),
    monthToDate: await spentOver({ from: monthStart, to: range.to }),
  };
  for (const [id, { name, kind, rhythm }] of items) {
    // the overall pace under the donut: per day, without fixed and month-rhythm categories (one-off buys)
    if (kind === 'limit' && rhythm !== 'month') {
      const parts = await partsOf(id, range);
      const spent = periodSpent.get(id) ?? 0;
      norms.flex.push({ id, name, parts, norm: sum(parts), spent });
      norms.total += sum(parts);
      norms.flexSpent += spent;
    }
    const monthLimit = lastPlan.get(id)?.limit ?? 0;
    const win = normWindow(rhythm, range);
    const windowParts = rhythm === 'month' ? [] : await partsOf(id, win);
    norms.byCategory.set(id, {
      kind, monthLimit, spent: partSpent.get(id) ?? 0, rhythm, window: win, windowParts,
      windowNorm: rhythm === 'month' ? monthLimit : sum(windowParts),
      windowSpent: (await spentOver(win)).get(id) ?? 0,
    });
  }
  return norms;
}

export type Pace = 'ok' | 'ahead' | 'over';

/**
 * ok: within the plan for these days. ahead: over it, but the month so far still fits the month's plan (can be
 * made up later). over: the month's plan is already exceeded.
 */
export function paceOf(spent: number, norm: number, monthToDate: number, monthLimit: number): Pace {
  if (spent <= norm) return 'ok';
  return monthToDate <= monthLimit ? 'ahead' : 'over';
}

/**
 * A flexible category's bar over its own rhythm: the week / two weeks / month the norm is about, not the viewed
 * period. `ratio` — spent of the norm in that window, `base` — the part spent before the viewed period (faded),
 * `marker` — how much of the window has passed by the period's end (where an even pace would be),
 * `end` — the window's last day when it goes on after the viewed period ("до вс").
 */
export function rhythmBar(
  plan: { rhythm: NormPeriod; window: DayRange; windowNorm: number; windowSpent: number },
  viewed: DayRange, viewedSpent: number,
): { ratio: number; base: number; marker?: number; end?: DayKey } {
  const { rhythm, window: win, windowNorm: norm, windowSpent: spent } = plan;
  // a month's norm is the whole month, its window only the days so far
  const span: DayRange = rhythm === 'month'
    ? { from: win.from, to: `${win.from.slice(0, 7)}-${String(daysInMonth(win.from.slice(0, 7))).padStart(2, '0')}` }
    : win;
  const total = rangeDays(span);
  const passed = rangeDays({ from: span.from, to: viewed.to < span.to ? viewed.to : span.to });
  const of = (v: number) => (norm > 0 ? v / norm : v > 0 ? 1 : 0);
  return {
    ratio: of(spent),
    base: of(Math.max(0, spent - Math.min(viewedSpent, spent))),
    marker: total > 1 ? passed / total : undefined,
    end: span.to > viewed.to ? span.to : undefined,
  };
}
