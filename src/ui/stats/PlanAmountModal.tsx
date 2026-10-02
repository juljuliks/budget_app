import React, { useEffect, useState } from 'react';
import { BUDGET_CURRENCY, getPlanBudget, OverBudgetError, PlanKind, plannedTotal, setPlanAmount } from '../../db/plans';
import { formatWithCurrency, parseAmountOrZero, toInputValue } from '../money';
import RadioGroup from '../RadioGroup';
import TextInputModal from '../TextInputModal';

const KINDS = [
  ['limit', 'Лимит', 'Сколько можно потратить — в статистике полоска'],
  ['fixed', 'Статичная трата', 'Фиксированный платёж (аренда, подписка) — в статистике «оплачено»'],
] as const;

export type PlanAmountTarget = {
  category_id: number;
  label: string;
  /** current amount in the plan; 0 = not set / not in the plan yet */
  limit_minor: number;
  /** last month's amount, shown as a hint */
  previous_minor?: number | null;
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

  useEffect(() => {
    if (!target) return;
    setKind(target.kind ?? 'limit');
    Promise.all([getPlanBudget(ym), plannedTotal(ym, target.category_id)])
      .then(([budget, others]) => setFree(budget === null ? null : Math.max(budget - others, 0)))
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
    target?.previous_minor ? `В прошлом месяце: ${money(target.previous_minor)}` : '',
  ].filter(Boolean).join('\n');

  return (
    <TextInputModal
      visible={target !== null}
      title={target?.label ?? ''}
      hint={hint || undefined}
      initialValue={toInputValue(target?.limit_minor)}
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
