// The month's report: its impulsive purchases ("Импульсивные покупки") — how many of the answered, what pushed to them,
// each category's against its plan.
import { Currency } from './fx';
import { impulseRows } from './impulseStats';
import { monthRange, parseYm } from './plans';
import type { CategoryStat } from './plans/stats';
import { impulseByCategory, impulseSummary, ImpulseSummary } from '../stats/impulse';

/** A category with impulsive purchases this month. */
export type ImpulseCategory = {
  id: number; name: string; emoji: string | null; type_name: string | null;
  answered: number; impulsive: number; impulsiveSum: number;
  /** null — not in the month's plan («без плана»); 0 — within it; > 0 — its overspend */
  over: number | null;
};

export type MonthImpulse = ImpulseSummary & { categories: ImpulseCategory[] };

/**
 * null — nothing answered this month (no block). `categories`: the month's stats' (names, plan, spending); `overOf`: a
 * planned one's overspend as the report counts it (0 within its plan, the noise tolerated).
 */
export async function monthImpulse(ym: string, currency: Currency, categories: CategoryStat[], overOf: (c: CategoryStat) => number):
  Promise<MonthImpulse | null> {
  const { year, month } = parseYm(ym);
  const [from, to] = monthRange(year, month);
  const rows = await impulseRows(from, to, currency);
  const summary = impulseSummary(rows);
  if (summary.answered === 0) return null;
  const list: ImpulseCategory[] = [];
  for (const [id, c] of impulseByCategory(rows)) {
    const stat = categories.find((s) => s.category_id === id);
    if (!stat || c.impulsive.count === 0) continue;
    list.push({
      id, name: stat.name, emoji: stat.emoji, type_name: stat.type_name,
      answered: c.answered, impulsive: c.impulsive.count, impulsiveSum: c.impulsive.sum,
      over: stat.limit_minor === null ? null : overOf(stat),
    });
  }
  list.sort((a, b) => b.impulsiveSum - a.impulsiveSum);
  return { ...summary, categories: list };
}
