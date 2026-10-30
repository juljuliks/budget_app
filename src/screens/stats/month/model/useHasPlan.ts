// Whether a month has a plan (a budget or an amount), reloaded with the data and on focus: «Изменить план» or «Составить план».
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { hasMonthPlan } from '@/db/report';
import { onTransactionsChanged } from '@/domain/events';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';

/** null — not known yet */
export function useHasPlan(ym: string): boolean | null {
  const [has, setHas] = useState<boolean | null>(null);
  const latest = useLatestRequest();
  const load = useCallback(() => {
    const keep = latest();
    hasMonthPlan(ym).then(keep(setHas)).catch((e) => console.error('load has plan failed', e));
  }, [ym, latest]);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);
  return has;
}
