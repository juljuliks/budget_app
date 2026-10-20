import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Controller, UseFormReturn, useWatch } from 'react-hook-form';
import type { Currency } from '@/db/fx';
import { chargeBefore, lastCategoryDay, offeredDue, paymentCard, todayKey, windowOf } from '@/db/recurring';
import { dayTitle } from '@/shared/lib/dates';
import { plural } from '@/shared/lib/format';
import { toInputValue } from '@/shared/lib/money';
import DateField from '@/shared/ui/DateField';
import { formStyles } from '@/shared/theme/formStyles';
import { UntilField, RepeatForm } from './RepeatField';

/**
 * The category's own payment, monthly or rarer: the next charge (offered from its last spending plus the period; a monthly
 * one may go without — the amount by hand each month), its end.
 */
export type CategoryPaymentForm = RepeatForm & { period: number; next: string | null; value: string; currency: Currency };

type Props = { ym: string; categoryId: number; form: UseFormReturn<CategoryPaymentForm> };

/**
 * "Траты категории", "Каждый месяц" … "Раз в год": "Следующее списание" and "Дата окончания"; its saved payment comes back
 * (amount, how often, the next charge). Any spending of the category within the window of the day is the charge.
 */
export default function CategoryPaymentFields({ ym, categoryId, form }: Props) {
  const [period, next] = useWatch({ control: form.control, name: ['period', 'next'] });
  // the charge another period is counted from (its payment's last one, or the category's last spending); a day picked by
  // hand in this sheet stays
  const [anchor, setAnchor] = useState<string | null>(null);
  const [byHand, setByHand] = useState(false);
  useEffect(() => {
    (async () => {
      const own = await paymentCard(null, undefined, categoryId);
      if (own && !own.sub.merchant_key) {
        const saved = { value: toInputValue(own.sub.amount_minor), currency: own.sub.currency, period: own.sub.period, next: own.next, until: own.sub.until };
        form.reset({ ...form.getValues(), ...saved });
        if (own.next) setAnchor(chargeBefore(own.next, own.sub.period));
        return;
      }
      const day = await lastCategoryDay(categoryId);
      setAnchor(day);
      if (day && !form.getValues('next')) form.setValue('next', offeredDue(day, form.getValues('period') ?? 1, todayKey()), { shouldDirty: true });
    })().catch((e) => console.error('category payment failed', e));
    // once per category
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);
  // another period: the day follows it, until picked by hand
  useEffect(() => {
    if (anchor && !byHand) form.setValue('next', offeredDue(anchor, period, todayKey()), { shouldDirty: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, anchor]);
  return (
    <View>
      <Controller control={form.control} name="next" render={({ field }) => (
        <DateField
          label={period === 1 ? 'Следующее списание (необязательно)' : 'Следующее списание'} value={field.value} format={dayTitle}
          sheetTitle="Следующее списание" minDay={todayKey()}
          onChange={(day) => { setByHand(true); field.onChange(day); }}
          // a monthly one may go without: the amount stands in each month's plan
          onClear={period === 1 ? () => { setByHand(true); field.onChange(null); } : undefined}
        />
      )} />
      <Text style={formStyles.hint}>
        {next ? `Оплата — траты категории за ${windowOf(period)} ${plural(windowOf(period), ['день', 'дня', 'дней'])} до или после даты на сумму платежа; дата сдвинется сама.`
          : period === 1 ? 'Без даты сумма стоит в плане каждый месяц; оплачено — когда траты категории за месяц дойдут до неё.' : 'Выберите дату следующего списания.'}
      </Text>
      <UntilField ym={ym} form={form as unknown as UseFormReturn<RepeatForm>} />
    </View>
  );
}
