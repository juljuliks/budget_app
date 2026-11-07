// The plan sheet's mode for its kind and, for a category with "Подписки", what "Регулярный платёж" does there.
import { openCategory } from '@/shared/navigation/navigation';
import { toast } from '@/shared/ui/toast';
import type { PlanKind } from '@/db/plans';
import { resumeSubscriptions } from '../model/commands';
import type { PlanAmountTarget } from './PlanAmountModal';
import type { RegularEvery } from './RegularFields';

/**
 * What the sheet is for its kind: a regular payment within the month (`regular`), the category's own payment (`own`);
 * a category with "Подписки" — off in the plan (`pick`: its subscriptions count again, none — made of its merchants on
 * its page) or the amount counted from them (`counted`).
 */
export function sheetMode(target: PlanAmountTarget | null, kind: PlanKind, every: RegularEvery) {
  const subs = kind === 'subs' && !!target;
  const merchants = subs && !!target?.by_merchant;
  return {
    regular: subs && !merchants && every !== 'month',
    own: subs && !merchants && every === 'month',
    pick: merchants && !target?.recurring,
    counted: merchants && !!target?.recurring && target?.kind === 'subs',
  };
}

/**
 * "Регулярный платёж" for a category with "Подписки" off in the plan: its subscriptions count again; none — the sheet
 * (and those under it) closes for its page, where they are made of its merchants ("Сделать подпиской").
 */
export async function goSubscriptions(target: PlanAmountTarget, has: boolean, leave: () => void, onSaved: () => void): Promise<null | false> {
  if (!has) { leave(); openCategory(target.category_id); return false; }
  await resumeSubscriptions(target.category_id);
  toast(`План «${target.label}» сохранён`);
  onSaved();
  return null;
}
