import { useCallback, useEffect, useState } from 'react';
import type { Currency } from '@/db/fx';
import { MonthReport, monthReport } from '@/db/report';
import { categoryLabel, listCategories } from '@/db/categories';
import { currentYm, fundForecasts, ymBefore } from '@/db/plans';
import { useDisplayCurrency } from '@/shared/settings/displayCurrency';
import { onTransactionsChanged } from '@/domain/events';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';

/** A fund not making it by its date, said on the report's «Отложено»: its category's page opens from it. */
export type LateFund = { id: number; label: string; due: string };

/** The funds not making it now: for the report of the month just over (they are about the coming months). */
async function lateFunds(ym: string): Promise<LateFund[]> {
  if (ym !== ymBefore(currentYm())) return [];
  const late = [...(await fundForecasts()).values()].filter((f) => f.status !== 'ok');
  if (!late.length) return [];
  const cats = await listCategories();
  return late.map((f) => {
    const c = cats.find((x) => x.id === f.category_id);
    return { id: f.category_id, label: c ? categoryLabel(c) : '', due: f.due };
  });
}

/**
 * The report of `ym` (null = none yet), reloaded when operations or plans change; `failed` with `load` to try again.
 * In `shown` (a report's page: the currency picked), else the system one.
 */
export function useMonthReport(ym: string | null, shown?: Currency) {
  const system = useDisplayCurrency();
  const currency = shown ?? system;
  const [report, setReport] = useState<MonthReport | null>(null);
  const [late, setLate] = useState<LateFund[]>([]);
  const latest = useLatestRequest();
  const { failed, started, fail } = useLoadFailed('load month report');
  const load = useCallback(() => {
    // answers of a report closed or switched meanwhile are dropped
    const keep = latest();
    started();
    if (!ym) return;
    monthReport(ym, currency).then(keep(setReport)).catch(keep(fail));
    lateFunds(ym).then(keep(setLate)).catch((e) => console.error('load late funds failed', e));
  }, [ym, currency, latest, started, fail]);
  useEffect(() => {
    setReport(null);
    load();
    return ym ? onTransactionsChanged(load) : undefined;
  }, [ym, load]);
  return { report, late, failed, load };
}
