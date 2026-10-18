// Subscriptions made, changed, deleted; each write counts "Подписки" in the plans of this month on again.
import { getDb } from '../index';
import { Currency } from '../fx';
import { currentYm } from '../plans/months';
import { refreshSubscriptionItems } from '../plans/subscriptionItems';
import { SavingUndo, stopSaving, undoSaving } from './savingWrites';

export type SubscriptionInput = {
  merchant_key: string | null;
  name: string;
  amount_minor: number;
  currency: Currency;
  period_months: number;
  /** null — without a day ("Пропустить": the merchant isn't asked about again) */
  due: string | null;
};

/** Makes a subscription (the merchant's, if it had one, is changed instead) or changes `id`; its id. */
export async function saveSubscription(input: SubscriptionInput, id?: number): Promise<number> {
  const db = await getDb();
  const own = id ?? (input.merchant_key
    ? (await db.get<{ id: number }>('SELECT id FROM subscriptions WHERE merchant_key = ? AND deleted_at IS NULL', [input.merchant_key]))?.id
    : undefined);
  const values = [input.merchant_key, input.name.trim(), input.amount_minor, input.currency, input.period_months, input.due];
  let out: number;
  if (own !== undefined) {
    await db.run('UPDATE subscriptions SET merchant_key = ?, name = ?, amount_minor = ?, currency = ?, period_months = ?, due = ? WHERE id = ?', [...values, own]);
    out = own;
  } else {
    const r = await db.run(
      'INSERT INTO subscriptions (merchant_key, name, amount_minor, currency, period_months, due, since_ym, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [...values, currentYm(), Math.floor(Date.now() / 1000)]);
    out = r.lastInsertRowid;
  }
  await refreshSubscriptionItems();
  return out;
}

/**
 * Deletes a subscription: its charges leave the plans of this month on (past ones stay); saved up for, what it had goes
 * to this month's savings. What "Отменить" needs to put the saving back (null — wasn't saving).
 */
export async function deleteSubscription(id: number): Promise<{ released: number; undo: SavingUndo } | null> {
  const stopped = await stopSaving(id);
  const db = await getDb();
  await db.run('UPDATE subscriptions SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL', [Math.floor(Date.now() / 1000), id]);
  await refreshSubscriptionItems();
  return stopped;
}

/** Brings a deleted subscription back ("Отменить" in the toast), its saving too. */
export async function restoreSubscription(id: number, saving?: SavingUndo | null): Promise<void> {
  await (await getDb()).run('UPDATE subscriptions SET deleted_at = NULL WHERE id = ?', [id]);
  if (saving) await undoSaving(saving);
  else await refreshSubscriptionItems();
}
