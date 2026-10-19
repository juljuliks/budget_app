// A repeating payment's operations for its sheet: how many and how much, and what the operations list is filtered by —
// its merchant's (searched by the merchant's name, as its page does); one without a merchant — its category's.
import { useEffect, useState } from 'react';
import { categorySummary } from '@/db/categories';
import { getMerchant } from '@/db/merchants';
import type { PaymentTarget } from './usePaymentForm';

type Totals = Array<{ currency: string; amount_minor: number }>;
export type PaymentOperations = { summary: { count: number; totals: Totals }; filter: { query?: string; category?: number } };

async function operationsOf(target: PaymentTarget): Promise<PaymentOperations | null> {
  if (target.merchant_key) {
    const m = await getMerchant(target.merchant_key);
    return m ? { summary: { count: m.count, totals: m.totals }, filter: { query: m.name } } : null;
  }
  // a new one put in by name has none yet
  if (target.id === undefined) return null;
  return { summary: await categorySummary(target.category.id), filter: { category: target.category.id } };
}

export function usePaymentOperations(target: PaymentTarget | null): PaymentOperations | null {
  const [ops, setOps] = useState<PaymentOperations | null>(null);
  useEffect(() => {
    setOps(null);
    if (!target) return undefined;
    let live = true;
    operationsOf(target).then((r) => { if (live) setOps(r); }).catch((e) => console.error('payment operations failed', e));
    return () => { live = false; };
  }, [target]);
  return ops;
}
