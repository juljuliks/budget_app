// Repeating payments made, changed, deleted; each write counts "Подписки" in the plans of this month on again.
import { getDb } from '../index';
import { Currency } from '../fx';
import { currentYm } from '../plans/months';
import { refreshRecurringItems } from '../plans/recurringItems';
import { SavingUndo, stopSaving, undoSaving } from './savingWrites';
import { subscriptionsCategoryId } from '../categories';

export type PaymentInput = {
  /** the category it is a payment of; none — the one it had (a new one: "Подписки") */
  category_id?: number | null;
  merchant_key: string | null;
  name: string;
  amount_minor: number;
  currency: Currency;
  period_months: number;
  /** null — without a day ("Пропустить": the merchant isn't asked about again) */
  due: string | null;
};

/** Makes a repeating payment (the merchant's, if it had one, is changed instead) or changes `id`; its id. */
export async function savePayment(input: PaymentInput, id?: number): Promise<number> {
  const db = await getDb();
  const own = id ?? (input.merchant_key
    ? (await db.get<{ id: number }>('SELECT id FROM recurring_payments WHERE merchant_key = ? AND deleted_at IS NULL', [input.merchant_key]))?.id
    : undefined);
  const category = input.category_id
    ?? (own !== undefined ? (await db.get<{ c: number | null }>('SELECT category_id AS c FROM recurring_payments WHERE id = ?', [own]))?.c : null)
    ?? await subscriptionsCategoryId(db);
  const values = [category, input.merchant_key, input.name.trim(), input.amount_minor, input.currency, input.period_months, input.due];
  let out: number;
  if (own !== undefined) {
    await db.run('UPDATE recurring_payments SET category_id = ?, merchant_key = ?, name = ?, amount_minor = ?, currency = ?, period_months = ?, due = ? WHERE id = ?', [...values, own]);
    out = own;
  } else {
    const r = await db.run(
      'INSERT INTO recurring_payments (category_id, merchant_key, name, amount_minor, currency, period_months, due, since_ym, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [...values, currentYm(), Math.floor(Date.now() / 1000)]);
    out = r.lastInsertRowid;
  }
  await refreshRecurringItems();
  return out;
}

/**
 * Deletes a repeating payment: its charges leave the plans of this month on (past ones stay); saved up for, what it had goes
 * to this month's savings. What "Отменить" needs to put the saving back (null — wasn't saving).
 */
export async function deletePayment(id: number): Promise<{ released: number; undo: SavingUndo } | null> {
  const stopped = await stopSaving(id);
  const db = await getDb();
  await db.run('UPDATE recurring_payments SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL', [Math.floor(Date.now() / 1000), id]);
  await refreshRecurringItems();
  return stopped;
}

/** Brings a deleted repeating payment back ("Отменить" in the toast), its saving too. */
export async function restorePayment(id: number, saving?: SavingUndo | null): Promise<void> {
  await (await getDb()).run('UPDATE recurring_payments SET deleted_at = NULL WHERE id = ?', [id]);
  if (saving) await undoSaving(saving);
  else await refreshRecurringItems();
}
