// A fund made (on its category's page), changed, deleted and put back. Its contribution is a plan item of each month,
// fitted to the month's budget by itself (fundFit.ts): nothing is refused.
import { getDb } from '../index';
import { Currency } from '../fx';
import { currentYm } from './months';
import { ownMonth } from './budget';
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
 * Makes the category a fund (or changes it) from `ym`: its plan item there becomes the fund's contribution, as the
 * month's budget fits it (no question: what is free, then 🔒, the rest in the next months). Made anew after it was
 * deleted: starts over from `ym`. A fund's purchases are planned: "Импульсивные покупки" off.
 */
export async function setFund(ym: string, categoryId: number, input: FundInput, nowYm = currentYm()): Promise<void> {
  const fund = await draftFund(ym, categoryId, input);
  const db = await getDb();
  await db.transaction(async (t) => {
    await t.run(
      `INSERT INTO funds (category_id, target_minor, currency, due, start_minor, since_ym, closed_ym, released_minor) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)
        ON CONFLICT(category_id) DO UPDATE SET target_minor = excluded.target_minor, currency = excluded.currency, due = excluded.due,
          start_minor = excluded.start_minor, since_ym = excluded.since_ym, closed_ym = NULL, released_minor = NULL`,
      [categoryId, input.target_minor, input.currency, input.due, input.start_minor, fund.since_ym]);
    await t.run('UPDATE categories SET impulse = 0 WHERE id = ?', [categoryId]);
    await ownMonth(ym, t);
    await t.run(
      `INSERT INTO plan_items (ym, category_id, limit_minor, kind, currency) VALUES (?, ?, 0, 'fund', ?)
        ON CONFLICT(ym, category_id) DO UPDATE SET kind = 'fund', currency = excluded.currency, pinned = 0`,
      [ym, categoryId, input.currency]);
  });
  // this month and the coming ones already planned: counted from the new target and date, fitted again
  const later = await db.all<{ ym: string }>("SELECT ym FROM plan_items WHERE category_id = ? AND kind = 'fund' AND ym >= ? ORDER BY ym DESC LIMIT 1", [categoryId, ym]);
  await refreshFundItems(later[0]?.ym ?? ym, nowYm);
}

/** What a fund's deletion took: "Отменить" puts it back. */
export type DeletedFund = { fund: Fund; items: Array<{ ym: string; limit_minor: number; currency: string; taken_minor: number }>; released: number };

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
    const items = await t.all<{ ym: string; limit_minor: number; currency: string; taken_minor: number }>(
      'SELECT ym, limit_minor, currency, taken_minor FROM plan_items WHERE category_id = ? AND ym >= ?', [categoryId, nowYm]);
    // what its contributions took from 🔒 goes back there ("MAX" follows by itself)
    for (const i of items.filter((x) => x.taken_minor > 0)) {
      await t.run('UPDATE plan_months SET locked_minor = locked_minor + ? WHERE ym = ? AND locked_is_max = 0', [i.taken_minor, i.ym]);
    }
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
  // fitted again (🔒 got back what they took)
  const last = d.items.reduce((a, i) => (i.ym > a ? i.ym : a), '');
  if (last) await refreshFundItems(last);
}
