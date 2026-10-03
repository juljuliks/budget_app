import React, { useEffect, useState } from 'react';
import { BUDGET_CURRENCY, getPlanBudget, lastPlanItem, OverBudgetError, PlanKind, plannedTotal, setPlanAmount } from '../../db/plans';
import { formatWithCurrency, parseAmountOrZero, toInputValue } from '../money';
import RadioGroup from '../RadioGroup';
import TextInputModal from '../TextInputModal';

const KINDS = [
  ['limit', 'Гибкая трата', 'Еда, кафе, такси — сумма меняется, следим за остатком'],
  ['fixed', 'Фиксированная трата', 'Аренда, кредит, подписки — сумма одна и та же каждый месяц'],
] as const;

export type PlanAmountTarget = {
  category_id: number;
  label: string;
  /** current amount in the plan; 0 = not set / not in the plan yet */
  limit_minor: number;
  /** current kind; a category not in the plan yet starts as a limit */
  kind?: PlanKind;
};

type Props = {
  ym: string;
  /** null = closed */
  target: PlanAmountTarget | null;
  onClose: () => void;
  /** after a successful save (the item is added to the month's plan if it wasn't there) */
  onSaved: () => void;
};

const money = (minor: number) => formatWithCurrency(minor, BUDGET_CURRENCY);

/**
 * Dialog for one category's amount in a month's plan, shared by the plan screen (✎ on a row) and the
 * stats screen ("＋ В план"). Shows what is still free and refuses amounts over the amount to distribute.
 */
export default function PlanAmountModal({ ym, target, onClose, onSaved }: Props) {
  // free for this category = amount to distribute − the other categories; null = no amount set
  const [free, setFree] = useState<number | null>(null);
  const [kind, setKind] = useState<PlanKind>('limit');
  // the field starts with the current amount, or the category's amount from the last month that planned it
  const [initial, setInitial] = useState('');
  const [previous, setPrevious] = useState<number | null>(null);

  useEffect(() => {
    if (!target) return;
    setKind(target.kind ?? 'limit');
    setInitial(toInputValue(target.limit_minor));
    Promise.all([getPlanBudget(ym), plannedTotal(ym, target.category_id), lastPlanItem(ym, target.category_id)])
      .then(([budget, others, last]) => {
        setFree(budget === null ? null : Math.max(budget - others, 0));
        setPrevious(last?.limit_minor ?? null);
        if (!target.limit_minor && last) {
          setInitial(toInputValue(last.limit_minor));
          if (!target.kind) setKind(last.kind);
        }
      })
      .catch((e) => console.error('load plan budget failed', e));
  }, [ym, target]);

  async function save(text: string): Promise<string | null> {
    if (!target) return null;
    const minor = parseAmountOrZero(text);
    if (minor === null) return 'Введите сумму, например 1500 или 12.50';
    try {
      await setPlanAmount(ym, target.category_id, minor, kind);
    } catch (e) {
      if (!(e instanceof OverBudgetError)) throw e;
      return `Больше суммы к планированию. Свободно для этой категории: ${money(free ?? 0)}.`;
    }
    onSaved();
    return null;
  }

  const hint = [
    free !== null ? `Свободно: ${money(free)}` : '',
    previous ? `В прошлый раз: ${money(previous)}` : '',
  ].filter(Boolean).join('\n');

  return (
    <TextInputModal
      visible={target !== null}
      title={target?.label ?? ''}
      hint={hint || undefined}
      initialValue={initial}
      placeholder="0"
      keyboardType="decimal-pad"
      maxLength={12}
      allowEmpty
      onSubmit={save}
      onClose={onClose}
    >
      <RadioGroup options={KINDS} value={kind} onChange={setKind} />
    </TextInputModal>
  );
}
