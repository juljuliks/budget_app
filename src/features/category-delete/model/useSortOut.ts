// Sorting out a category being deleted (from its delete sheet), in the operations list: locked to it and this month,
// grouped by merchant, always selecting; when nothing of this month is left in it — where everything went, and the delete.
import { useCallback, useEffect, useRef, useState } from 'react';
import { categoryLabel, getCategory } from '@/db/categories';
import { Bucket, categoryDeletePreview, currentIdsOfCategory, remainingInCategory, sortOutSummary } from '@/db/categoryDeletion';
import { DayRange, dayKeyOf } from '@/shared/lib/dateRange';
import { setLeaveGuard } from '@/shared/navigation/leaveGuard';
import { sheetAlert } from '@/shared/ui/sheetAlert';
import { toast, toastError } from '@/shared/ui/toast';
import { removeCategory } from '../deleteCategory';
import { sortOutDoneText, sortOutLeaveText } from '../texts';

export type SortOut<V> = { id: number; label: string; ids: number[]; month: DayRange; before: V };

type Options<V> = {
  /** the category to sort out (a route param) and its request's nonce */
  incoming: number | undefined;
  nonce: unknown;
  /** the list's view now: given back when the sort-out ends */
  current: () => V;
  /** the list locked to the category and the month */
  start: (categoryId: number, month: DayRange) => void;
  /** the view it replaced back */
  restore: (before: V) => void;
  /** ended by leaving: the selection, the filters and the route params cleared */
  clear: () => void;
  /** back to where it began (the categories) */
  goBack: () => void;
};

export function useSortOut<V>({ incoming, nonce, current, start, restore, clear, goBack }: Options<V>) {
  const [sortOut, setSortOut] = useState<SortOut<V> | null>(null);
  const ref = useRef(sortOut);
  ref.current = sortOut;
  const [remaining, setRemaining] = useState<Bucket | null>(null);
  const doneShown = useRef(false);
  // the screen's callbacks change every render: the latest ones
  const cb = useRef({ current, start, restore, clear, goBack });
  cb.current = { current, start, restore, clear, goBack };

  const refreshRemaining = useCallback(() => {
    const so = ref.current;
    if (!so) { setRemaining(null); return; }
    remainingInCategory(so.id)
      .then((b) => { if (ref.current?.id === so.id) setRemaining(b); })
      .catch((e) => console.error('remaining failed', e));
  }, []);

  useEffect(() => {
    if (incoming === undefined) return undefined;
    let live = true;
    (async () => {
      const [c, ids] = await Promise.all([getCategory(incoming), currentIdsOfCategory(incoming)]);
      if (!live || !c) return;
      const now = new Date();
      const month: DayRange = { from: dayKeyOf(new Date(now.getFullYear(), now.getMonth(), 1)), to: dayKeyOf(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
      doneShown.current = false;
      setRemaining(null);
      setSortOut({ id: c.id, label: categoryLabel(c), ids, month, before: cb.current.current() });
      cb.current.start(c.id, month);
    })().catch((e) => console.error('start sort-out failed', e));
    return () => { live = false; };
  }, [incoming, nonce]);
  useEffect(refreshRemaining, [sortOut, refreshRemaining]);

  /** Ended without a word (another way into the list): the view it replaced back. */
  const drop = useCallback(() => {
    const so = ref.current;
    if (!so) return;
    setSortOut(null);
    setRemaining(null);
    cb.current.restore(so.before);
  }, []);

  /** Ended by leaving: the view back, the selection and the filters cleared. */
  const abort = useCallback(() => {
    const so = ref.current;
    setSortOut(null);
    setRemaining(null);
    if (so) cb.current.restore(so.before);
    cb.current.clear();
  }, []);

  const leave = useCallback(() => { abort(); cb.current.goBack(); }, [abort]);

  // asks before leaving a sort-out; "Прервать" ends it and `proceed`s
  const askAbort = useCallback((proceed: () => void) => {
    const so = ref.current;
    if (!so) { proceed(); return; }
    const t = sortOutLeaveText(so.label);
    sheetAlert(t.title, t.message, [{ text: 'Продолжить', style: 'cancel' }, { text: 'Прервать', style: 'destructive', onPress: proceed }]);
  }, []);

  /** Back (the header arrow, the hardware back): without a sort-out — just back. */
  const askLeave = useCallback(() => {
    if (!ref.current) { cb.current.goBack(); return; }
    askAbort(leave);
  }, [askAbort, leave]);

  // any other way out during a sort-out (the tab bar, the gear, a day's stats) asks the same
  useEffect(() => (sortOut ? setLeaveGuard((proceed) => askAbort(() => { abort(); proceed(); })) : undefined), [sortOut, askAbort, abort]);

  // nothing left: where they went, and the delete
  useEffect(() => {
    if (!sortOut || !remaining || remaining.n > 0 || doneShown.current) return;
    doneShown.current = true;
    (async () => {
      const [summary, p] = await Promise.all([sortOutSummary(sortOut.id, sortOut.ids), categoryDeletePreview(sortOut.id)]);
      const t = sortOutDoneText(sortOut.label, summary, p);
      sheetAlert(t.title, t.message, [
        { text: 'Не удалять', style: 'cancel', onPress: () => leave() },
        {
          text: `Удалить «${sortOut.label}»`, style: 'destructive', onPress: () => {
            removeCategory(sortOut.id, null).then(() => {
              toast(`Категория «${sortOut.label}» удалена`);
              leave();
            }).catch((e) => { console.error('delete category failed', e); toastError('Не удалось удалить'); });
          },
        },
      ]);
    })().catch((e) => console.error('sort-out summary failed', e));
  }, [sortOut, remaining, leave]);

  return { sortOut, ref, remaining, refreshRemaining, drop, abort, leave, askLeave };
}
