// A fund's card: the fund, what it has, its entries, the contribution and the months left — loaded when opened.
import { useCallback, useEffect, useState } from 'react';
import { currentYm, Fund, FundEntry, fundEntries, fundLedger, getFund, monthsBetween } from '@/db/plans';
import { onTransactionsChanged } from '@/domain/events';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';

export type FundCard = { fund: Fund; saved: number; contribution: number; left: number; entries: FundEntry[] };

export function useFund(categoryId: number | null) {
  const [card, setCard] = useState<FundCard | null>(null);
  const latest = useLatestRequest();
  const { failed, started, fail } = useLoadFailed('load fund');
  const load = useCallback(() => {
    if (categoryId === null) return;
    const keep = latest();
    started();
    (async (): Promise<FundCard | null> => {
      const fund = await getFund(categoryId);
      if (!fund) return null;
      const now = currentYm();
      const { months, balance } = await fundLedger(fund, now, now);
      const current = months.find((m) => m.ym === now);
      const contribution = current?.contribution ?? 0;
      // the contributions after this month, up to the due one
      const left = Math.max(0, monthsBetween(now, fund.due.slice(0, 7)) - 1);
      return { fund, saved: balance, contribution, left, entries: await fundEntries(fund, now) };
    })().then(keep(setCard)).catch(keep(fail));
  }, [categoryId, latest, started, fail]);
  useEffect(() => { setCard(null); load(); }, [load]);
  useEffect(() => onTransactionsChanged(load), [load]);
  return { card, failed, load };
}
