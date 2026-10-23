// The operation the sheet shows, and its merchant's category or categories; reloaded on any change while open.
import { useCallback, useEffect, useState } from 'react';
import { getTransaction } from '@/db/transactions';
import { categoryLabel, getCategory } from '@/db/categories';
import { merchantCategories } from '@/db/merchants';
import { findCategoryForMerchant, isMixedMerchant } from '@/categorize/rules';
import { isRememberable } from '@/domain/types';
import { onTransactionsChanged } from '@/domain/events';
import { markSeen } from '@/entities/transaction';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';

export type Tx = NonNullable<Awaited<ReturnType<typeof getTransaction>>>;

export function useTransaction(txId: number, visible: boolean) {
  // undefined = loading; null = not there (deleted, opened from an old notification)
  const [tx, setTx] = useState<Tx | null | undefined>(undefined);
  const { failed, started, fail } = useLoadFailed('load transaction');
  // the merchant's category (its rule): new transactions of the merchant get it automatically
  const [merchantCategory, setMerchantCategory] = useState<string | null>(null);
  // a merchant of different categories: the ones its operations had (taps toggle; one is saved, two open the split)
  const [mixedCats, setMixedCats] = useState<Array<{ id: number; label: string }> | null>(null);

  const load = useCallback(async () => {
    const t = await getTransaction(txId);
    // gone while open (deleted from this sheet: it slides away): the last one stays on screen
    setTx((prev) => t ?? (prev === undefined ? null : prev));
    // a refund is not remembered, but a merchant of different categories still offers its list on the refund
    const key = t?.merchant_key && (isRememberable(t.kind) || t.kind === 'refund') ? t.merchant_key : null;
    const rule = key && t && isRememberable(t.kind) ? await findCategoryForMerchant(key) : null;
    const c = rule ? await getCategory(rule.category_id) : undefined;
    setMerchantCategory(c ? categoryLabel(c) : null);
    const mixed = !!key && await isMixedMerchant(key);
    setMixedCats(mixed ? (await merchantCategories(key, 50)).map((x) => ({ id: x.id, label: categoryLabel(x) })) : null);
    return t;
  }, [txId]);

  const reload = useCallback(() => {
    started();
    load().catch(fail);
  }, [load, started, fail]);

  // on open: what it is now; opening it marks it read (list dot, tab badge)
  useEffect(() => {
    if (!visible) return;
    setTx(undefined);
    started();
    (async () => {
      const t = await load();
      if (t && t.seen_at === null) await markSeen(txId);
    })().catch(fail);
  }, [visible, txId, load, started, fail]);
  // while open: a category or a merchant changed elsewhere (the category sheet, a merchant's card)
  useEffect(() => (visible ? onTransactionsChanged(reload) : undefined), [visible, reload]);

  return { tx, merchantCategory, mixedCats, reload, failed };
}
