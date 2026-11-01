// A fund made, changed, deleted and put back. Its contribution is a plan item: it must fit the month's budget.
import { getDb } from '../index';
import { Currency } from '../fx';
import { currentYm } from './months';
import { OverBudgetError, ownMonth, planConverter, plannedTotal, storedBudget } from './budget';
import { contributionOf, Fund, fundLedger, getFund, refreshFundItems, ymBefore } from './funds';

export type FundInput = { target_minor: number; currency: Currency; due: string; start_minor: number };

/** The fund `input` would make of the category from `ym` (a fund it is already keeps its start, unless deleted). */
async function draftFund(ym: string, categoryId: number, input: FundInput): Promise<Fund> {
  const old = await getFund(categoryId);
  const since = old && !old.closed_ym && old.since_ym < ym ? old.since_ym : ym;
  return { category_id: categoryId, ...input, since_ym: since, closed_ym: null, released_minor: null };
}

/** The month's contribution `input` would make: what is left to save over the months left, from what it has at the month's start. */
export async function fundContribution(ym: string, categoryId: number, input: FundInput, nowYm = currentYm()): Promise<number> {
  const fund = await draftFund(ym, categoryId, input);
  const saved = fund.since_ym < ym ? (await fundLedger(fund, ymBefore(ym), nowYm)).balance : fund.start_minor;
  return contributionOf(fund, ym, saved);
}

/**
 * Makes the category a fund (or changes it) from `ym`: its plan item there becomes the fund's contribution. Made anew
 * after it was deleted: starts over from `ym`. Refused (OverBudgetError) if the contribution doesn't fit the budget —
 * unless `takeLocked`: then what is short is taken from "🔒 Отложить сразу", if it has that much. Returns the contribution.
 */
export async function setFund(ym: string, categoryId: number, input: FundInput, nowYm = currentYm(), takeLocked = false): Promise<number> {
  const fund = await draftFund(ym, categoryId, input);
  const contribution = await fundContribution(ym, categoryId, input, nowYm);
  const budget = await storedBudget(ym);
  let short = 0;
  if (budget) {
    const own = (await planConverter(ym))(contribution, input.currency, budget.currency);
    const planned = (await plannedTotal(ym, categoryId, budget.currency)) + (own ?? 0);
    short = Math.max(0, planned - budget.plannable_minor);
    if (short > 0 && (!takeLocked || short > budget.locked_minor)) throw new OverBudgetError(budget.plannable_minor, planned, budget.currency);
  }
  const db = await getDb();
  await db.transaction(async (t) => {
    await t.run(
      `INSERT INTO funds (category_id, target_minor, currency, due, start_minor, since_ym, closed_ym, released_minor) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)
        ON CONFLICT(category_id) DO UPDATE SET target_minor = excluded.target_minor, currency = excluded.currency, due = excluded.due,
          start_minor = excluded.start_minor, since_ym = excluded.since_ym, closed_ym = NULL, released_minor = NULL`,
      [categoryId, input.target_minor, input.currency, input.due, input.start_minor, fund.since_ym]);
    await ownMonth(ym, t);
    if (short > 0) await t.run('UPDATE plan_months SET locked_minor = locked_minor - ? WHERE ym = ?', [short, ym]);
    await t.run(
      `INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency) VALUES (?, ?, ?, 'fund', ?)
        ON CONFLICT(ym, category_id) DO UPDATE SET limit_minor = excluded.limit_minor, kind = 'fund', currency = excluded.currency, pinned = 0`,
      [ym, categoryId, contribution, input.currency]);
  });
  // the coming months already planned: counted from the new target and date
  const later = await db.all<{ ym: string }>("SELECT ym FROM plan_items WHERE category_id = ? AND kind = 'fund' AND ym > ?", [categoryId, ym]);
  for (const m of later) await refreshFundItems(m.ym, nowYm);
  return contribution;
}

/** What a fund's deletion took: "Отменить" puts it back. */
export type DeletedFund = { fund: Fund; items: Array<{ ym: string; limit_minor: number; currency: string }>; released: number };

/**
 * Deletes the fund in the current month: what it saved up to the month before goes to this month's savings, its
 * spending from this month on is the month's as any category's, its plan items from this month on are removed.
 */
export async function deleteFund(categoryId: number, nowYm = currentYm()): Promise<DeletedFund | null> {
  const fund = await getFund(categoryId);
  if (!fund || fund.closed_ym) return null;
  const { balance } = await fundLedger({ ...fund, closed_ym: nowYm }, nowYm, nowYm);
  const db = await getDb();
  return db.transaction(async (t) => {
    const items = await t.all<{ ym: string; limit_minor: number; currency: string }>(
      'SELECT ym, limit_minor, currency FROM plan_items WHERE category_id = ? AND ym >= ?', [categoryId, nowYm]);
    await t.run('DELETE FROM plan_items WHERE category_id = ? AND ym >= ?', [categoryId, nowYm]);
    await t.run('UPDATE funds SET closed_ym = ?, released_minor = ? WHERE category_id = ?', [nowYm, balance, categoryId]);
    return { fund, items, released: balance };
  });
}

/** "Отменить" after deleting: the fund and its plan items back as they were. */
export async function restoreFund(d: DeletedFund): Promise<void> {
  const db = await getDb();
  await db.transaction(async (t) => {
    await t.run('UPDATE funds SET closed_ym = NULL, released_minor = NULL WHERE category_id = ?', [d.fund.category_id]);
    for (const i of d.items) {
      await t.run("INSERT OR REPLACE INTO plan_items (ym, category_id, limit_minor, kind, currency) VALUES (?, ?, ?, 'fund', ?)",
        [i.ym, d.fund.category_id, i.limit_minor, i.currency]);
    }
  });
}
