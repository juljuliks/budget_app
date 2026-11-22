// «🔒 Отложить сразу»: a % of the month's budget, set in the settings (Настройки → Бюджет). Each month keeps its own %
// (plan_months.locked_pct; null — an amount of its own: a past month, or no % set) and what was taken from 🔒 this month
// (locked_taken_minor — for the plan and the repeating payments; a fund's share is its item's taken_minor). Its 🔒
// (locked_minor) is the % of the budget less what was taken.
import { getDb } from '../index';
import type { Db } from '../types';
import { getSetting } from '../settings';

export const LOCKED_PCT_KEY = 'locked_pct';

/** The % set in the settings; null — not set (not the same as 0%). */
export async function lockedPctSetting(db?: Db): Promise<number | null> {
  const v = await getSetting(LOCKED_PCT_KEY, db);
  const n = v === null || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 🔒 of `budget` at `pct`%. */
export const lockedByPct = (budget: number, pct: number) => Math.round((budget * pct) / 100);

/** What the month's funds took from 🔒 this month, in the budget's currency. */
export async function fundsTaken(ym: string, db: Db): Promise<number> {
  return (await db.get<{ t: number | null }>("SELECT sum(taken_minor) AS t FROM plan_items WHERE ym = ? AND kind = 'fund'", [ym]))?.t ?? 0;
}

/**
 * The month's 🔒 by its %: the % of its budget less what was taken this month (the funds' too). A month without a % or a
 * budget keeps what it has. Returns the new 🔒 (null — not by a %).
 */
export async function relockMonth(ym: string, db?: Db): Promise<number | null> {
  db ??= await getDb();
  const m = await db.get<{ budget: number | null; pct: number | null; taken: number }>(
    'SELECT budget_minor AS budget, locked_pct AS pct, locked_taken_minor AS taken FROM plan_months WHERE ym = ?', [ym]);
  if (!m || m.budget === null || m.pct === null) return null;
  const locked = Math.max(0, lockedByPct(m.budget, m.pct) - m.taken - await fundsTaken(ym, db));
  await db.run('UPDATE plan_months SET locked_minor = ? WHERE ym = ?', [locked, ym]);
  return locked;
}
