// Helper integration points for notifee notifications.
import notifee, { AndroidImportance } from '@notifee/react-native';
import { buildCategorySuggestions } from './notifyHelper';
import { categoryLabel } from '../db/categories';
import { getDb } from '../db';
import { assignCategory } from '../assign';
import { navigateWhenReady } from '../navigation';
import { KIND_LABELS } from '../ui/format';
import { formatMoneyWithCurrency } from '../ui/money';

export const CHANNEL_ID = 'transactions';
export const ALL_CATEGORIES_ACTION = 'all_categories';
export const REFUND_ACTION = 'refund_resolve';
// shown on notifications posted by older versions; handled like ALL_CATEGORIES_ACTION
const LEGACY_CREATE_CATEGORY_ACTION = 'create_new';
// Android shows at most 3 action buttons; the last one is always "all categories"
const MAX_ACTIONS = 3;

export async function showUncategorizedTransactionNotification(txId: number) {
  const db = await getDb();
  const tx = await db.get<{ kind: string; amount_minor: number; currency: string; raw_merchant: string | null; merchant_key: string | null }>(
    'SELECT kind, amount_minor, currency, raw_merchant, merchant_key FROM transactions WHERE id = ? AND category_id IS NULL', [txId]);
  if (!tx) return;

  if (tx.kind === 'refund') {
    await showRefundNotification(txId, tx);
    return;
  }

  const suggestions = await buildCategorySuggestions(tx.kind, MAX_ACTIONS - 1);
  const actions: Array<{ title: string; pressAction: { id: string; launchActivity?: string } }> = suggestions.map((s) => ({
    title: categoryLabel(s),
    pressAction: { id: `suggest_${s.id}` },
  }));
  // "➡️ К категориям": the transaction with the full category list (a new category can be created there too)
  actions.push({ title: '➡️ К категориям', pressAction: { id: ALL_CATEGORIES_ACTION, launchActivity: 'default' } });

  await notifee.displayNotification({
    // one notification per transaction; re-showing replaces instead of stacking
    id: `tx_${txId}`,
    // "Перевод — 25.00 ₾" / "Оплата — 25.69 ₾", the merchant or person below when known
    title: `${KIND_LABELS[tx.kind] ?? 'Операция'} — ${formatMoneyWithCurrency(tx.amount_minor, tx.currency)}`,
    body: tx.raw_merchant || ' ',
    android: {
      channelId: CHANNEL_ID,
      smallIcon: 'ic_notification',
      importance: AndroidImportance.HIGH,
      // tapping the notification body opens the transaction
      pressAction: { id: 'default', launchActivity: 'default' },
      actions,
    },
    data: { txId: String(txId), merchant_key: tx.merchant_key || '' },
  });
}

/** A refund doesn't get a category: it is settled on its purchase (RefundResolve). */
async function showRefundNotification(txId: number, tx: { amount_minor: number; currency: string; raw_merchant: string | null }) {
  await notifee.displayNotification({
    id: `tx_${txId}`,
    title: `Возврат — ${formatMoneyWithCurrency(tx.amount_minor, tx.currency)}`,
    body: tx.raw_merchant ? `${tx.raw_merchant}: найдите покупку и уменьшите её сумму` : 'Найдите покупку и уменьшите её сумму',
    android: {
      channelId: CHANNEL_ID,
      smallIcon: 'ic_notification',
      importance: AndroidImportance.HIGH,
      pressAction: { id: REFUND_ACTION, launchActivity: 'default' },
      actions: [{ title: '🔎 Найти покупку', pressAction: { id: REFUND_ACTION, launchActivity: 'default' } }],
    },
    data: { txId: String(txId), merchant_key: '' },
  });
}

type ActionEvent = {
  id?: string;
  notification?: { id?: string; data?: Record<string, string | number | object> };
};

// Called from foreground/background notifee handlers and for the notification that launched the app
export async function handleNotificationAction(event: ActionEvent) {
  const { id } = event;
  const txId = Number(event.notification?.data?.txId);
  if (!txId || !id) return;

  if (id === REFUND_ACTION) {
    navigateWhenReady({ name: 'RefundResolve', params: { refundId: txId } });
    return; // RefundResolve removes the notification once the refund is settled
  }
  if (id.startsWith('suggest_')) {
    await assignCategory(txId, Number(id.slice('suggest_'.length)));
  } else if (id === 'default' || id === ALL_CATEGORIES_ACTION || id === LEGACY_CREATE_CATEGORY_ACTION) {
    navigateWhenReady({ name: 'TransactionDetail', params: { txId } });
    return; // keep the notification until a category is chosen
  } else {
    return;
  }

  if (event.notification?.id) await notifee.cancelNotification(event.notification.id);
}

export default { showUncategorizedTransactionNotification, handleNotificationAction };
