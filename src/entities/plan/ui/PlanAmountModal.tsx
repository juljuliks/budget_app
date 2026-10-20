import React, { useEffect, useState } from 'react';
import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import { Currency } from '@/db/fx';
import { categoryMonthlyAverage, Every, getPlanBudget, lastPlanItem, NormPeriod, PlanKind, planConverter, plannedTotal } from '@/db/plans';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { LOAD_FAILED } from '@/shared/lib/strings';
import { formStyles } from '@/shared/theme/formStyles';
import CurrencyButton from '@/shared/ui/CurrencyButton';
import { parseAmountOrZero, toInputValue } from '@/shared/lib/money';
import RadioGroup from '@/shared/ui/RadioGroup';
import StepsNav from '@/shared/ui/StepsNav';
import TextInputModal from '@/shared/ui/TextInputModal';
import { useLoadedForm } from '@/shared/ui/form';
import { toastFailure } from '@/shared/ui/toast';
import { openCategory, pickPaymentOperation } from '@/shared/navigation/navigation';
import { monthDays } from '@/shared/lib/dateRange';
import FundFields, { FundForm } from './FundFields';
import PlanFacts from './PlanFacts';
import RegularFields, { RegularEvery, RegularForm } from './RegularFields';
import RepeatField, { RepeatForm } from './RepeatField';
import { BY_HAND_HINT, COUNTED_HINT, KINDS, patterns, PICK_HINT } from './sheetOptions';
import { PlanSheetValues, submitPlanSheet } from './submitPlanSheet';

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
  /** not in the plan yet: the amount offered (what the category spent), in `currency`; over last month's plan */
  suggested_minor?: number;
  /** a fund: its target (in `currency`, the sheet's amount), date and what was saved before */
  fund?: { target_minor: number; due: string; start_minor: number };
  /**
   * "Регулярные платежи" on: its kind is "Регулярный платёж"; another kind turns them off. A category with "Подписки"
   * (`by_merchant`, on its page): its subscriptions are in their own sheet (made from operations; the amount here by
   * hand until one has a day); else its own payment (amount, how often, the dates) is in this sheet
   */
  recurring?: boolean;
  by_merchant?: boolean;
  /** "Повторять каждый месяц": the next month has it with the same amount (till `until`, "Дата окончания") */
  pinned?: boolean;
  until?: string | null;
  /** a regular payment within the month (a one-off payment's item): every day or on the weekdays, `unit_minor` each time */
  every?: Every | null;
  weekdays?: number | null;
  unit_minor?: number | null;
};

type Props = {
  ym: string;
  /** the app's currency: the hints (what is free, last month) are shown in it */
  currency: Currency;
  /** null = closed */
  target: PlanAmountTarget | null;
  onClose: () => void;
  /** after a successful save (the item is added to the month's plan if it wasn't there) */
  onSaved: () => void;
  /** an item in the plan: the trash right of the title removes it (the sheet closes first) */
  onDelete?: () => void;
  /** step 2 of "Добавить в план" (the category picked in step 1): "‹ Назад" goes back to it */
  adding?: { onBack: () => void };
  /** before going to the operations ("Выбрать операцию"): closes this sheet and the ones under it (by default — this one) */
  onLeave?: () => void;
};

/**
 * What the sheet is for its kind: a regular payment within the month (`regular`), the category's own payment (`own`);
 * a category with "Подписки" — an operation to pick (`pick`: they're off in the plan) or the amount counted from them
 * (`counted`).
 */
function sheetMode(target: PlanAmountTarget | null, kind: PlanKind, every: RegularEvery) {
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
 * "Регулярный платёж" for a category with "Подписки" off in the plan: a subscription is made from an operation — the
 * sheet (and those under it) closes for the category's operations of the month to pick one from.
 */
function goPick(target: PlanAmountTarget, ym: string, leave: () => void): false {
  leave();
  pickPaymentOperation({ id: target.category_id, label: target.label }, monthDays(ym));
  return false;
}

/**
 * Dialog for one category's amount in a month's plan, shared by the plan screen (✎ on a row) and the
 * stats screen ("＋ В план"). The amount is entered in any currency (the one it was entered in comes back when
 * editing); what is still free is shown in the amount to distribute's currency, and going over it is refused.
 */
export default function PlanAmountModal({ ym, currency: shown, target, onClose, onSaved, onDelete, adding, onLeave }: Props) {
  // the most this category can get = amount to distribute − the other categories (null = no amount set), in the app's currency
  const [free, setFree] = useState<{ minor: number; currency: Currency } | null>(null);
  // "🔒 Отложить сразу", in the budget's currency: what is short of free can be taken from it
  const [locked, setLocked] = useState(0);
  // the saved item; a category not in the plan yet starts as a day-to-day limit in the screen's currency
  const form = useLoadedForm<FundForm & RegularForm & { kind: PlanKind; norm: NormPeriod }>(target ? {
    value: toInputValue(target.fund ? target.fund.target_minor : target.every ? target.unit_minor ?? 0 : target.limit_minor), currency: target.currency,
    kind: target.recurring || target.every ? 'subs' : target.kind ?? 'limit', pinned: !!target.pinned, until: target.until ?? null,
    every: target.every ?? 'month', weekdays: target.weekdays ?? 0, period: 1, next: null,
    norm: target.norm_period ?? 'day', due: target.fund?.due ?? null, start: target.fund?.start_minor ? toInputValue(target.fund.start_minor) : '',
  } : null, target !== null);
  const [kind, due, every] = useWatch({ control: form.control, name: ['kind', 'due', 'every'] });
  const s = sheetMode(target, kind, every);
  const [entered, enteredCurrency] = useWatch({ control: form.control, name: ['value', 'currency'] });
  const [previous, setPrevious] = useState<{ minor: number; currency: Currency; ym: string } | null>(null);
  // what the category usually takes a month (the latest full months), in the app's currency
  const [average, setAverage] = useState<{ minor: number; months: number; from: string; to: string } | null>(null);

  useEffect(() => {
    if (!target) return;
    (async () => {
      const [budget, last, conv, avg] = await Promise.all([
        getPlanBudget(ym), lastPlanItem(ym, target.category_id), planConverter(ym), categoryMonthlyAverage(target.category_id, ym, shown)]);
      const others = budget ? await plannedTotal(ym, target.category_id, budget.currency) : 0;
      // in the app's currency; the original one when there is no rate
      const inShown = (minor: number, from: Currency) => {
        const c = conv(minor, from, shown);
        return c === null ? { minor, currency: from } : { minor: c, currency: shown };
      };
      // the unplanned share is not for the plan
      setFree(budget ? inShown(Math.max(budget.plannable_minor - others, 0), budget.currency) : null);
      setLocked(budget?.locked_minor ?? 0);
      setPrevious(last ? { ...inShown(last.limit_minor, last.currency), ym: last.ym } : null);
      setAverage(avg && avg.average_minor > 0 ? { minor: avg.average_minor, months: avg.months, from: avg.from, to: avg.to } : null);
      // not in the plan yet: the amount it was opened with (what the category spent), else last month's item —
      // ready to save as is (so it counts as a change); the kind and pattern from last month either way
      const dirty = { shouldDirty: true };
      // a fund's amount is its target, not a month's
      if (target.fund) return;
      if (!target.limit_minor && target.suggested_minor) {
        form.setValue('value', toInputValue(target.suggested_minor), dirty);
        form.setValue('currency', target.currency, dirty);
      } else if (!target.limit_minor && last) {
        form.setValue('value', toInputValue(last.limit_minor), dirty);
        form.setValue('currency', last.currency, dirty);
      }
      if (!target.limit_minor && last) {
        if (!target.kind) form.setValue('kind', last.kind, dirty);
        if (!target.norm_period) form.setValue('norm', last.norm_period, dirty);
      }
    })().catch(toastFailure('load plan budget', LOAD_FAILED));
  }, [ym, target, form, shown]);

  async function save(text: string): Promise<string | null | false> {
    if (!target) return null;
    if (s.pick) return goPick(target, ym, onLeave ?? onClose);
    if (s.counted) return null;
    return submitPlanSheet({ ym, target, text, v: form.getValues() as PlanSheetValues, adding: !!adding, locked, free, onSaved, onClose });
  }

  // step 2 of "Добавить в план": the steps and the category over the facts
  const hint = adding ? (
    <View>
      <StepsNav at={1} count={2} name="Сумма" onBack={adding.onBack} />
      <Text style={styles.category}>{target?.label}</Text>
      <PlanFacts free={free} previous={previous} average={average} shown={shown} />
    </View>
  ) : <PlanFacts free={free} previous={previous} average={average} shown={shown} />;

  return (
    <TextInputModal
      visible={target !== null}
      title={adding ? 'Добавить в план' : target?.label ?? ''}
      // the category's name a link to its page (the sheet closes: a page goes under the sheets)
      onTitlePress={!adding && target ? () => { onClose(); openCategory(target.category_id); } : undefined}
      submitLabel={s.pick ? 'Выбрать операцию' : adding ? 'Добавить в план' : undefined} noInput={s.pick || s.counted}
      hint={hint} form={form} placeholder="0" keyboardType="decimal-pad"
      maxLength={12}
      allowEmpty
      onSubmit={save}
      onClose={onClose}
      // an item in the plan: removing it is a button under "Сохранить", as on the other sheets
      remove={onDelete ? { title: 'Удалить из плана', onPress: () => { onClose(); onDelete(); } } : undefined}
      inputAccessory={<Controller control={form.control} name="currency" render={({ field }) => <CurrencyButton value={field.value} onChange={field.onChange} />} />}
      label={kind === 'fund' ? 'Накопить' : s.regular ? 'Сумма за раз' : s.own ? 'Сумма платежа' : undefined}
      submitDisabled={kind === 'fund' && !due}
      // the kind first: the field under it is a month's amount or a fund's target
      above={<Controller control={form.control} name="kind" render={({ field }) => <RadioGroup options={KINDS} value={field.value} onChange={field.onChange} />} />}
    >
      {kind === 'limit' ? (
        <>
          <Text style={formStyles.label}>Как тратите</Text>
          <Controller control={form.control} name="norm" render={({ field }) => <RadioGroup options={patterns(parseAmountOrZero(entered ?? ''), enteredCurrency, ym)} value={field.value} onChange={field.onChange} />} />
          <Text style={formStyles.hint}>По этому в статистике считается лимит на день или неделю.</Text>
        </>
      ) : null}
      {kind === 'limit' && target ? <RepeatField ym={ym} form={form as unknown as UseFormReturn<RepeatForm>} entered={entered ?? ''} currency={enteredCurrency} /> : null}
      {kind === 'subs' && target && !target.by_merchant ? <RegularFields ym={ym} categoryId={target.category_id} form={form as unknown as Parameters<typeof RegularFields>[0]['form']} /> : null}
      {kind === 'subs' && target?.by_merchant ? <Text style={formStyles.hint}>{s.pick ? PICK_HINT : s.counted ? COUNTED_HINT : BY_HAND_HINT}</Text> : null}
      {kind === 'fund' && target ? <FundFields ym={ym} categoryId={target.category_id} form={form as unknown as UseFormReturn<FundForm>} /> : null}
    </TextInputModal>
  );
}

const styles = StyleSheet.create({
  category: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12 },
});
