import React, { useEffect, useState } from 'react';
import { getPayment, paymentOfMerchant, dayOfUnix } from '@/db/recurring';
import { getTransaction } from '@/db/transactions';
import { getCategory } from '@/db/categories';
import { asCurrency } from '@/db/plans';
import type { PaymentOpen } from '@/shared/navigation/sheets';
import { LOAD_FAILED } from '@/shared/lib/strings';
import { toastFailure } from '@/shared/ui/toast';
import { PaymentCategory, PaymentTarget } from '../model/usePaymentForm';
import PaymentSheet from './PaymentSheet';

type Props = {
  /** a repeating payment, or an operation's merchant's (made from the operation if it has none); null = closed */
  which: PaymentOpen | null;
  onClose: () => void;
};

/** What `which` opens as the repeating payment's sheet: from anywhere (an operation's card, its category just set). */
async function categoryOf(id: number | null): Promise<PaymentCategory | null> {
  const c = id === null ? undefined : await getCategory(id);
  return c ? { id: c.id, name: c.name, emoji: c.emoji } : null;
}

async function targetOf(which: PaymentOpen): Promise<PaymentTarget | null> {
  if (which.id !== undefined) {
    const own = await getPayment(which.id);
    const category = own && await categoryOf(own.category_id);
    return own && category ? { ...own, category } : null;
  }
  const tx = which.txId === undefined ? null : await getTransaction(which.txId);
  if (!tx?.merchant_key) return null;
  const sub = await paymentOfMerchant(tx.merchant_key);
  // picked for a category ("Выбрать операцию"): the payment is that category's (the merchant's one moves there)
  const picked = which.categoryId !== undefined;
  // one without a day yet: its day offered from this operation
  const category = await categoryOf(picked ? which.categoryId! : sub?.category_id ?? tx.category_id);
  if (!category) return null;
  if (sub) return { ...sub, category, last_day: dayOfUnix(tx.occurred_at) };
  return {
    category, merchant_key: tx.merchant_key, name: tx.raw_merchant || tx.merchant_key, amount_minor: tx.amount_minor,
    currency: asCurrency(tx.currency), period: 1, due: null, last_day: dayOfUnix(tx.occurred_at), from_operation: !picked,
  };
}

/** The repeating payment's sheet opened through openPayment (ModalHost). */
export default function PaymentHost({ which, onClose }: Props) {
  const [target, setTarget] = useState<PaymentTarget | null>(null);
  useEffect(() => {
    if (!which) { setTarget(null); return undefined; }
    let live = true;
    targetOf(which).then((t) => { if (!live) return; if (t) setTarget(t); else onClose(); }).catch(toastFailure('load payment', LOAD_FAILED));
    return () => { live = false; };
  }, [which]); // eslint-disable-line react-hooks/exhaustive-deps
  return <PaymentSheet target={target} onClose={onClose} onSaved={which?.onSaved} />;
}
