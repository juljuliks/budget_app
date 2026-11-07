// «В плане» on a category's page: the kind picked, what the page's bottom button does for it, the setup sheet open.
import { useEffect, useRef, useState } from 'react';
import type { CategoryPlanKind } from '@/db/plans';
import { SETUP } from '../texts';
import { leaveRegular, saveCategoryKind } from './commands';
import { useKindData } from './useKindData';

/** The kinds set up in a sheet: a regular payment (its amount, how often), a fund (how much by when). */
export type KindSetup = 'regular' | 'fund';
const needsSetup = (k: CategoryPlanKind | null): k is KindSetup => k === 'regular' || k === 'fund';

type Deps = {
  /** a fund's category given another kind: "Выключить копилку?" — `done` once it is off */
  fundOff: (label: string, done: () => void) => void;
};

/**
 * Another kind picked: a limit or a one-off payment — «Сохранить» saves it (and the page's fields); a regular payment
 * or a fund — «Настроить» opens its sheet, saved there (then the page's fields). What the kind left had is turned off
 * once the new one is saved: the fund (asked), the regular payments (asked if they saved something).
 */
export function useCategoryKind(categoryId: number, deps: Deps) {
  const data = useKindData(categoryId);
  const saved = data?.category.plan_kind ?? null;
  const [picked, setPicked] = useState<CategoryPlanKind | null>(saved);
  useEffect(() => { setPicked(saved); }, [saved]);
  const [setup, setSetup] = useState<KindSetup | null>(null);
  // the page's save (its fields changed) and the kind left, for after the setup
  const after = useRef<{ save: (() => void) | null; from: CategoryPlanKind | null }>({ save: null, from: null });

  const leave = (from: CategoryPlanKind | null, to: CategoryPlanKind, next: () => void) => {
    if (!data || from === to) { next(); return; }
    if (from === 'fund') { deps.fundOff(data.label, next); return; }
    if (from === 'regular') { leaveRegular(categoryId, !!data.category.recurring).then((ok) => { if (ok) next(); }); return; }
    next();
  };

  const changed = !!data && picked !== null && picked !== saved;
  const submit = !changed || !data || picked === null ? undefined : needsSetup(picked)
    ? { title: SETUP, onPress: (save: (() => void) | null) => { after.current = { save, from: saved }; setSetup(picked); } }
    : {
      title: 'Сохранить',
      onPress: (save: (() => void) | null) => leave(saved, picked, () => {
        saveCategoryKind(categoryId, picked, data.label).then((ok) => { if (ok) save?.(); });
      }),
    };

  return {
    data,
    picked,
    pick: setPicked,
    submit,
    setup,
    /** «Изменить ›» of the kind set: its sheet again */
    edit: () => { if (needsSetup(saved)) { after.current = { save: null, from: saved }; setSetup(saved); } },
    closeSetup: () => setSetup(null),
    /** the setup saved: what the kind left had off, then the page's fields */
    setupSaved: () => {
      const { save, from } = after.current;
      const to = setup;
      setSetup(null);
      if (to) leave(from, to, () => save?.());
    },
  };
}

export type CategoryKind = ReturnType<typeof useCategoryKind>;
