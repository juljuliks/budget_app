import React, { useEffect, useState } from 'react';
import { getSubscription, subscriptionOfMerchant, dayOfUnix } from '@/db/subscriptions';
import { getTransaction } from '@/db/transactions';
import { asCurrency } from '@/db/plans';
import { LOAD_FAILED } from '@/shared/lib/strings';
import { toastFailure } from '@/shared/ui/toast';
import { SubscriptionTarget } from '../model/useSubscriptionForm';
import SubscriptionSheet from './SubscriptionSheet';

type Props = {
  /** a subscription, or an operation's merchant's (made from the operation if it has none); null = closed */
  which: { id?: number; txId?: number } | null;
  onClose: () => void;
};

/** What `which` opens as the subscription's sheet: from anywhere (an operation's card, its category just set). */
async function targetOf(which: { id?: number; txId?: number }): Promise<SubscriptionTarget | null> {
  if (which.id !== undefined) return getSubscription(which.id);
  const tx = which.txId === undefined ? null : await getTransaction(which.txId);
  if (!tx?.merchant_key) return null;
  const sub = await subscriptionOfMerchant(tx.merchant_key);
  // one without a day yet: its day offered from this operation
  if (sub) return { ...sub, last_day: dayOfUnix(tx.occurred_at) };
  return {
    merchant_key: tx.merchant_key, name: tx.raw_merchant || tx.merchant_key, amount_minor: tx.amount_minor,
    currency: asCurrency(tx.currency), period_months: 1, due: null, last_day: dayOfUnix(tx.occurred_at), from_operation: true,
  };
}

/** The subscription's sheet opened through openSubscription (ModalHost). */
export default function SubscriptionHost({ which, onClose }: Props) {
  const [target, setTarget] = useState<SubscriptionTarget | null>(null);
  useEffect(() => {
    if (!which) { setTarget(null); return undefined; }
    let live = true;
    targetOf(which).then((t) => { if (!live) return; if (t) setTarget(t); else onClose(); }).catch(toastFailure('load subscription', LOAD_FAILED));
    return () => { live = false; };
  }, [which]); // eslint-disable-line react-hooks/exhaustive-deps
  return <SubscriptionSheet target={target} onClose={onClose} />;
}
