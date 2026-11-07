// «В плане» on a category's page: the category (its kind), what its regular payment or fund is set to, re-read on any change.
import { useCallback, useEffect, useState } from 'react';
import { Category, getCategory, isSystemCategory, isTransferCategory } from '@/db/categories';
import { currentYm, getFund, getPlanItemBasics } from '@/db/plans';
import { categoryPayment } from '@/db/recurring';
import { onTransactionsChanged } from '@/domain/events';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { fundSummary, paymentSummary, withinMonthSummary } from '../texts';

export type KindData = {
  category: Category;
  /** "🏖 Отпуск" */
  label: string;
  /** what its set kind is set to ("650 $ · каждый месяц"); null — nothing yet */
  summary: string | null;
  /** this month's item of it (a regular payment's sheet starts from it) */
  item: Awaited<ReturnType<typeof getPlanItemBasics>>;
};

async function summaryOf(c: Category, item: KindData['item']): Promise<string | null> {
  if (c.plan_kind === 'fund') {
    const f = await getFund(c.id);
    return f && !f.closed_ym ? fundSummary(f.target_minor, f.currency, f.due) : null;
  }
  if (c.plan_kind !== 'regular') return null;
  const own = await categoryPayment(c.id);
  if (own) return paymentSummary(own);
  return item?.every ? withinMonthSummary(item.every, item.weekdays ?? 0, item.unit_minor ?? 0, item.currency) : null;
}

/** null while loading or for a category without a kind of its own (a system or a transfer one). */
export function useKindData(categoryId: number) {
  const [data, setData] = useState<KindData | null>(null);
  const latest = useLatestRequest();
  const load = useCallback(() => {
    const keep = latest();
    (async (): Promise<KindData | null> => {
      const c = await getCategory(categoryId);
      if (!c || isSystemCategory(c) || isTransferCategory(c)) return null;
      const item = await getPlanItemBasics(currentYm(), categoryId);
      return { category: c, label: `${c.emoji || ''} ${c.name}`.trim(), summary: await summaryOf(c, item), item };
    })().then(keep(setData)).catch(keep((e: unknown) => console.error('load category kind failed', e)));
  }, [categoryId, latest]);
  useEffect(() => { load(); return onTransactionsChanged(load); }, [load]);
  return data;
}
