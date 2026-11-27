import { getDb } from '../index';
import { currentYm, deleteFund, monthStart } from '../plans';
import { moveParts } from '../parts';
import { deletePayment } from '../recurring/writes';
import { placeholders } from '../sql';
import { incrementCategoryUsage } from './queries';

/** Transactions of the category from the current month on (those a delete would move); a split one's part in it. */
export async function currentTransactionsOfCategory(id: number, nowYm = currentYm()) {
  const db = await getDb();
  const from = monthStart(nowYm);
  return db.all<{
    id: number;
    amount_minor: number;
    currency: string;
    kind: string;
    raw_merchant: string | null;
    occurred_at: number;
  }>(
    `SELECT id, amount_minor, currency, kind, raw_merchant, occurred_at FROM spend_parts
      WHERE category_id = ? AND occurred_at >= ? ORDER BY occurred_at DESC`,
    [id, from],
  );
}

export async function countPastTransactionsOfCategory(id: number, nowYm = currentYm()): Promise<number> {
  const db = await getDb();
  const from = monthStart(nowYm);
  return (await db.get<{ n: number }>(
    'SELECT count(*) AS n FROM spend_parts WHERE category_id = ? AND occurred_at < ?',
    [id, from],
  ))!.n;
}

/**
 * Deletes a category from the current month on. Its transactions of the current month (and later)
 * move to `targetId` (or become uncategorized), merchant rules follow them; past months keep the
 * category so history doesn't change. A category with no past trace is removed completely.
 */
export async function deleteCategory(id: number, targetId: number | null, nowYm = currentYm()) {
  const db = await getDb();
  if ((await db.get<{ system: string | null }>('SELECT system FROM categories WHERE id = ?', [id]))?.system) {
    throw new Error('a system category cannot be deleted');
  }
  const from = monthStart(nowYm);
  // a fund: closed first, what it saved goes to this month's savings; its repeating payments too
  await deleteFund(id, nowYm);
  for (const p of await db.all<{ id: number }>(
    'SELECT id FROM recurring_payments WHERE category_id = ? AND deleted_at IS NULL',
    [id],
  )) {
    await deletePayment(p.id);
  }
  await db.transaction(async (tx) => {
    // the past stays in it: its operations there that follow a merchant are fixed, so the merchant moving on
    // (below, or later) doesn't take them along
    await tx.run(
      "UPDATE transactions SET category_source = 'user' WHERE category_id = ? AND occurred_at < ? AND category_source = 'rule'",
      [id, from],
    );
    // a rule-picked one keeps following its merchant (whose rule moves along below), a hand-picked one stays so;
    // none = no source
    await tx.run(
      `UPDATE transactions SET category_id = ?, category_source = CASE WHEN ? IS NULL THEN NULL ELSE category_source END
        WHERE category_id = ? AND occurred_at >= ?`,
      [targetId, targetId, id, from],
    );
    // parts of split operations in it go along
    await moveParts(tx, [id], targetId, 't.occurred_at >= ?', [from]);
    if (targetId === null) {
      await tx.run('DELETE FROM merchant_rules WHERE category_id = ?', [id]);
    } else {
      await tx.run('UPDATE merchant_rules SET category_id = ? WHERE category_id = ?', [targetId, id]);
      await tx.run('UPDATE OR IGNORE merchant_categories SET category_id = ? WHERE category_id = ?', [targetId, id]);
    }
    await tx.run('DELETE FROM merchant_categories WHERE category_id = ?', [id]);
    await tx.run('DELETE FROM plan_items WHERE category_id = ? AND ym >= ?', [id, nowYm]);
    await tx.run('DELETE FROM category_usage WHERE category_id = ?', [id]);

    const pastTx =
      (await tx.get('SELECT 1 FROM transactions WHERE category_id = ? LIMIT 1', [id])) ??
      (await tx.get('SELECT 1 FROM transaction_parts WHERE category_id = ? LIMIT 1', [id]));
    const pastPlan = await tx.get('SELECT 1 FROM plan_items WHERE category_id = ? LIMIT 1', [id]);
    if (pastTx || pastPlan) {
      await tx.run('UPDATE categories SET deleted_at = ? WHERE id = ?', [Math.floor(Date.now() / 1000), id]);
    } else {
      await tx.run('DELETE FROM categories WHERE id = ?', [id]);
    }
  });
}

/**
 * Deleting a category, step by step: these transactions (of the category being deleted) move to `toId`
 * (null = none), and their merchants' rules pointing to the deleted category follow them.
 */
export async function moveTransactionsOutOfCategory(txIds: number[], fromId: number, toId: number | null) {
  if (txIds.length === 0) return;
  const db = await getDb();
  const marks = placeholders(txIds.length);
  await db.transaction(async (tx) => {
    const keys = (
      await tx.all<{ k: string }>(
        `SELECT DISTINCT merchant_key AS k FROM transactions
        WHERE id IN (${marks}) AND category_id = ? AND merchant_key IS NOT NULL`,
        [...txIds, fromId],
      )
    ).map((r) => r.k);
    // a rule-picked one keeps following its merchant (whose rule moves along); none = no source
    await tx.run(
      `UPDATE transactions SET category_id = ?, category_source = CASE WHEN ? IS NULL THEN NULL ELSE category_source END
        WHERE id IN (${marks}) AND category_id = ?`,
      [toId, toId, ...txIds, fromId],
    );
    await moveParts(tx, [fromId], toId, `t.id IN (${marks})`, txIds);
    if (keys.length > 0) {
      const keyMarks = placeholders(keys.length);
      if (toId === null) {
        await tx.run(
          `DELETE FROM merchant_rules WHERE category_id = ? AND match_type = 'exact' AND pattern IN (${keyMarks})`,
          [fromId, ...keys],
        );
      } else {
        await tx.run(
          `UPDATE merchant_rules SET category_id = ? WHERE category_id = ? AND match_type = 'exact' AND pattern IN (${keyMarks})`,
          [toId, fromId, ...keys],
        );
      }
    }
  });
  if (toId !== null) await incrementCategoryUsage(toId);
}
