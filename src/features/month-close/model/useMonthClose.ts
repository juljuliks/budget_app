// "Итоги месяца" of `ym`: its steps, sums and answers, loaded when opened and again after each answer (an answer
// changes the sums: the overspend's cover changes what 🔒 keeps, the leftover moved isn't asked about).
import { useCallback, useEffect, useState } from 'react';
import { answerClose, CloseAnswers, finishClose, MonthClose, monthClose, setSplit } from '@/db/plans';
import { emitTransactionsChanged, onTransactionsChanged } from '@/domain/events';
import { SAVE_FAILED } from '@/shared/lib/strings';
import { useLatestRequest } from '@/shared/lib/useLatestRequest';
import { useLoadFailed } from '@/shared/lib/useLoadFailed';
import { toastFailure } from '@/shared/ui/toast';

export function useMonthClose(ym: string | null) {
  const [close, setClose] = useState<MonthClose | null>(null);
  const latest = useLatestRequest();
  const { failed, started, fail } = useLoadFailed('load month close');
  const load = useCallback(() => {
    if (!ym) return;
    const keep = latest();
    started();
    monthClose(ym).then(keep(setClose)).catch(keep(fail));
  }, [ym, latest, started, fail]);
  useEffect(() => { setClose(null); load(); }, [load]);
  useEffect(() => (ym ? onTransactionsChanged(load) : undefined), [ym, load]);

  // an answer changes the plan's months too (the funds, the carry): every screen counts again
  const saved = () => emitTransactionsChanged();
  /** "Изменить распределение": the funds' parts by hand */
  const split = (parts: Array<{ category_id: number; minor: number }>): Promise<void> => (ym
    ? setSplit(ym, parts).then(saved).catch(toastFailure('set split', SAVE_FAILED)) : Promise.resolve());
  const answer = (patch: Partial<CloseAnswers>): Promise<void> => (ym
    ? answerClose(ym, patch).then(saved).catch(toastFailure('answer close', SAVE_FAILED)) : Promise.resolve());
  /** closes the month; true — closed (every question answered) */
  const finish = async (): Promise<boolean> => {
    if (!ym) return false;
    try {
      const done = await finishClose(ym);
      saved();
      return done;
    } catch (e) {
      toastFailure('finish close', SAVE_FAILED)(e);
      return false;
    }
  };
  return { close, failed, load, split, answer, finish };
}
