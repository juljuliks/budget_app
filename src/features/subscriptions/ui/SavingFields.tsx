import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { currencySymbol, formatWithCurrency } from '@/shared/lib/money';
import RadioGroup from '@/shared/ui/RadioGroup';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import { useSubscriptionSaving } from '../model/useSubscriptionSaving';
import { inMonth, longDay, monthGen, monthGenYear } from '../texts';

type Props = { s: ReturnType<typeof useSubscriptionSaving>; amount: number | null; currency: Currency; due: string | null };

/**
 * "Откладывать каждый месяц?" of a subscription charged less often than monthly: "Да, по 11.67 ₾ в месяц" (as a fund:
 * the charge is paid from what was saved) / "Нет, весь платёж в марте". Turning it on — "Уже отложено"; saving — what it has.
 */
export default function SavingFields({ s, amount, currency, due }: Props) {
  if (!s.offered) return null;
  const money = (minor: number) => formatWithCurrency(minor, currency);
  const ym = due?.slice(0, 7);
  const options = [
    ['yes', s.contribution !== null ? `Да, по ${money(s.contribution)} в месяц` : 'Да, каждый месяц',
      due && amount !== null ? `Как копилка: к ${longDay(due)} будет ${money(amount)}, списание не ударит по бюджету ${monthGen(ym!)}.` : undefined],
    ['no', ym ? `Нет, весь платёж ${inMonth(ym)}` : 'Нет, весь платёж в месяц списания',
      ym && amount !== null ? `${money(amount)} встанут в план ${monthGenYear(ym)}.` : undefined],
  ] as const;
  return (
    <>
      <Text style={formStyles.label}>Откладывать каждый месяц?</Text>
      <RadioGroup options={options} value={s.save ? 'yes' : 'no'} onChange={(v) => s.setSave(v === 'yes')} />
      {s.save && s.had?.saving ? (
        <Text style={formStyles.hint}>{`Отложено ${money(s.had.balance)}${amount !== null ? ` из ${money(amount)}` : ''}.`}</Text>
      ) : null}
      {s.save && s.had && !s.had.saving ? (
        <>
          <Text style={formStyles.label}>Уже отложено (необязательно)</Text>
          <View style={[formStyles.input, styles.amountRow]}>
            <TextInput
              style={styles.amountInput} value={s.start} onChangeText={s.setStart} placeholder="0.00" placeholderTextColor={colors.muted}
              keyboardType="decimal-pad" maxLength={12} accessibilityLabel="Уже отложено"
            />
            <Text style={styles.muted}>{currencySymbol(currency)}</Text>
          </View>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0 },
  amountInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 10 },
  muted: { color: colors.muted, fontSize: 14 },
});
