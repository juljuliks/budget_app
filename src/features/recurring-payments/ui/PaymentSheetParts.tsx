// The payment sheet's parts: how often and when (the next charge, the end), what it does to the plan.
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { currentYm } from '@/db/plans';
import { ONCE, todayKey } from '@/db/recurring';
import { dayTitle } from '@/shared/lib/dates';
import { PAYMENT_PERIODS as periods } from '@/shared/lib/format';
import { formatWithCurrency } from '@/shared/lib/money';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import { font, radius, space, weight } from '@/shared/theme/tokens';
import Chip from '@/shared/ui/Chip';
import DateField from '@/shared/ui/DateField';
import TextInputModal from '@/shared/ui/TextInputModal';
import type { usePaymentForm } from '../model/usePaymentForm';
import { inTime, monthGenYear, periodText } from '../texts';

type Form = ReturnType<typeof usePaymentForm>;

/** "Как часто" (another number of months in a dialog), the next charge, its end; the end before it — said. */
export function PaymentWhen({ f, endBad }: { f: Form; endBad: boolean }) {
  const [otherOpen, setOtherOpen] = useState(false);
  const custom = !periods.some(([m]) => m === f.period);
  const dueLabel = f.period === ONCE ? 'Дата списания' : 'Следующее списание';
  return (
    <>
      <Text style={formStyles.label}>Как часто</Text>
      <View style={styles.chips}>
        {periods.map(([m, label]) => (
          <Chip key={m} label={label} selected={f.period === m} onPress={() => f.setPeriod(m)} />
        ))}
        <Chip
          label={custom ? periodText(f.period) : 'Другое…'}
          selected={custom}
          action={!custom}
          onPress={() => setOtherOpen(true)}
        />
      </View>
      <DateField
        label={dueLabel}
        value={f.due}
        format={dayTitle}
        sheetTitle={dueLabel}
        minDay={todayKey()}
        suffix={f.due ? (inTime(f.due, todayKey()) ? ` · ${inTime(f.due, todayKey())}` : null) : null}
        onChange={f.setDue}
      />
      <Text style={formStyles.hint}>
        {f.period === ONCE
          ? 'Списание одно: после него в план больше не встанет.'
          : 'После списания дата сдвинется сама: пришла операция мерчанта — следующая через период.'}
      </Text>
      {f.period === ONCE ? null : (
        <DateField
          label="Дата окончания (необязательно)"
          value={f.until}
          format={dayTitle}
          sheetTitle="Дата окончания"
          minDay={f.due ?? todayKey()}
          onChange={f.setUntil}
          onClear={() => f.setUntil(null)}
        />
      )}
      {endBad ? <Text style={[formStyles.hint, styles.error]}>Дата окончания раньше следующего списания</Text> : null}
      <TextInputModal
        visible={otherOpen}
        title="Раз в сколько месяцев"
        initialValue={custom && f.period > 0 ? String(f.period) : ''}
        keyboardType="number-pad"
        placeholder="Например, 2"
        submitLabel="Готово"
        onClose={() => setOtherOpen(false)}
        onSubmit={(v) => {
          const n = Number(v.trim());
          if (!Number.isInteger(n) || n < 1 || n > 36) return Promise.resolve('Введите число месяцев, от 1 до 36');
          f.setPeriod(n);
          setOtherOpen(false);
          return Promise.resolve(null);
        }}
      />
    </>
  );
}

/** What it does to the plan: a monthly contribution while saving up, or the charge in its month's plan. */
export function PaymentPlanPlate({ f, contribution }: { f: Form; contribution: number | null }) {
  return (
    <>
      {contribution !== null ? (
        <View style={styles.plate}>
          <Text
            style={styles.plateTitle}
          >{`В план ${monthGenYear(currentYm())} +${formatWithCurrency(contribution, f.currency)}`}</Text>
          <Text
            style={styles.plateText}
          >{`Взнос каждый месяц до ${monthGenYear(f.due!.slice(0, 7))}; списание — из отложенного.`}</Text>
        </View>
      ) : f.effect && f.effect.delta_minor !== 0 ? (
        <View style={styles.plate}>
          <Text style={styles.plateTitle}>
            {`В план ${monthGenYear(f.effect.ym)} ${f.effect.delta_minor > 0 ? '+' : '−'}${formatWithCurrency(Math.abs(f.effect.delta_minor), f.effect.currency)}`}
          </Text>
          <Text style={styles.plateText}>Каждое списание — в план своего месяца.</Text>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[8] },
  plate: {
    marginTop: space[14],
    borderRadius: radius.md,
    padding: space[12],
    backgroundColor: colors.surface,
    gap: space[4],
  },
  plateTitle: { fontSize: font.input, fontWeight: weight.semibold, color: colors.text },
  plateText: { fontSize: font.meta, color: colors.muted },
});
