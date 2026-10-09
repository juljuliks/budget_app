// The operation the sheet shows, and its merchant's category or categories; reloaded on any change while open.
import { useCallback, useEffect, useState } from 'react';
import { getTransaction } from '@/db/transactions';
import { categoryLabel, getCategory } from '@/db/categories';
import { merchantCategories } from '@/db/merchants';
import { findCategoryForMerchant, isMixedMerchant } from '@/categorize';
import { isRememberable } from '@/types';
import { onTransactionsChanged } from '@/events';
import { markSeen } from '@/entities/transaction';

export type Tx = NonNullable<Awaited<ReturnType<typeof getTransaction>>>;

export function useTransaction(txId: number, visible: boolean) {
  const [tx, setTx] = useState<Tx | null>(null);
  // the merchant's category (its rule): new transactions of the merchant get it automatically
  const [merchantCategory, setMerchantCategory] = useState<string | null>(null);
  // a merchant of different categories: the ones its operations had (picked with a tap)
  const [mixedCats, setMixedCats] = useState<Array<{ id: number; label: string }> | null>(null);

  const load = useCallback(async () => {
    const t = await getTransaction(txId);
    setTx(t ?? null);
    const rule = t?.merchant_key && isRememberable(t.kind) ? await findCategoryForMerchant(t.merchant_key) : null;
    const c = rule ? await getCategory(rule.category_id) : undefined;
    setMerchantCategory(c ? categoryLabel(c) : null);
    const mixed = t?.merchant_key && isRememberable(t.kind) && await isMixedMerchant(t.merchant_key);
    setMixedCats(mixed ? (await merchantCategories(t!.merchant_key!, 50)).map((x) => ({ id: x.id, label: categoryLabel(x) })) : null);
    return t;
  }, [txId]);

  const reload = useCallback(() => {
    load().catch((e) => console.error('load transaction failed', e));
  }, [load]);

  // on open: what it is now; opening it marks it read (list dot, tab badge)
  useEffect(() => {
    if (!visible) return;
    setTx(null);
    (async () => {
      const t = await load();
      if (t && t.seen_at === null) await markSeen(txId);
    })().catch((e) => console.error('load transaction failed', e));
  }, [visible, txId, load]);
  // while open: a category or a merchant changed elsewhere (the category sheet, a merchant's card)
  useEffect(() => (visible ? onTransactionsChanged(reload) : undefined), [visible, reload]);

  return { tx, merchantCategory, mixedCats, reload };
}
