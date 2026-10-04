import React, { useEffect, useState } from 'react';
import { Currency } from '../../db/fx';
import { getPlanBudget, lastPlanItem, NormPeriod, OverBudgetError, PlanKind, plannedTotal, setPlanAmount } from '../../db/plans';
import { Text } from 'react-native';
import { AMOUNT_HINT, SPENDING_PATTERN } from '../strings';
import { formStyles } from '../formStyles';
import CurrencyPicker from '../CurrencyPicker';
import { formatWithCurrency, parseAmountOrZero, toInputValue } from '../money';
import RadioGroup from '../RadioGroup';
import TextInputModal from '../TextInputModal';

const KINDS = [
  ['limit', 'Повседневные траты', 'Еда, кафе, такси — сумма меняется, следим за остатком'],
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
  const [kind, setKind] = useState<PlanKind>('limit');
  const [norm, setNorm] = useState<NormPeriod>('day');
  const [currency, setCurrency] = useState<Currency>('GEL');
  // the field starts with the current amount, or the category's amount from the last month that planned it
  const [initial, setInitial] = useState('');
  const [previous, setPrevious] = useState<{ minor: number; currency: Currency } | null>(null);

  useEffect(() => {
    if (!target) return;
    setKind(target.kind ?? 'limit');
    setNorm(target.norm_period ?? 'day');
    setCurrency(target.currency);
    setInitial(toInputValue(target.limit_minor));
    (async () => {
      const [budget, last] = await Promise.all([getPlanBudget(ym), lastPlanItem(ym, target.category_id)]);
      const others = budget ? await plannedTotal(ym, target.category_id, budget.currency) : 0;
      setFree(budget ? { minor: Math.max(budget.amount_minor - others, 0), currency: budget.currency } : null);
      setPrevious(last ? { minor: last.limit_minor, currency: last.currency } : null);
      if (!target.limit_minor && last) {
        setInitial(toInputValue(last.limit_minor));
        setCurrency(last.currency);
        if (!target.kind) setKind(last.kind);
        if (!target.norm_period) setNorm(last.norm_period);
      }
    })().catch((e) => console.error('load plan budget failed', e));
  }, [ym, target]);

  async function save(text: string): Promise<string | null> {
    if (!target) return null;
    const minor = parseAmountOrZero(text);
    if (minor === null) return AMOUNT_HINT;
    try {
      await setPlanAmount(ym, target.category_id, minor, kind, currency, norm);
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
      initialValue={initial}
      placeholder="0"
      keyboardType="decimal-pad"
      maxLength={12}
      allowEmpty
      onSubmit={save}
      onClose={onClose}
    >
      <CurrencyPicker value={currency} onChange={setCurrency} />
      <RadioGroup options={KINDS} value={kind} onChange={setKind} />
      {kind === 'limit' ? (
        <>
          <Text style={formStyles.label}>Как тратите</Text>
          <RadioGroup options={PATTERNS} value={norm} onChange={setNorm} />
          <Text style={formStyles.hint}>По этому в статистике считается лимит на день или неделю.</Text>
        </>
      ) : null}
    </TextInputModal>
  );
}
