import React from 'react';
import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import { Currency } from '@/db/fx';
import { Every, NormPeriod, PlanKind } from '@/db/plans';
import { StyleSheet, Text } from 'react-native';
import { colors } from '@/shared/theme/theme';

import { formStyles } from '@/shared/theme/formStyles';
import CurrencyButton from '@/shared/ui/CurrencyButton';
import { formatWithCurrency, toInputValue } from '@/shared/lib/money';
import TextInputModal from '@/shared/ui/TextInputModal';
import { useLoadedForm } from '@/shared/ui/form';

import { openCategory } from '@/shared/navigation/navigation';
import { goSubscriptions, sheetMode } from './planSheetMode';

import RegularFields from './RegularFields';
import RegularPlanFields from './RegularPlanFields';
import KindPlate from './KindPlate';
import { DueForm, OneOffDueField } from './OneOffDueField';
import { BY_HAND_HINT, COUNTED_HINT, PICK_HINT, REGULAR_HINT, RESUME_HINT } from './sheetOptions';
import { submitPlanSheet } from './submitPlanSheet';
import { type PlanSheetForm, usePlanSheetData } from './usePlanSheetData';
import { LimitNorm, planFormDefaults, PlanSheetHint } from './PlanSheetParts';
import { font, weight } from '@/shared/theme/tokens';

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
  /** opened from its category's page once its kind is saved: "‹ Назад" over the facts leaves for the categories */
  onBack?: () => void;
};

/**
 * Dialog for one category's amount in a month's plan, shared by the plan screen (✎ on a row) and the
 * stats screen ("＋ В план"). The amount is entered in any currency (the one it was entered in comes back when
 * editing); what is still free is shown in the amount to distribute's currency, and going over it is refused.
 */
export default function PlanAmountModal({
  ym,
  currency: shown,
  target,
  onClose,
  onSaved,
  onDelete,
  adding,
  onLeave,
  setup,
  onBack,
}: Props) {
  // the saved item; a category not in the plan yet starts as a day-to-day limit in the screen's currency
  const form = useLoadedForm<PlanSheetForm>(target ? planFormDefaults(target) : null, target !== null);
  const [kind, every, period] = useWatch({ control: form.control, name: ['kind', 'every', 'period'] });
  const s = sheetMode(target, kind, every);
  const d = usePlanSheetData(ym, target, form, shown, setup);
  // a regular payment rarer than monthly in the plan: its amount is its category's (asked ahead), shown only; every day,
  // week or month — the amount here, how often is its category's
  const fixedRegular =
    !setup && d.inPlan && kind === 'subs' && !!target && !target.by_merchant && !target.every && (d.ownPeriod ?? 1) > 1;
  // «Настроить» of a regular payment: only rarer than monthly asks its amount (the others' is the plan's)
  const amountHere = !setup || (every === 'month' && period !== 1);

  async function save(text: string): Promise<string | null | false> {
    if (!target) return null;
    if (s.pick) return goSubscriptions(target, d.hasSubs, onLeave ?? onClose, onSaved);
    if (s.counted || fixedRegular) return null;
    // «Настроить» without the amount: the one it had (a month's: this month's item, else the latest month's)
    const amount = amountHere
      ? text
      : toInputValue(every === 'month' ? target.limit_minor || d.lastAmount : (target.unit_minor ?? 0));
    return submitPlanSheet({
      ym,
      target,
      text: amount,
      v: form.getValues(),
      adding: !!adding,
      locked: d.locked,
      free: d.free,
      onSaved,
      onClose,
      noAmount: !amountHere,
    });
  }

  // its category's page: the sheets close first (a page goes under the sheets)
  const toPage = (close: () => void) => () => {
    close();
    if (target) openCategory(target.category_id);
  };

  const hint = <PlanSheetHint label={target?.label} adding={adding} onBack={onBack} facts={{ ...d, shown }} />;

  return (
    <TextInputModal
      visible={target !== null}
      title={setup ? 'Регулярный платёж' : adding ? 'Добавить в план' : (target?.label ?? '')}
      // the category's name a link to its page (the sheet closes: a page goes under the sheets)
      onTitlePress={!adding && !setup && target ? toPage(onClose) : undefined}
      submitLabel={s.pick && !d.hasSubs ? 'Выбрать мерчанта' : adding ? 'Добавить в план' : undefined}
      noInput={s.pick || s.counted || fixedRegular || !amountHere}
      // «Настроить» and the sheet right after the kind is saved: saved as it is too
      alwaysSubmit={s.pick || setup || !!onBack}
      hint={setup ? null : hint}
      form={form}
      placeholder="0"
      keyboardType="decimal-pad"
      maxLength={12}
      allowEmpty
      onSubmit={save}
      onClose={onClose}
      // an item in the plan: removing it is a button under "Сохранить", as on the other sheets
      remove={
        onDelete
          ? {
              title: 'Удалить из плана',
              onPress: () => {
                onClose();
                onDelete();
              },
            }
          : undefined
      }
      inputAccessory={
        <Controller
          control={form.control}
          name="currency"
          render={({ field }) => <CurrencyButton value={field.value} onChange={field.onChange} />}
        />
      }
      label={fixedRegular || !amountHere ? undefined : s.regular ? 'Сумма за раз' : s.own ? 'Сумма платежа' : undefined}
      // what it is (its category's kind) first: the field under it is a month's amount
      above={
        setup || !target || target.by_merchant ? undefined : (
          <KindPlate kind={kind} onOpen={toPage(onLeave ?? onClose)} />
        )
      }
    >
      {kind === 'limit' ? <LimitNorm form={form} ym={ym} /> : null}
      {fixedRegular && target ? (
        <>
          <Text style={styles.amount}>{`В плане — ${formatWithCurrency(target.limit_minor, target.currency)}`}</Text>
          <Text style={formStyles.hint}>{REGULAR_HINT}</Text>
        </>
      ) : null}
      {kind === 'subs' && target && !target.by_merchant && !fixedRegular ? (
        setup ? (
          <RegularFields
            ym={ym}
            categoryId={target.category_id}
            form={form as unknown as Parameters<typeof RegularFields>[0]['form']}
          />
        ) : (
          <RegularPlanFields ym={ym} form={form as unknown as Parameters<typeof RegularPlanFields>[0]['form']} />
        )
      ) : null}
      {kind === 'fixed' && target && !setup && !target.by_merchant ? (
        <OneOffDueField ym={ym} form={form as unknown as UseFormReturn<DueForm>} />
      ) : null}
      {kind === 'subs' && target?.by_merchant ? (
        <Text style={formStyles.hint}>
          {s.pick ? (d.hasSubs ? RESUME_HINT : PICK_HINT) : s.counted ? COUNTED_HINT : BY_HAND_HINT}
        </Text>
      ) : null}
    </TextInputModal>
  );
}

const styles = StyleSheet.create({
  amount: { fontSize: font.title, fontWeight: weight.semibold, color: colors.text },
});
