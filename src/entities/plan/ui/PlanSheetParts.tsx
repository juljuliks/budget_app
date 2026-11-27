// The plan sheet's parts: the form's values from the item, the facts over the field, a limit's "Как тратите".
import React from 'react';
import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';
import { parseAmountOrZero, toInputValue } from '@/shared/lib/money';
import { colors } from '@/shared/theme/theme';
import { formStyles } from '@/shared/theme/formStyles';
import { font, space, weight } from '@/shared/theme/tokens';
import BackLink from '@/shared/ui/BackLink';
import RadioGroup from '@/shared/ui/RadioGroup';
import StepsNav from '@/shared/ui/StepsNav';
import type { PlanAmountTarget } from './PlanAmountModal';
import PlanFacts from './PlanFacts';
import { patterns } from './sheetOptions';
import type { PlanSheetForm } from './usePlanSheetData';

/** The saved item in the form; a category not in the plan yet starts as a day-to-day limit in the screen's currency. */
export function planFormDefaults(target: PlanAmountTarget): PlanSheetForm {
  return {
    value: toInputValue(target.every ? (target.unit_minor ?? 0) : target.limit_minor),
    currency: target.currency,
    // «📺 Подписки»: always its subscriptions (picked, counted or by hand till one has a day)
    kind: target.by_merchant || target.recurring || target.every ? 'subs' : (target.kind ?? 'limit'),
    pinned: !!target.pinned,
    until: target.until ?? null,
    every: target.every ?? 'month',
    weekdays: target.weekdays ?? 0,
    period: 1,
    next: null,
    due: null,
    norm: target.norm_period ?? 'day',
  };
}

/** Over the field: the facts; step 2 of "Добавить в план" — the steps and the category over them; "‹ Назад". */
export function PlanSheetHint({
  label,
  adding,
  onBack,
  facts,
}: {
  label?: string;
  adding?: { onBack: () => void };
  onBack?: () => void;
  facts: React.ComponentProps<typeof PlanFacts>;
}) {
  if (adding)
    return (
      <View>
        <StepsNav at={1} count={2} name="Сумма" onBack={adding.onBack} />
        <Text style={styles.category}>{label}</Text>
        <PlanFacts {...facts} />
      </View>
    );
  if (onBack)
    return (
      <View>
        <BackLink onPress={onBack} style={styles.back} />
        <PlanFacts {...facts} />
      </View>
    );
  return <PlanFacts {...facts} />;
}

/** A limit: "Как тратите" — its rhythm, each with what the entered amount comes to a day, a week, two. */
export function LimitNorm({ form, ym }: { form: UseFormReturn<PlanSheetForm>; ym: string }) {
  const [entered, enteredCurrency] = useWatch({ control: form.control, name: ['value', 'currency'] });
  return (
    <>
      <Text style={formStyles.label}>Как тратите</Text>
      <Controller
        control={form.control}
        name="norm"
        render={({ field }) => (
          <RadioGroup
            options={patterns(parseAmountOrZero(entered ?? ''), enteredCurrency, ym)}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <Text style={formStyles.hint}>По этому в статистике считается лимит на день или неделю.</Text>
    </>
  );
}

const styles = StyleSheet.create({
  category: { fontSize: font.title, fontWeight: weight.semibold, color: colors.text, marginBottom: space[12] },
  back: { marginBottom: space[12] },
});
