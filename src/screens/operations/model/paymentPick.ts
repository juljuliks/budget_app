// Picking an operation for a category's subscription: a tap makes the subscription from it (its merchant, amount and day),
// saved — back to where it was picked for. Only purchases with a merchant: the next charges are the merchant's (a
// transfer is a regular payment of the plan, not a subscription). One of
// another category: asked whether it (and its merchant) moves to the payment's one, else spending and charges part.
import { assignCategory } from '@/categorize/assign';
import { EXPENSE_KINDS } from '@/db/spending';
import { isRememberable } from '@/domain/types';
import type { TransactionRow } from '@/db/transactions';
import { emitTransactionsChanged } from '@/domain/events';
import { SAVE_FAILED } from '@/shared/lib/strings';
import { openPayment } from '@/shared/navigation/sheets';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toastError, toastFailure } from '@/shared/ui/toast';
import { pickMoveText, PICK_NO_MERCHANT, PICK_NOT_SPENDING, PICK_TRANSFER } from '../texts';

export function pickPaymentFrom(tx: TransactionRow, pick: { id: number; label: string }, onSaved: () => void) {
  if (!(EXPENSE_KINDS as readonly string[]).includes(tx.kind)) { toastError(PICK_NOT_SPENDING); return; }
  // a merchant's payment is its purchases: a transfer (rent, a class) is paid by the category's spending
  if (!isRememberable(tx.kind)) { toastError(PICK_TRANSFER); return; }
  if (!tx.merchant_key) { toastError(PICK_NO_MERCHANT); return; }
  const open = () => openPayment({ txId: tx.id, categoryId: pick.id, onSaved });
  if (tx.category_id === pick.id) { open(); return; }
  const from = tx.category_id === null ? 'Без категории' : `${tx.category_emoji ?? ''} ${tx.category_name ?? ''}`.trim();
  const t = pickMoveText(from, pick.label, tx.raw_merchant || tx.merchant_key);
  sheetAlert(t.title, t.message, [
    { text: 'Отмена', style: 'cancel' },
    { text: t.keep, onPress: open },
    {
      text: t.move,
      onPress: () => {
        assignCategory(tx.id, pick.id, 'merchant').then(() => { emitTransactionsChanged(); open(); }).catch(toastFailure('move picked operation', SAVE_FAILED));
      },
    },
  ]);
}
