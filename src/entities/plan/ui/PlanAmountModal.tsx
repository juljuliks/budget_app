import React, { useEffect, useState } from 'react';
import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import { Currency } from '@/db/fx';
import { categoryMonthlyAverage, getPlanBudget, lastPlanItem, NormPeriod, OverBudgetError, PlanKind, planConverter, plannedTotal } from '@/db/plans';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { AMOUNT_HINT, PER_PERIOD, SPENDING_PATTERN, LOAD_FAILED, SAVE_FAILED } from '@/shared/lib/strings';
import { daysInMonth } from '@/shared/lib/dateRange';
import { formStyles } from '@/shared/theme/formStyles';
import CurrencyButton from '@/shared/ui/CurrencyButton';
import { formatWithCurrency, parseAmountOrZero, toInputValue } from '@/shared/lib/money';
import RadioGroup from '@/shared/ui/RadioGroup';
import StepsNav from '@/shared/ui/StepsNav';
import TextInputModal from '@/shared/ui/TextInputModal';
import { useLoadedForm } from '@/shared/ui/form';
import { toast, toastFailure } from '@/shared/ui/toast';
import { saveFund, savePlanAmount, saveRecurring } from '../model/commands';
import RecurringFields, { RecurringForm } from './RecurringFields';
import FundFields, { FundForm } from './FundFields';
import { askTakeLocked } from './askTakeLocked';
import PlanFacts from './PlanFacts';
import { RHYTHM_DAYS } from '@/shared/lib/dates';

const KINDS = [
  ['limit', 'Траты с лимитом', 'Еда, кафе, одежда — сумма меняется, следим, сколько осталось'],
  ['subs', 'Повторяющийся платёж', 'Аренда, спорт, страховка — каждый месяц или реже; с датой план знает, оплачено ли'],
  ['fund', 'Копилка', 'Отпуск, страховка, техника — копить понемногу, потратить разом'],
] as const;

// how the category is spent: its limit in day / week stats is counted per this period
const PATTERN_KEYS = ['day', 'week', '2weeks', 'month'] as const;

/** The patterns, each with what the entered amount makes per its period: "Каждый день · ≈ 15 ₾ в день". */
function patterns(minor: number | null, currency: Currency, ym: string) {
  return PATTERN_KEYS.map((p) => {
    const per = !minor ? null : p === 'month' ? minor : Math.round((minor / daysInMonth(ym)) * RHYTHM_DAYS[p]);
    const title = per === null ? SPENDING_PATTERN[p].title : `${SPENDING_PATTERN[p].title} · ${p === 'month' ? '' : '≈ '}${formatWithCurrency(per, currency)} ${PER_PERIOD[p]}`;
    return [p, title, SPENDING_PATTERN[p].hint] as const;
  });
}

/** "Повторяющийся платёж" saved from the sheet; an error to show, or null. */
async function submitRecurring(ym: string, categoryId: number, minor: number, currency: Currency, v: RecurringForm, saved: () => void): Promise<string | null> {
  if (!minor) return 'Введите сумму платежа';
  if (v.period !== 1 && !v.next) return 'Для платежа реже раза в месяц нужна дата';
  await saveRecurring(ym, categoryId, { amount_minor: minor, currency, period_months: v.period, due: v.next });
  saved();
  return null;
}

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
};

/**
 * Dialog for one category's amount in a month's plan, shared by the plan screen (✎ on a row) and the
 * stats screen ("＋ В план"). The amount is entered in any currency (the one it was entered in comes back when
 * editing); what is still free is shown in the amount to distribute's currency, and going over it is refused.
 */
export default function PlanAmountModal({ ym, currency: shown, target, onClose, onSaved, onDelete, adding }: Props) {
  // the most this category can get = amount to distribute − the other categories (null = no amount set), in the app's currency
  const [free, setFree] = useState<{ minor: number; currency: Currency } | null>(null);
  // "🔒 Отложить сразу", in the budget's currency: what is short of free can be taken from it
  const [locked, setLocked] = useState(0);
  // the saved item; a category not in the plan yet starts as a day-to-day limit in the screen's currency
  // "Обязательный платёж" is a repeating payment now
  const form = useLoadedForm<FundForm & RecurringForm & { kind: PlanKind; norm: NormPeriod }>(target ? {
    value: toInputValue(target.fund ? target.fund.target_minor : target.limit_minor), currency: target.currency,
    kind: target.kind === 'fixed' ? 'subs' : target.kind ?? 'limit', period: 1, next: null,
    norm: target.norm_period ?? 'day', due: target.fund?.due ?? null, start: target.fund?.start_minor ? toInputValue(target.fund.start_minor) : '',
  } : null, target !== null);
  const [kind, due, period, next] = useWatch({ control: form.control, name: ['kind', 'due', 'period', 'next'] });
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
        if (!target.kind) form.setValue('kind', last.kind === 'fixed' ? 'subs' : last.kind, dirty);
        if (!target.norm_period) form.setValue('norm', last.norm_period, dirty);
      }
    })().catch(toastFailure('load plan budget', LOAD_FAILED));
  }, [ym, target, form, shown]);

  async function save(text: string): Promise<string | null | false> {
    if (!target) return null;
    const minor = parseAmountOrZero(text);
    if (minor === null) return AMOUNT_HINT;
    const { kind: k, currency, norm, due: date, start } = form.getValues();
    const startMinor = parseAmountOrZero(start ?? '');
    if (k === 'fund' && (!minor || startMinor === null)) return minor ? AMOUNT_HINT : 'Введите, сколько накопить';
    const label = target.label;
    // the stats and reports open under the dialog count the plan too (savePlanAmount tells them)
    const saved = (taken?: string) => {
      const done = k === 'fund' ? `Копилка «${label}» сохранена` : adding ? `«${label}» ${taken ? 'в плане' : 'добавлена в план'}` : `План «${label}» сохранён`;
      toast(taken ? `${done}, из 🔒 вычтено ${taken}` : done);
      onSaved();
    };
    if (k === 'subs') return submitRecurring(ym, target.category_id, minor, currency, form.getValues(), saved);
    const write = (takeLocked: boolean) => (k === 'fund' && date
      ? saveFund(ym, target.category_id, { target_minor: minor, currency, due: date, start_minor: startMinor ?? 0 }, undefined, takeLocked)
      : savePlanAmount(ym, target.category_id, minor, k, currency, norm, takeLocked));
    try {
      await write(false);
    } catch (e) {
      if (!(e instanceof OverBudgetError)) throw e;
      const short = e.planned_minor - e.budget_minor;
      // what isn't free is in "🔒 Отложить сразу": asked over the sheet, which stays open
      if (short <= locked) {
        askTakeLocked({
          short, locked, currency: e.currency, adding: !!adding,
          onYes: () => write(true)
            .then(() => { saved(formatWithCurrency(short, e.currency)); onClose(); })
            .catch(toastFailure('save plan amount from savings', SAVE_FAILED)),
        });
        return false;
      }
      const room = `можно запланировать до ${free ? formatWithCurrency(free.minor, free.currency) : '0'}`;
      return k === 'fund' ? `Взнос больше бюджета месяца: ${room}. Выберите дату позже` : `Больше бюджета месяца: ${room}`;
    }
    saved();
    return null;
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
      submitLabel={adding ? 'Добавить в план' : undefined}
      hint={hint}
      form={form}
      placeholder="0"
      keyboardType="decimal-pad"
      maxLength={12}
      allowEmpty
      onSubmit={save}
      onClose={onClose}
      // an item in the plan: removing it is a button under "Сохранить", as on the other sheets
      remove={onDelete ? { title: 'Удалить из плана', onPress: () => { onClose(); onDelete(); } } : undefined}
      inputAccessory={<Controller control={form.control} name="currency" render={({ field }) => <CurrencyButton value={field.value} onChange={field.onChange} />} />}
      label={kind === 'fund' ? 'Накопить' : undefined}
      submitDisabled={(kind === 'fund' && !due) || (kind === 'subs' && period !== 1 && !next)}
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
      {kind === 'subs' && target ? <RecurringFields categoryId={target.category_id} form={form as unknown as UseFormReturn<RecurringForm>} /> : null}
      {kind === 'fund' && target ? <FundFields ym={ym} categoryId={target.category_id} form={form as unknown as UseFormReturn<FundForm>} /> : null}
    </TextInputModal>
  );
}


const styles = StyleSheet.create({
  category: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12 },
});
