// The operation page's writes: each one tells the screens (the plan, the stats) the data changed.
import { setPaymentAnswer } from '@/db/recurring';
import { emitTransactionsChanged } from '@/domain/events';
import { SAVE_FAILED } from '@/shared/lib/strings';
import { toastFailure } from '@/shared/ui/toast';

/** "Это оплата?" answered for the operation in its category (null — taken back, asked again). */
export function answerPayment(txId: number, categoryId: number, isPayment: boolean | null) {
  setPaymentAnswer(txId, categoryId, isPayment).then(emitTransactionsChanged).catch(toastFailure('answer payment', SAVE_FAILED));
}
