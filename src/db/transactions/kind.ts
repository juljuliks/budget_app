// Money that came in, by its type: a deposit (income, in "Пополнение счёта") or a refund (money back for a purchase).
import { getDb } from '../index';
import { topUpCategoryId } from '../categories';
import { unsplitTransactions } from '../parts';
import { refundCategory } from '../refunds';

/** The types an incoming operation can be switched between ("Сменить тип"). */
export const INCOME_KIND_CHOICES = ['deposit', 'refund'] as const;
export type IncomeKind = typeof INCOME_KIND_CHOICES[number];

/**
 * "Сменить тип": a deposit made a refund leaves "Пополнение счёта" (no longer income) for its merchant's category
 * (refundCategory), else none; a refund made a deposit goes whole (no parts) into "Пополнение счёта". A refund settled on
 * its purchase isn't changed.
 */
export async function setTransactionKind(id: number, kind: IncomeKind) {
  const db = await getDb();
  await db.transaction(async (t) => {
    const tx = await t.get<{ kind: string; category_id: number | null; merchant_key: string | null; occurred_at: number; refund_settled_at: number | null }>(
      'SELECT kind, category_id, merchant_key, occurred_at, refund_settled_at FROM transactions WHERE id = ?', [id]);
    if (!tx || tx.kind === kind || !(INCOME_KIND_CHOICES as ReadonlyArray<string>).includes(tx.kind) || tx.refund_settled_at !== null) return;
    const topUp = await topUpCategoryId(t);
    if (kind === 'deposit') {
      await unsplitTransactions([id], t);
      await t.run("UPDATE transactions SET kind = 'deposit', category_id = ?, category_source = 'user', refund_target_id = NULL WHERE id = ?", [topUp, id]);
      return;
    }
    if (tx.category_id !== null && tx.category_id !== topUp) {
      await t.run("UPDATE transactions SET kind = 'refund' WHERE id = ?", [id]);
      return;
    }
    const category = await refundCategory(tx.merchant_key, tx.occurred_at, t);
    await t.run("UPDATE transactions SET kind = 'refund', category_id = ?, category_source = ? WHERE id = ?",
      [category, category === null ? null : 'rule', id]);
  });
}
