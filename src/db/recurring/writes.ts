// Repeating payments made, changed, deleted; each write counts "Подписки" in the plans of this month on again.
import { getDb } from '../index';
import { Currency } from '../fx';
import { currentYm } from '../plans/months';
import { refreshRecurringItems } from '../plans/recurringItems';
import { SavingUndo, stopSaving, undoSaving } from './savingWrites';
import { setByMerchant, subscriptionsCategoryId } from '../categories';
import { periodColumns } from './period';
import type { Period } from './schedule';
import { RecurringUndo, turnRecurring, undoRecurring } from './recurring';

export type PaymentInput = {
  /** the category it is a payment of; none — the one it had (a new one: "Подписки") */
  category_id?: number | null;
  /** the merchant it is made from (an operation's: a subscription); null — the category's own regular payment */
  merchant_key: string | null;
  name: string;
  amount_minor: number;
  currency: Currency;
  /** schedule.ts Period */
  period: Period;
  /** null — without a day ("Пропустить": the merchant isn't asked about again) */
  due: string | null;
  /** "Дата окончания": no charges after it */
  until?: string | null;
};

/**
 * Makes a repeating payment (the merchant's, if it had one, is changed instead) or changes `id`; its id. Its category's
 * repeating payments go on (an operation picked for a category's first one).
 */
export async function savePayment(input: PaymentInput, id?: number): Promise<number> {
  const db = await getDb();
  // the merchant's one, or the category's own: changed, not another made
  const own = id ?? (input.merchant_key
    ? (await db.get<{ id: number }>('SELECT id FROM recurring_payments WHERE merchant_key = ? AND deleted_at IS NULL', [input.merchant_key]))?.id
    : input.category_id ? (await db.get<{ id: number }>('SELECT id FROM recurring_payments WHERE category_id = ? AND merchant_key IS NULL AND deleted_at IS NULL', [input.category_id]))?.id : undefined);
  const category = input.category_id
    ?? (own !== undefined ? (await db.get<{ c: number | null }>('SELECT category_id AS c FROM recurring_payments WHERE id = ?', [own]))?.c : null)
    ?? await subscriptionsCategoryId(db);
  const values = [category, input.merchant_key, input.name.trim(), input.amount_minor, input.currency, ...periodColumns(input.period), input.due, input.until ?? null];
  let out: number;
  if (own !== undefined) {
    await db.run('UPDATE recurring_payments SET category_id = ?, merchant_key = ?, name = ?, amount_minor = ?, currency = ?, period_months = ?, period_unit = ?, due = ?, until = ? WHERE id = ?', [...values, own]);
    out = own;
  } else {
    const r = await db.run(
      'INSERT INTO recurring_payments (category_id, merchant_key, name, amount_minor, currency, period_months, period_unit, due, until, since_ym, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [...values, currentYm(), Math.floor(Date.now() / 1000)]);
    out = r.lastInsertRowid;
  }
  // a subscription: the category has "Подписки" — its own payment (if it had one) goes now, not when the operation was
  // only being picked (cancelled, it stays)
  if (typeof category === 'number' && input.merchant_key) {
    await setByMerchant(category, true, db);
    const owns = await db.all<{ id: number }>('SELECT id FROM recurring_payments WHERE category_id = ? AND merchant_key IS NULL AND deleted_at IS NULL', [category]);
    for (const o of owns) await deletePayment(o.id);
  }
  if (typeof category === 'number') await turnRecurring(category, true);
  else await refreshRecurringItems();
  return out;
}

/** What "Отменить" needs after deleting a payment: its saving (null — wasn't saving), its category's repeating payments turned off. */
export type DeletedPayment = { saving: { released: number; undo: SavingUndo } | null; off: RecurringUndo | null };

/**
 * Deletes a repeating payment: its charges leave the plans of this month on (past ones stay); saved up for, what it had goes
 * to this month's savings. Its category's last one (but a category with "Подписки": they stay on with none): the
 * category's repeating payments go off — its plan item stays a one-off payment with the amount it had.
 */
export async function deletePayment(id: number): Promise<DeletedPayment> {
  const saving = await stopSaving(id);
  const db = await getDb();
  await db.run('UPDATE recurring_payments SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL', [Math.floor(Date.now() / 1000), id]);
  const c = (await db.get<{ c: number | null }>('SELECT category_id AS c FROM recurring_payments WHERE id = ?', [id]))?.c ?? null;
  const left = c === null ? null : await db.get('SELECT 1 FROM recurring_payments WHERE category_id = ? AND deleted_at IS NULL', [c]);
  const on = c !== null && !!(await db.get('SELECT 1 FROM categories WHERE id = ? AND recurring = 1 AND by_merchant = 0', [c]));
  if (c !== null && on && !left) return { saving, off: await turnRecurring(c, false) };
  await refreshRecurringItems();
  return { saving, off: null };
}

/** Brings a deleted repeating payment back ("Отменить" in the toast), its saving and its category's repeating payments too. */
export async function restorePayment(id: number, deleted?: DeletedPayment | null): Promise<void> {
  await (await getDb()).run('UPDATE recurring_payments SET deleted_at = NULL WHERE id = ?', [id]);
  if (deleted?.off) await undoRecurring(deleted.off);
  if (deleted?.saving) await undoSaving(deleted.saving.undo);
  else await refreshRecurringItems();
}

/**
 * "Подписки" of a category turned on or off on its page. Its repeating payments go off first (what they saved goes to
 * this month's savings, its plan items keep their amount by hand), then the payments of the other kind are deleted — on:
 * its own regular payment; off: its subscriptions. A subscription saved later turns its repeating payments on again.
 */
export async function setSubscriptions(categoryId: number, on: boolean): Promise<void> {
  const db = await getDb();
  if (await db.get('SELECT 1 FROM categories WHERE id = ? AND recurring = 1', [categoryId])) await turnRecurring(categoryId, false);
  await db.run(`UPDATE recurring_payments SET deleted_at = ? WHERE category_id = ? AND deleted_at IS NULL AND merchant_key IS ${on ? '' : 'NOT '}NULL`,
    [Math.floor(Date.now() / 1000), categoryId]);
  await setByMerchant(categoryId, on, db);
}
