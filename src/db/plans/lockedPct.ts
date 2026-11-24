// A new % of «🔒 Отложить сразу» in the settings: the months it applies to counted anew.
import { getDb } from '../index';
import { setSetting } from '../settings';
import { currentYm } from './months';
import { plannedTotal, storedBudget } from './budget';
import { refreshFundItems } from './funds';
import { LOCKED_PCT_KEY, relockMonth } from './locked';

/**
 * Saves the % and applies it at once to the current and coming months and to the past ones not closed yet («Итоги
 * месяца» not done; a closed one keeps the % it had). What is set aside in all doesn't change, only how it is split: less
 * — the rest goes to «Сэкономлено»; more — 🔒 grows by what is free in the plan, never past it (the plan stays in the budget).
 */
export async function setLockedPct(pct: number, nowYm = currentYm()): Promise<void> {
  const db = await getDb();
  const months = (
    await db.all<{ ym: string }>(
      `SELECT ym FROM plan_months WHERE ym >= ? OR ym NOT IN (SELECT ym FROM month_closes WHERE closed_at IS NOT NULL) ORDER BY ym`,
      [nowYm],
    )
  ).map((m) => m.ym);
  await db.transaction(async (t) => {
    await setSetting(LOCKED_PCT_KEY, String(pct), t);
    for (const ym of months) {
      await t.run('UPDATE plan_months SET locked_pct = ? WHERE ym = ?', [pct, ym]);
      // the funds are fitted again below: what they took is 🔒's again
      if (ym >= nowYm) await t.run("UPDATE plan_items SET taken_minor = 0 WHERE ym = ? AND kind = 'fund'", [ym]);
      await relockMonth(ym, t);
    }
  });
  for (const ym of months) {
    // the funds fit anew: what is free first, then 🔒
    if (ym >= nowYm) await refreshFundItems(ym, nowYm);
    await fitIntoBudget(ym);
  }
}

/** 🔒 no more than the plan leaves: what is planned past the budget comes off it. */
async function fitIntoBudget(ym: string): Promise<void> {
  const budget = await storedBudget(ym);
  if (!budget || budget.locked_minor <= 0) return;
  const over = (await plannedTotal(ym, undefined, budget.currency)) - budget.plannable_minor;
  if (over <= 0) return;
  const db = await getDb();
  await db.run('UPDATE plan_months SET locked_minor = ? WHERE ym = ?', [Math.max(0, budget.locked_minor - over), ym]);
}
