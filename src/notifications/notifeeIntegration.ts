// Helper integration points for notifee notifications.
import notifee, { AndroidImportance } from '@notifee/react-native';
import { buildCategorySuggestions } from './notifyHelper';
import { isMixedMerchant } from '../categorize';
import { merchantCategories } from '../db/merchants';
import { isRememberable } from '../types';
import { categoryLabel, isTopUp, listCategories, topCategories } from '../db/categories';
import { getDb } from '../db';
import { assignCategory } from '../assign';
import { openTransaction } from '../sheets';
import { KIND_LABELS } from '@/shared/lib/format';
import { formatMoneyWithCurrency } from '@/shared/lib/money';
import { limitAlertFor } from '../limitAlerts';
import { REPORT_ACTION } from './monthReportNotice';

export const CHANNEL_ID = 'transactions';
/** «Лимиты»: a category near / over its plan or its rhythm's limit (src/limitAlerts.ts) */
export const LIMITS_CHANNEL_ID = 'limits';
const LIMITS_ACTION = 'limits';
export const ALL_CATEGORIES_ACTION = 'all_categories';
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

  // a merchant of different categories (a delivery: groceries or meals) offers the ones it had, then the usual ones
  const mixed = !!tx.merchant_key && isRememberable(tx.kind) && await isMixedMerchant(tx.merchant_key);
  const own = mixed ? (await merchantCategories(tx.merchant_key!, MAX_ACTIONS - 1)) : [];
  const suggestions = [...own, ...(await buildCategorySuggestions(tx.kind, MAX_ACTIONS - 1)).filter((s) => !own.some((o) => o.id === s.id))]
    .slice(0, MAX_ACTIONS - 1);
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
    body: mixed ? `${tx.raw_merchant || tx.merchant_key} · выберите категорию` : tx.raw_merchant || ' ',
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

/**
 * A deposit, put in "Пополнение счёта": "Пополнение — 200 ₾ → 💳 Пополнение счёта", the sender below; the buttons move it
 * to a transfer category (a person paying back: subtracted from what was sent them), the most used first, and
 * "К категориям" opens it. Nothing is remembered for the sender.
 */
export async function showDepositNotification(txId: number) {
  const db = await getDb();
  const tx = await db.get<{ amount_minor: number; currency: string; raw_merchant: string | null; category_id: number | null }>(
    "SELECT amount_minor, currency, raw_merchant, category_id FROM transactions WHERE id = ? AND kind = 'deposit'", [txId]);
  if (!tx) return;
  const category = (await listCategories()).find((c) => c.id === tx.category_id);
  const transfers = (await topCategories(10_000)).filter((c) => c.type_is_transfer === 1 && !isTopUp(c)).slice(0, MAX_ACTIONS - 1);
  const actions: Array<{ title: string; pressAction: { id: string; launchActivity?: string } }> = transfers.map((s) => ({
    title: categoryLabel(s),
    pressAction: { id: `suggest_${s.id}` },
  }));
  actions.push({ title: '➡️ К категориям', pressAction: { id: ALL_CATEGORIES_ACTION, launchActivity: 'default' } });
  await notifee.displayNotification({
    id: `tx_${txId}`,
    title: `Пополнение — ${formatMoneyWithCurrency(tx.amount_minor, tx.currency)}${category ? ` → ${categoryLabel(category)}` : ''}`,
    body: tx.raw_merchant || ' ',
    android: {
      channelId: CHANNEL_ID,
      smallIcon: 'ic_notification',
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default', launchActivity: 'default' },
      actions,
    },
    data: { txId: String(txId), merchant_key: '' },
  });
}

/**
 * A refund whose merchant has no category: money back, counted in the stats as "Возвраты без категории". Just
 * news, no buttons; tapping it opens the operation (a category can be picked there).
 */
async function showRefundNotification(txId: number, tx: { amount_minor: number; currency: string; raw_merchant: string | null }) {
  await notifee.displayNotification({
    id: `tx_${txId}`,
    title: `Возврат — ${formatMoneyWithCurrency(tx.amount_minor, tx.currency)}`,
    body: tx.raw_merchant ? `${tx.raw_merchant} · без категории` : 'Без категории',
    android: {
      channelId: CHANNEL_ID,
      smallIcon: 'ic_notification',
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default', launchActivity: 'default' },
    },
    data: { txId: String(txId), merchant_key: '' },
  });
}

/**
 * After an operation of this month got `categoryId` (an SMS with the merchant's category, a category picked in a
 * notification or in the app, a manual operation): a notification if the category just reached 80% / 100% of its
 * limit. Never throws: a failed check must not break what triggered it.
 */
export async function showLimitAlert(categoryId: number | null) {
  if (categoryId === null) return;
  try {
    const alert = await limitAlertFor(categoryId);
    if (!alert) return;
    await notifee.displayNotification({
      // one per category: a newer one replaces it
      id: `limit_${categoryId}`,
      title: alert.title,
      body: alert.body,
      android: {
        channelId: LIMITS_CHANNEL_ID,
        smallIcon: 'ic_notification',
        pressAction: { id: LIMITS_ACTION, launchActivity: 'default' },
      },
      data: { kind: 'limit', categoryId: String(categoryId) },
    });
  } catch (e) {
    console.error('limit alert failed', e);
  }
}

type ActionEvent = {
  id?: string;
  notification?: { id?: string; data?: Record<string, string | number | object> };
};

// Called from foreground/background notifee handlers and for the notification that launched the app
export async function handleNotificationAction(event: ActionEvent) {
  const { id } = event;
  // a limit notification: the stats (required here: the navigation isn't loaded in the headless SMS task)
  if (id === LIMITS_ACTION) {
    const { navigateWhenReady } = require('../navigation') as typeof import('../navigation');
    navigateWhenReady({ name: 'Main', params: { screen: 'Stats' } } as never);
    return;
  }
  // the month's report: the stats with the report over them
  if (id === REPORT_ACTION) {
    const ym = String(event.notification?.data?.ym ?? '');
    const { navigateWhenReady } = require('../navigation') as typeof import('../navigation');
    navigateWhenReady({ name: 'Main', params: { screen: 'Stats' } } as never);
    if (ym) require('../sheets').openMonthReport(ym);
    return;
  }
  const txId = Number(event.notification?.data?.txId);
  if (!txId || !id) return;

  if (id.startsWith('suggest_')) {
    const categoryId = Number(id.slice('suggest_'.length));
    await assignCategory(txId, categoryId);
    await showLimitAlert(categoryId);
  } else if (id === 'default' || id === ALL_CATEGORIES_ACTION || id === LEGACY_CREATE_CATEGORY_ACTION) {
    openTransaction(txId);
    return; // keep the notification until a category is chosen
  } else {
    return;
  }

  if (event.notification?.id) await notifee.cancelNotification(event.notification.id);
}

export default { showUncategorizedTransactionNotification, showDepositNotification, showLimitAlert, handleNotificationAction };
