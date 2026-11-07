import React, { useEffect, useState } from 'react';
import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import { Currency } from '@/db/fx';
import { categoryMonthlyAverage, categoryMonthSpent, categoryPlanKind, currentYm, Every, getPlanBudget, getPlanItemBasics, lastPlanItem, NormPeriod, PlanKind, planConverter, plannedTotal } from '@/db/plans';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/shared/theme/theme';
import { LOAD_FAILED } from '@/shared/lib/strings';
import { formStyles } from '@/shared/theme/formStyles';
import CurrencyButton from '@/shared/ui/CurrencyButton';
import { formatWithCurrency, parseAmountOrZero, toInputValue } from '@/shared/lib/money';
import RadioGroup from '@/shared/ui/RadioGroup';
import StepsNav from '@/shared/ui/StepsNav';
import TextInputModal from '@/shared/ui/TextInputModal';
import { useLoadedForm } from '@/shared/ui/form';
import { toastFailure } from '@/shared/ui/toast';
import { openCategory } from '@/shared/navigation/navigation';
import { paymentsOfCategory } from '@/db/recurring';
import { toast } from '@/shared/ui/toast';
import { resumeSubscriptions } from '../model/commands';
import PlanFacts from './PlanFacts';
import RegularFields, { RegularEvery, RegularForm } from './RegularFields';
import KindPlate from './KindPlate';
import { BY_HAND_HINT, COUNTED_HINT, itemKindOf, patterns, PICK_HINT, REGULAR_HINT, RESUME_HINT } from './sheetOptions';
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
  /**
   * "Регулярные платежи" on: its kind is "Регулярный платёж"; another kind turns them off. A category with "Подписки"
   * (`by_merchant`, on its page): its subscriptions are in their own sheet (made from operations; the amount here by
   * hand until one has a day); else its own payment (amount, how often, the dates) is in this sheet
   */
  recurring?: boolean;
  by_merchant?: boolean;
  /** an item repeated before the category's kind ruled it (kept as it is); `until` — a regular payment's end */
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
  /**
   * «Настроить» of a regular payment from its category's page: only the payment (its amount, how often, its end) —
   * no kind to pick, nothing of the plan (what is free, spent, last month's)
   */
  setup?: boolean;
};

/**
 * What the sheet is for its kind: a regular payment within the month (`regular`), the category's own payment (`own`);
 * a category with "Подписки" — off in the plan (`pick`: its subscriptions count again, none — made of its merchants on
 * its page) or the amount counted from them (`counted`).
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
 * "Регулярный платёж" for a category with "Подписки" off in the plan: its subscriptions count again; none — the sheet
 * (and those under it) closes for its page, where they are made of its merchants ("Сделать подпиской").
 */
async function goSubscriptions(target: PlanAmountTarget, has: boolean, leave: () => void, onSaved: () => void): Promise<null | false> {
  if (!has) { leave(); openCategory(target.category_id); return false; }
  await resumeSubscriptions(target.category_id);
  toast(`План «${target.label}» сохранён`);
  onSaved();
  return null;
}

/**
 * Dialog for one category's amount in a month's plan, shared by the plan screen (✎ on a row) and the
 * stats screen ("＋ В план"). The amount is entered in any currency (the one it was entered in comes back when
 * editing); what is still free is shown in the amount to distribute's currency, and going over it is refused.
 */
export default function PlanAmountModal({ ym, currency: shown, target, onClose, onSaved, onDelete, adding, onLeave, setup }: Props) {
  // the most this category can get = amount to distribute − the other categories (null = no amount set), in the app's currency
  const [free, setFree] = useState<{ minor: number; currency: Currency } | null>(null);
  // "🔒 Отложить сразу", in the budget's currency: what is short of free can be taken from it
  const [locked, setLocked] = useState(0);
  // the saved item; a category not in the plan yet starts as a day-to-day limit in the screen's currency
  const form = useLoadedForm<RegularForm & { value: string; currency: Currency; kind: PlanKind; norm: NormPeriod }>(target ? {
    value: toInputValue(target.every ? target.unit_minor ?? 0 : target.limit_minor), currency: target.currency,
    // «📺 Подписки»: always its subscriptions (picked, counted or by hand till one has a day)
    kind: target.by_merchant || target.recurring || target.every ? 'subs' : target.kind ?? 'limit', pinned: !!target.pinned, until: target.until ?? null,
    every: target.every ?? 'month', weekdays: target.weekdays ?? 0, period: 1, next: null,
    norm: target.norm_period ?? 'day',
  } : null, target !== null);
  const [kind, every] = useWatch({ control: form.control, name: ['kind', 'every'] });
  const s = sheetMode(target, kind, every);
  const [entered, enteredCurrency] = useWatch({ control: form.control, name: ['value', 'currency'] });
  const [previous, setPrevious] = useState<{ minor: number; currency: Currency; ym: string } | null>(null);
  // what the category usually takes a month (the latest full months), in the app's currency
  const [average, setAverage] = useState<{ minor: number; months: number; from: string; to: string } | null>(null);
  // what the category spent in the month so far (not in a coming one), in the app's currency
  const [spent, setSpent] = useState<{ minor: number; ym: string } | null>(null);
  // the item in the month's plan already (a regular payment there: its amount is its category's, not edited here)
  const [inPlan, setInPlan] = useState(true);
  // a regular payment in the plan: its amount and schedule are its category's («Настроить» on its page), shown only
  const fixedRegular = !setup && inPlan && kind === 'subs' && !!target && !target.by_merchant;
  // a category with "Подписки": has it subscriptions (off in the plan — they count again)
  const [hasSubs, setHasSubs] = useState(false);
  useEffect(() => {
    if (!target?.by_merchant) { setHasSubs(false); return; }
    paymentsOfCategory(target.category_id).then((all) => setHasSubs(all.some((p) => p.merchant_key))).catch(toastFailure('load subscriptions', LOAD_FAILED));
  }, [target]);

  useEffect(() => {
    if (!target) return;
    (async () => {
      const [budget, last, conv, avg, spentMinor, own, item] = await Promise.all([
        getPlanBudget(ym), lastPlanItem(ym, target.category_id), planConverter(ym), categoryMonthlyAverage(target.category_id, ym, shown),
        ym > currentYm() ? null : categoryMonthSpent(target.category_id, ym, shown), categoryPlanKind(target.category_id),
        getPlanItemBasics(ym, target.category_id)]);
      setInPlan(!!item);
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
      setSpent(spentMinor === null ? null : { minor: spentMinor, ym });
      if (setup) return;
      // not in the plan yet: the amount it was opened with (what the category spent), else last month's item —
      // ready to save as is (so it counts as a change); the kind and pattern from last month either way
      const dirty = { shouldDirty: true };
      if (!target.limit_minor && target.suggested_minor) {
        form.setValue('value', toInputValue(target.suggested_minor), dirty);
        form.setValue('currency', target.currency, dirty);
      } else if (!target.limit_minor && last) {
        form.setValue('value', toInputValue(last.limit_minor), dirty);
        form.setValue('currency', last.currency, dirty);
      }
      // not in the plan: the item as its category's kind says (none set — a one-off payment)
      if (!item && !target.by_merchant) form.setValue('kind', itemKindOf(own), dirty);
      if (!target.limit_minor && last && !target.norm_period) form.setValue('norm', last.norm_period, dirty);
    })().catch(toastFailure('load plan budget', LOAD_FAILED));
  }, [ym, target, form, shown, setup]);

  async function save(text: string): Promise<string | null | false> {
    if (!target) return null;
    if (s.pick) return goSubscriptions(target, hasSubs, onLeave ?? onClose, onSaved);
    if (s.counted || fixedRegular) return null;
    return submitPlanSheet({ ym, target, text, v: form.getValues() as PlanSheetValues, adding: !!adding, locked, free, onSaved, onClose });
  }

  // step 2 of "Добавить в план": the steps and the category over the facts
  const hint = adding ? (
    <View>
      <StepsNav at={1} count={2} name="Сумма" onBack={adding.onBack} />
      <Text style={styles.category}>{target?.label}</Text>
      <PlanFacts free={free} spent={spent} previous={previous} average={average} shown={shown} />
    </View>
  ) : <PlanFacts free={free} spent={spent} previous={previous} average={average} shown={shown} />;

  return (
    <TextInputModal
      visible={target !== null}
      title={setup ? 'Регулярный платёж' : adding ? 'Добавить в план' : target?.label ?? ''}
      // the category's name a link to its page (the sheet closes: a page goes under the sheets)
      onTitlePress={!adding && !setup && target ? () => { onClose(); openCategory(target.category_id); } : undefined}
      submitLabel={s.pick && !hasSubs ? 'Выбрать мерчанта' : adding ? 'Добавить в план' : undefined} noInput={s.pick || s.counted || fixedRegular}
      alwaysSubmit={s.pick || setup}
      hint={setup ? null : hint} form={form} placeholder="0" keyboardType="decimal-pad"
      maxLength={12}
      allowEmpty
      onSubmit={save}
      onClose={onClose}
      // an item in the plan: removing it is a button under "Сохранить", as on the other sheets
      remove={onDelete ? { title: 'Удалить из плана', onPress: () => { onClose(); onDelete(); } } : undefined}
      inputAccessory={<Controller control={form.control} name="currency" render={({ field }) => <CurrencyButton value={field.value} onChange={field.onChange} />} />}
      label={fixedRegular ? undefined : s.regular ? 'Сумма за раз' : s.own ? 'Сумма платежа' : undefined}
      // what it is (its category's kind) first: the field under it is a month's amount
      above={setup || !target || target.by_merchant ? undefined
        : <KindPlate kind={kind} onOpen={() => { (onLeave ?? onClose)(); openCategory(target.category_id); }} />}
    >
      {kind === 'limit' ? (
        <>
          <Text style={formStyles.label}>Как тратите</Text>
          <Controller control={form.control} name="norm" render={({ field }) => <RadioGroup options={patterns(parseAmountOrZero(entered ?? ''), enteredCurrency, ym)} value={field.value} onChange={field.onChange} />} />
          <Text style={formStyles.hint}>По этому в статистике считается лимит на день или неделю.</Text>
        </>
      ) : null}
      {fixedRegular && target ? (
        <>
          <Text style={styles.amount}>{`В плане — ${formatWithCurrency(target.limit_minor, target.currency)}`}</Text>
          <Text style={formStyles.hint}>{REGULAR_HINT}</Text>
        </>
      ) : null}
      {kind === 'subs' && target && !target.by_merchant && !fixedRegular ? <RegularFields ym={ym} categoryId={target.category_id} form={form as unknown as Parameters<typeof RegularFields>[0]['form']} /> : null}
      {kind === 'subs' && target?.by_merchant ? <Text style={formStyles.hint}>{s.pick ? (hasSubs ? RESUME_HINT : PICK_HINT) : s.counted ? COUNTED_HINT : BY_HAND_HINT}</Text> : null}
    </TextInputModal>
  );
}

const styles = StyleSheet.create({
  category: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 12 },
  amount: { fontSize: 18, fontWeight: '600', color: colors.text },
});
