import React, { useEffect, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Currency } from '../../db/fx';
import { getPlanBudget, lastPlanItem, NormPeriod, OverBudgetError, PlanKind, plannedTotal, setPlanAmount } from '../../db/plans';
import { Text } from 'react-native';
import { AMOUNT_HINT, SPENDING_PATTERN } from '../strings';
import { formStyles } from '../formStyles';
import CurrencyButton from '../CurrencyButton';
import { formatWithCurrency, parseAmountOrZero, toInputValue } from '../money';
import RadioGroup from '../RadioGroup';
import TextInputModal from '../TextInputModal';
import { useLoadedForm } from '../form';

const KINDS = [
  ['limit', 'Траты с лимитом', 'Еда, кафе, одежда — сумма меняется, следим за остатком'],
  ['fixed', 'Обязательный платёж', 'Аренда, кредит, подписки — одна и та же сумма каждый месяц'],
] as const;

// how the category is spent: its limit in day / week stats is counted per this period
const PATTERNS = (['day', 'week', '2weeks', 'month'] as const).map((p) => [p, SPENDING_PATTERN[p].title, SPENDING_PATTERN[p].hint] as const);

export type PlanAmountTarget = {
  category_id: number;
  label: string;
  /** current amount in the plan, in `currency`; 0 = not set / not in the plan yet */
  limit_minor: number;
  /** the currency the amount was entered in; a category not in the plan yet: the screen's currency */
  currency: Currency;
  /** current kind; a category not in the plan yet starts as a limit */
  kind?: PlanKind;
  /** how a flexible item's norm is counted in period stats */
  norm_period?: NormPeriod;
};

type Props = {
  ym: string;
  /** null = closed */
  target: PlanAmountTarget | null;
  onClose: () => void;
  /** after a successful save (the item is added to the month's plan if it wasn't there) */
  onSaved: () => void;
};

/**
 * Dialog for one category's amount in a month's plan, shared by the plan screen (✎ on a row) and the
 * stats screen ("＋ В план"). The amount is entered in any currency (the one it was entered in comes back when
 * editing); what is still free is shown in the amount to distribute's currency, and going over it is refused.
 */
export default function PlanAmountModal({ ym, target, onClose, onSaved }: Props) {
  // free for this category = amount to distribute − the other categories; null = no amount set
  const [free, setFree] = useState<{ minor: number; currency: Currency } | null>(null);
  // the saved item; a category not in the plan yet starts as a day-to-day limit in the screen's currency
  const form = useLoadedForm<{ value: string; currency: Currency; kind: PlanKind; norm: NormPeriod }>(target ? {
    value: toInputValue(target.limit_minor), currency: target.currency, kind: target.kind ?? 'limit', norm: target.norm_period ?? 'day',
  } : null, target !== null);
  const kind = useWatch({ control: form.control, name: 'kind' });
  const [previous, setPrevious] = useState<{ minor: number; currency: Currency } | null>(null);

  useEffect(() => {
    if (!target) return;
    (async () => {
      const [budget, last] = await Promise.all([getPlanBudget(ym), lastPlanItem(ym, target.category_id)]);
      const others = budget ? await plannedTotal(ym, target.category_id, budget.currency) : 0;
      setFree(budget ? { minor: Math.max(budget.amount_minor - others, 0), currency: budget.currency } : null);
      setPrevious(last ? { minor: last.limit_minor, currency: last.currency } : null);
      // not in the plan yet: last month's item is offered, ready to save as is (so it counts as a change)
      if (!target.limit_minor && last) {
        const dirty = { shouldDirty: true };
        form.setValue('value', toInputValue(last.limit_minor), dirty);
        form.setValue('currency', last.currency, dirty);
        if (!target.kind) form.setValue('kind', last.kind, dirty);
        if (!target.norm_period) form.setValue('norm', last.norm_period, dirty);
      }
    })().catch((e) => console.error('load plan budget failed', e));
  }, [ym, target, form]);

  async function save(text: string): Promise<string | null> {
    if (!target) return null;
    const minor = parseAmountOrZero(text);
    if (minor === null) return AMOUNT_HINT;
    try {
      const { kind: k, currency, norm } = form.getValues();
      await setPlanAmount(ym, target.category_id, minor, k, currency, norm);
    } catch (e) {
      if (!(e instanceof OverBudgetError)) throw e;
      return `Больше бюджета месяца. Не распределено: ${free ? formatWithCurrency(free.minor, free.currency) : '0'}.`;
    }
    onSaved();
    return null;
  }

  const hint = [
    free ? `Не распределено: ${formatWithCurrency(free.minor, free.currency)}` : '',
    previous ? `В прошлом месяце: ${formatWithCurrency(previous.minor, previous.currency)}` : '',
  ].filter(Boolean).join('\n');

  return (
    <TextInputModal
      visible={target !== null}
      title={target?.label ?? ''}
      hint={hint || undefined}
      form={form}
      placeholder="0"
      keyboardType="decimal-pad"
      maxLength={12}
      allowEmpty
      onSubmit={save}
      onClose={onClose}
      inputAccessory={<Controller control={form.control} name="currency" render={({ field }) => <CurrencyButton value={field.value} onChange={field.onChange} />} />}
    >
      <Controller control={form.control} name="kind" render={({ field }) => <RadioGroup options={KINDS} value={field.value} onChange={field.onChange} />} />
      {kind === 'limit' ? (
        <>
          <Text style={formStyles.label}>Как тратите</Text>
          <Controller control={form.control} name="norm" render={({ field }) => <RadioGroup options={PATTERNS} value={field.value} onChange={field.onChange} />} />
          <Text style={formStyles.hint}>По этому в статистике считается лимит на день или неделю.</Text>
        </>
      ) : null}
    </TextInputModal>
  );
}
