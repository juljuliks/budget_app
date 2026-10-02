// Helper integration points for notifee notifications.
import notifee, { AndroidImportance } from '@notifee/react-native';
import { buildCategorySuggestions } from './notifyHelper';
import { getDb } from '../db';
import { assignCategory } from '../assign';
import { navigateWhenReady } from '../navigation';

export const CHANNEL_ID = 'transactions';
export const CREATE_CATEGORY_ACTION = 'create_new';
// Android shows at most 3 action buttons; the last one is always "new category"
const MAX_ACTIONS = 3;

export async function showUncategorizedTransactionNotification(txId: number) {
  const db = await getDb();
  const tx = await db.get<{ kind: string; amount_minor: number; currency: string; raw_merchant: string | null; merchant_key: string | null }>(
    'SELECT kind, amount_minor, currency, raw_merchant, merchant_key FROM transactions WHERE id = ? AND category_id IS NULL', [txId]);
  if (!tx) return;

  const suggestions = await buildCategorySuggestions(tx.kind, MAX_ACTIONS - 1);
  const actions: Array<{ title: string; pressAction: { id: string; launchActivity?: string } }> = suggestions.map((s) => ({
    title: `${s.emoji || ''} ${s.name}`.trim(),
    pressAction: { id: `suggest_${s.id}` },
  }));
  // opens the app on the category editor
  actions.push({ title: '➕ Новая категория', pressAction: { id: CREATE_CATEGORY_ACTION, launchActivity: 'default' } });

  await notifee.displayNotification({
    // one notification per transaction; re-showing replaces instead of stacking
    id: `tx_${txId}`,
    title: `${tx.kind === 'transfer' ? 'Перевод' : 'Новая транзакция'} — ${(tx.amount_minor / 100).toFixed(2)} ${tx.currency}`,
    body: tx.raw_merchant || 'Без мерчанта',
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

type ActionEvent = {
  id?: string;
  notification?: { id?: string; data?: Record<string, string | number | object> };
};

// Called from foreground/background notifee handlers and for the notification that launched the app
export async function handleNotificationAction(event: ActionEvent) {
  const { id } = event;
  const txId = Number(event.notification?.data?.txId);
  if (!txId || !id) return;

  if (id.startsWith('suggest_')) {
    await assignCategory(txId, Number(id.slice('suggest_'.length)));
  } else if (id === CREATE_CATEGORY_ACTION) {
    navigateWhenReady({ name: 'CategoryEdit', params: { txId } });
  } else if (id === 'default') {
    navigateWhenReady({ name: 'TransactionDetail', params: { txId } });
    return; // keep the notification until a category is chosen
  } else {
    return;
  }

  if (event.notification?.id) await notifee.cancelNotification(event.notification.id);
}

export default { showUncategorizedTransactionNotification, handleNotificationAction };
