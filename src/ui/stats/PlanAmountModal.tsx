import React, { useEffect, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { Currency } from '../../db/fx';
import { categoryMonthlyAverage, getPlanBudget, lastPlanItem, NormPeriod, OverBudgetError, PlanKind, planConverter, plannedTotal, setPlanAmount } from '../../db/plans';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { AMOUNT_HINT, PER_PERIOD, SPENDING_PATTERN } from '../strings';
import { daysInMonth } from '../dateRange';
import { formStyles } from '../formStyles';
import CurrencyButton from '../CurrencyButton';
import { formatWithCurrency, parseAmountOrZero, toInputValue } from '../money';
import RadioGroup from '../RadioGroup';
import TextInputModal from '../TextInputModal';
import { useLoadedForm } from '../form';
import { plural } from '../format';
import { toast } from '../toast';
import { emitTransactionsChanged } from '../../events';

const KINDS = [
  ['limit', 'Траты с лимитом', 'Еда, кафе, одежда — сумма меняется, следим за остатком'],
  ['fixed', 'Обязательный платёж', 'Аренда, кредит, подписки — одна и та же сумма каждый месяц'],
] as const;

// how the category is spent: its limit in day / week stats is counted per this period
const PATTERN_KEYS = ['day', 'week', '2weeks', 'month'] as const;
const PATTERN_DAYS = { day: 1, week: 7, '2weeks': 14 } as const;

/** The patterns, each with what the entered amount makes per its period: "Каждый день · ≈ 15 ₾ в день". */
function patterns(minor: number | null, currency: Currency, ym: string) {
  return PATTERN_KEYS.map((p) => {
    const per = !minor ? null : p === 'month' ? minor : Math.round((minor / daysInMonth(ym)) * PATTERN_DAYS[p]);
    const title = per === null ? SPENDING_PATTERN[p].title : `${SPENDING_PATTERN[p].title} · ${p === 'month' ? '' : '≈ '}${formatWithCurrency(per, currency)} ${PER_PERIOD[p]}`;
    return [p, title, SPENDING_PATTERN[p].hint] as const;
  });
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
};

/**
 * Dialog for one category's amount in a month's plan, shared by the plan screen (✎ on a row) and the
 * stats screen ("＋ В план"). The amount is entered in any currency (the one it was entered in comes back when
 * editing); what is still free is shown in the amount to distribute's currency, and going over it is refused.
 */
export default function PlanAmountModal({ ym, currency: shown, target, onClose, onSaved, onDelete }: Props) {
  // the most this category can get = amount to distribute − the other categories (null = no amount set), in the app's currency
  const [free, setFree] = useState<{ minor: number; currency: Currency } | null>(null);
  // the saved item; a category not in the plan yet starts as a day-to-day limit in the screen's currency
  const form = useLoadedForm<{ value: string; currency: Currency; kind: PlanKind; norm: NormPeriod }>(target ? {
    value: toInputValue(target.limit_minor), currency: target.currency, kind: target.kind ?? 'limit', norm: target.norm_period ?? 'day',
  } : null, target !== null);
  const kind = useWatch({ control: form.control, name: 'kind' });
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
      setPrevious(last ? { ...inShown(last.limit_minor, last.currency), ym: last.ym } : null);
      setAverage(avg && avg.average_minor > 0 ? { minor: avg.average_minor, months: avg.months, from: avg.from, to: avg.to } : null);
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
      if (!target.limit_minor && last) {
        if (!target.kind) form.setValue('kind', last.kind, dirty);
        if (!target.norm_period) form.setValue('norm', last.norm_period, dirty);
      }
    })().catch((e) => console.error('load plan budget failed', e));
  }, [ym, target, form, shown]);

  async function save(text: string): Promise<string | null> {
    if (!target) return null;
    const minor = parseAmountOrZero(text);
    if (minor === null) return AMOUNT_HINT;
    try {
      const { kind: k, currency, norm } = form.getValues();
      await setPlanAmount(ym, target.category_id, minor, k, currency, norm);
    } catch (e) {
      if (!(e instanceof OverBudgetError)) throw e;
      return `Больше бюджета месяца: можно запланировать до ${free ? formatWithCurrency(free.minor, free.currency) : '0'}`;
    }
    toast(`План «${target.label}» сохранён`);
    // the stats and reports open under the dialog count the plan too
    emitTransactionsChanged();
    onSaved();
    return null;
  }

  // what helps to pick the amount: the room in the budget, last month's plan, the usual spending
  const facts: Array<{ label: string; value: string; note?: string }> = [];
  // the month's budget minus the other categories' plans: not about what is spent
  if (free) facts.push({ label: 'Можно запланировать', value: `до ${formatWithCurrency(free.minor, free.currency)}` });
  if (previous) facts.push({ label: `В плане на ${monthName(previous.ym)}`, value: formatWithCurrency(previous.minor, previous.currency) });
  if (average) {
    facts.push({
      label: `В среднем в месяц (${average.months} ${plural(average.months, ['полный месяц', 'полных месяца', 'полных месяцев'])})`,
      value: `≈ ${formatWithCurrency(average.minor, shown)}`,
    });
  }
  const hint = facts.length ? (
    <View style={styles.facts}>
      {facts.map((f) => (
        <View key={f.label} style={styles.fact}>
          <View style={styles.factLabel}>
            <Text style={styles.label}>{f.label}</Text>
            {f.note ? <Text style={styles.note}>{f.note}</Text> : null}
          </View>
          <Text style={styles.value}>{f.value}</Text>
        </View>
      ))}
    </View>
  ) : null;

  return (
    <TextInputModal
      visible={target !== null}
      title={target?.label ?? ''}
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
    >
      <Controller control={form.control} name="kind" render={({ field }) => <RadioGroup options={KINDS} value={field.value} onChange={field.onChange} />} />
      {kind === 'limit' ? (
        <>
          <Text style={formStyles.label}>Как тратите</Text>
          <Controller control={form.control} name="norm" render={({ field }) => <RadioGroup options={patterns(parseAmountOrZero(entered ?? ''), enteredCurrency, ym)} value={field.value} onChange={field.onChange} />} />
          <Text style={formStyles.hint}>По этому в статистике считается лимит на день или неделю.</Text>
        </>
      ) : null}
    </TextInputModal>
  );
}

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

/** "сентябрь", "сентябрь 2025" ('YYYY-MM'): the year only when it isn't this one. */
function monthName(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]}${y !== new Date().getFullYear() ? ` ${y}` : ''}`;
}

const styles = StyleSheet.create({
  facts: { marginBottom: 12, gap: 6 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  factLabel: { flex: 1 },
  label: { fontSize: 14, color: colors.muted },
  note: { fontSize: 12, color: colors.muted, marginTop: 1 },
  value: { fontSize: 14, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
});
