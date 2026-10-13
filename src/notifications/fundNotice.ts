// A purchase that came straight into a fund's category (its merchant's): "−1 200 ₾ · TURKISH AIRLINES",
// "🏖 Отпуск · из копилки, осталось 0 ₾" — it is taken from what the fund saved, not from the month's budget.
import notifee, { AndroidImportance } from '@notifee/react-native';
import { getDb } from '../db';
import { categoryLabel, listCategories } from '../db/categories';
import { fundOfTransaction } from '../db/plans';
import { formatMoneyWithCurrency } from '@/shared/lib/money';
import { hideNotificationAmounts } from '../native/appLock';

/** The notice's lines; null — not a fund's operation. */
export async function fundNoticeFor(txId: number, hide: boolean): Promise<{ title: string; body: string } | null> {
  const db = await getDb();
  const tx = await db.get<{ amount_minor: number; currency: string; raw_merchant: string | null; category_id: number | null; occurred_at: number }>(
    'SELECT amount_minor, currency, raw_merchant, category_id, occurred_at FROM transactions WHERE id = ?', [txId]);
  if (!tx) return null;
  const at = await fundOfTransaction(txId, tx.category_id, tx.occurred_at);
  if (!at) return null;
  const category = (await listCategories()).find((c) => c.id === tx.category_id);
  const merchant = tx.raw_merchant || 'Операция';
  return {
    title: hide ? merchant : `−${formatMoneyWithCurrency(tx.amount_minor, tx.currency)} · ${merchant}`,
    body: `${category ? categoryLabel(category) : ''} · из копилки${hide ? '' : `, осталось ${formatMoneyWithCurrency(at.after, at.currency)}`}`,
  };
}

/** Shown on the operations' channel; false — not a fund's operation (nothing shown). Never throws. */
export async function showFundSpent(txId: number, channelId: string): Promise<boolean> {
  try {
    const notice = await fundNoticeFor(txId, await hideNotificationAmounts());
    if (!notice) return false;
    await notifee.displayNotification({
      id: `tx_${txId}`,
      ...notice,
      android: { channelId, smallIcon: 'ic_notification', importance: AndroidImportance.HIGH, pressAction: { id: 'default', launchActivity: 'default' } },
      data: { txId: String(txId), merchant_key: '' },
    });
    return true;
  } catch (e) {
    console.error('fund notice failed', e);
    return false;
  }
}
