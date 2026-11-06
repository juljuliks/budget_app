// Impulsive purchases counted: of the answers, how many and how much was impulsive, what pushed to it, where and when.
// A purchase counts once (a split one's parts together); a category's — the parts in it.
import type { ImpulseRow } from '../db/impulseStats';

/** Below this many answers a category's dynamics says "Для анализа нужно 10 ответов" instead. */
export const MIN_ANSWERS = 10;
/** A category's dynamics counts the answers of this many months, the current one included. */
export const IMPULSE_MONTHS = 3;
/** "Где чаще импульсивно": merchants with at least this many answers, this many at most */
const MERCHANT_MIN_ANSWERS = 2;
const TOP_MERCHANTS = 3;

export type Tally = { count: number; sum: number };

export type ImpulseSummary = {
  /** purchases asked about or answered */
  asked: number;
  answered: number;
  impulsive: Tally;
  intentional: Tally;
  /** what pushed to the impulsive ones, the most often first (those with an answer) */
  moods: Array<{ mood: string; count: number; sum: number }>;
};

const tally = (): Tally => ({ count: 0, sum: 0 });

/** The parts of each purchase together: one per operation. */
function byTx(rows: ImpulseRow[]): ImpulseRow[] {
  const m = new Map<number, ImpulseRow>();
  for (const r of rows) {
    const had = m.get(r.tx);
    m.set(r.tx, had ? { ...had, value: had.value + r.value } : r);
  }
  return [...m.values()];
}

export function impulseSummary(rows: ImpulseRow[]): ImpulseSummary {
  const impulsive = tally();
  const intentional = tally();
  const moods = new Map<string, Tally>();
  const txs = byTx(rows);
  for (const r of txs) {
    if (r.impulse === null) continue;
    const t = r.impulse ? impulsive : intentional;
    t.count++; t.sum += r.value;
    if (r.impulse && r.mood) {
      const m = moods.get(r.mood) ?? tally();
      m.count++; m.sum += r.value;
      moods.set(r.mood, m);
    }
  }
  return {
    asked: txs.length,
    answered: impulsive.count + intentional.count,
    impulsive,
    intentional,
    moods: [...moods].map(([mood, t]) => ({ mood, ...t })).sort((a, b) => b.count - a.count || b.sum - a.sum),
  };
}

/** Each category's impulsive purchases (its parts of them): how many of the answered, for how much. */
export function impulseByCategory(rows: ImpulseRow[]): Map<number, { answered: number; impulsive: Tally }> {
  const m = new Map<number, { answered: number; impulsive: Tally }>();
  for (const r of rows) {
    if (r.category === null || r.impulse === null) continue;
    const c = m.get(r.category) ?? { answered: 0, impulsive: tally() };
    c.answered++;
    if (r.impulse) { c.impulsive.count++; c.impulsive.sum += r.value; }
    m.set(r.category, c);
  }
  return m;
}

/** The impulsive share of each month's answers ('YYYY-MM' → 0..1), months with answers only, oldest first. */
export function impulseByMonth(rows: ImpulseRow[]): Array<{ ym: string; share: number }> {
  const m = new Map<string, { answered: number; impulsive: number }>();
  for (const r of byTx(rows)) {
    if (r.impulse === null) continue;
    const ym = r.day.slice(0, 7);
    const c = m.get(ym) ?? { answered: 0, impulsive: 0 };
    c.answered++;
    if (r.impulse) c.impulsive++;
    m.set(ym, c);
  }
  return [...m].sort(([a], [b]) => (a < b ? -1 : 1)).map(([ym, c]) => ({ ym, share: c.impulsive / c.answered }));
}

/** "Где чаще импульсивно": the merchants with impulsive purchases, the biggest share first. */
export function impulseMerchants(rows: ImpulseRow[]): Array<{ key: string | null; name: string; impulsive: number; answered: number }> {
  const m = new Map<string, { key: string | null; name: string; impulsive: number; answered: number }>();
  for (const r of byTx(rows)) {
    if (r.impulse === null || !r.merchant) continue;
    const id = r.merchantKey ?? r.merchant;
    const c = m.get(id) ?? { key: r.merchantKey, name: r.merchant, impulsive: 0, answered: 0 };
    c.answered++;
    if (r.impulse) c.impulsive++;
    m.set(id, c);
  }
  return [...m.values()]
    .filter((c) => c.impulsive > 0 && c.answered >= MERCHANT_MIN_ANSWERS)
    .sort((a, b) => b.impulsive / b.answered - a.impulsive / a.answered || b.impulsive - a.impulsive)
    .slice(0, TOP_MERCHANTS);
}
