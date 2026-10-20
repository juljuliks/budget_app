// Picking an operation for a category's repeating payment: a tap makes the payment from it (its merchant, amount and day),
// saved — back to where it was picked for. Only spending with a merchant: the next charges are the merchant's.
import { EXPENSE_KINDS } from '@/db/spending';
import type { TransactionRow } from '@/db/transactions';
import { openPayment } from '@/shared/navigation/sheets';
import { toastError } from '@/shared/ui/toast';
import { PICK_NO_MERCHANT, PICK_NOT_SPENDING } from '../texts';

export function pickPaymentFrom(tx: TransactionRow, categoryId: number, onSaved: () => void) {
  if (!(EXPENSE_KINDS as readonly string[]).includes(tx.kind)) toastError(PICK_NOT_SPENDING);
  else if (!tx.merchant_key) toastError(PICK_NO_MERCHANT);
  else openPayment({ txId: tx.id, categoryId, onSaved });
}
