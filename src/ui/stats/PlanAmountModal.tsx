import React, { useEffect, useState } from 'react';
import { Currency } from '../../db/fx';
import { getPlanBudget, lastPlanItem, NormPeriod, OverBudgetError, PlanKind, plannedTotal, setPlanAmount } from '../../db/plans';
import { Text } from 'react-native';
import Segmented from '../Segmented';
import { formStyles } from '../formStyles';
import CurrencyPicker from '../CurrencyPicker';
import { formatWithCurrency, parseAmountOrZero, toInputValue } from '../money';
import RadioGroup from '../RadioGroup';
import TextInputModal from '../TextInputModal';

const KINDS = [
  ['limit', 'Гибкая трата', 'Еда, кафе, такси — сумма меняется, следим за остатком'],
  ['fixed', 'Фиксированная трата', 'Аренда, кредит, подписки — сумма одна и та же каждый месяц'],
] as const;

const NORMS = [['day', 'День'], ['week', 'Неделя'], ['2weeks', '2 недели'], ['month', 'Месяц']] as const;

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
    if (minor === null) return 'Введите сумму, например 1500 или 12.50';
    try {
      await setPlanAmount(ym, target.category_id, minor, kind, currency, norm);
    } catch (e) {
      if (!(e instanceof OverBudgetError)) throw e;
      return `Больше суммы к планированию. Свободно для этой категории: ${free ? formatWithCurrency(free.minor, free.currency) : '0'}.`;
    }
    onSaved();
    return null;
  }

  const hint = [
    free ? `Свободно: ${formatWithCurrency(free.minor, free.currency)}` : '',
    previous ? `В прошлый раз: ${formatWithCurrency(previous.minor, previous.currency)}` : '',
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
          {/* the rhythm the category is spent in: its norm in day / week stats is counted per this period */}
          <Text style={formStyles.label}>Норма считается за</Text>
          <Segmented options={NORMS} value={norm} onChange={setNorm} />
          <Text style={formStyles.hint}>
            {norm === 'day' ? 'Еда, транспорт — тратим понемногу каждый день.'
              : norm === 'week' ? 'Бары, кафе — бывает раз-два в неделю.'
                : norm === '2weeks' ? 'Траты раз в пару недель.'
                  : 'Одежда, техника — пара покупок в месяц.'}
          </Text>
        </>
      ) : null}
    </TextInputModal>
  );
}
