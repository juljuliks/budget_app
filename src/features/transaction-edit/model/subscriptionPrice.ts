// An operation put in "📺 Подписки" by hand, for a merchant whose subscription costs another amount: asked whether the
// subscription now costs this ("Обновить подписку") or the pick was a mistake ("Отмена" — the previous category back).
import { assignCategory } from '@/categorize/assign';
import { Currency, dateKey } from '@/db/fx';
import { paymentCard, savePayment, subscriptionCategoryOf } from '@/db/recurring';
import { emitTransactionsChanged } from '@/domain/events';
import { formatWithCurrency } from '@/shared/lib/money';
import { SAVE_FAILED } from '@/shared/lib/strings';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastFailure } from '@/shared/ui/toast';
import { subscriptionPriceText } from '../texts';
import type { Tx } from './useTransaction';

/** true — asked (the merchant has a subscription and this amount isn't its). */
export async function askSubscriptionPrice(tx: Tx, previousCategoryId: number | null): Promise<boolean> {
  if (!tx.merchant_key) return false;
  const card = await paymentCard(tx.merchant_key);
  if (!card) return false;
  if (await subscriptionCategoryOf(tx.merchant_key, tx.amount_minor, tx.currency, dateKey(tx.occurred_at))) return false;
  const { sub } = card;
  const t = subscriptionPriceText(sub.name, formatWithCurrency(sub.amount_minor, sub.currency), formatWithCurrency(tx.amount_minor, tx.currency),
    tx.currency !== sub.currency ? null : tx.amount_minor > sub.amount_minor);
  sheetAlert(t.title, t.message, [
    {
      text: 'Отмена', style: 'cancel',
      onPress: () => { assignCategory(tx.id, previousCategoryId, 'only').then(emitTransactionsChanged).catch(toastFailure('revert category', SAVE_FAILED)); },
    },
    {
      text: 'Обновить подписку',
      onPress: () => {
        savePayment({ ...sub, amount_minor: tx.amount_minor, currency: tx.currency as Currency }, sub.id)
          .then(() => { emitTransactionsChanged(); toast(`${sub.name} — ${formatWithCurrency(tx.amount_minor, tx.currency)}`); })
          .catch(toastFailure('update payment', SAVE_FAILED));
      },
    },
  ]);
  return true;
}
