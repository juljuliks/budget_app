import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { dayTitle } from '@/shared/lib/dates';
import { formatWithCurrency } from '@/shared/lib/money';
import { AMOUNT_HINT } from '@/shared/lib/strings';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import Chip from '@/shared/ui/Chip';
import CurrencyButton from '@/shared/ui/CurrencyButton';
import DateField from '@/shared/ui/DateField';
import { TrashIcon } from '@/shared/ui/icons';
import StepsNav from '@/shared/ui/StepsNav';
import TextInputModal from '@/shared/ui/TextInputModal';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import { todayKey } from '@/db/subscriptions';
import { confirmDeleteSub, saveSub } from '../model/commands';
import { SubscriptionTarget, useSubscriptionForm } from '../model/useSubscriptionForm';
import { inTime, monthGen, periodText, PERIODS } from '../texts';

type Props = {
  /** null = closed */
  target: SubscriptionTarget | null;
  onClose: () => void;
  /** step 2 of "Добавить подписку": "‹ Назад" to the merchants */
  adding?: { onBack: () => void };
};

/**
 * A subscription: name, amount, how often, the next charge's day (offered from the merchant's last charge, follows the
 * period until picked by hand) and what it does to the plan ("В план октября +30 ₾"). Opened from an operation just
 * put in "Подписки": "Пропустить" keeps it without a day ("Без даты списания"), not asked again.
 */
export default function SubscriptionSheet({ target, onClose, adding }: Props) {
  const f = useSubscriptionForm(target);
  const [otherOpen, setOtherOpen] = useState(false);
  const custom = !PERIODS.some(([m]) => m === f.period);
  const amountBad = f.amount.trim() !== '' && f.input === null && !!f.name.trim();
  const save = () => { if (f.input) saveSub(f.input, target?.id, onClose); };
  const skip = () => { if (f.input) saveSub({ ...f.input, due: null }, target?.id, onClose); else onClose(); };
  const title = target?.id !== undefined ? `📺 ${target.name}` : target?.merchant_key ? `📺 Подписка «${target.merchant_key}»` : '📺 Новая подписка';
  return (
    <BottomSheet
      visible={target !== null} onClose={onClose} title={title} style={styles.root}
      headerRight={target?.id !== undefined ? (
        <TouchableOpacity onPress={() => confirmDeleteSub(target.id!, target.name, onClose)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Удалить подписку">
          <TrashIcon color={colors.danger} size={22} />
        </TouchableOpacity>
      ) : null}
    >
      <SheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {adding ? <StepsNav at={1} count={2} name="Подписка" onBack={adding.onBack} /> : null}
        {target?.from_operation ? (
          <Text style={[formStyles.hint, styles.lead]}>Запомним, когда спишется следующая, — она встанет в план своего месяца.</Text>
        ) : null}
        <Text style={formStyles.label}>Название</Text>
        <TextInput style={formStyles.input} value={f.name} onChangeText={f.setName} placeholder="Например, Netflix" placeholderTextColor={colors.muted} maxLength={40} accessibilityLabel="Название" />
        <Text style={formStyles.label}>Сумма</Text>
        <View style={styles.amountRow}>
          <TextInput
            style={[formStyles.input, styles.amount]} value={f.amount} onChangeText={f.setAmount} placeholder="0.00"
            placeholderTextColor={colors.muted} keyboardType="decimal-pad" maxLength={12} accessibilityLabel="Сумма"
          />
          <CurrencyButton value={f.currency} onChange={f.setCurrency} />
        </View>
        {amountBad ? <Text style={[formStyles.hint, styles.error]}>{AMOUNT_HINT}</Text> : null}
        <Text style={formStyles.label}>Как часто</Text>
        <View style={styles.chips}>
          {PERIODS.map(([m, label]) => <Chip key={m} label={label} selected={f.period === m} onPress={() => f.setPeriod(m)} />)}
          <Chip label={custom ? periodText(f.period) : 'Другое…'} selected={custom} action={!custom} onPress={() => setOtherOpen(true)} />
        </View>
        <DateField
          label="Следующее списание" value={f.due} format={dayTitle} sheetTitle="Следующее списание" minDay={todayKey()}
          suffix={f.due ? (inTime(f.due, todayKey()) ? ` · ${inTime(f.due, todayKey())}` : null) : null} onChange={f.setDue}
        />
        <Text style={formStyles.hint}>После списания дата сдвинется сама: пришла операция мерчанта — следующая через период.</Text>
        {f.effect && f.effect.delta_minor !== 0 ? (
          <View style={styles.plate}>
            <Text style={styles.plateTitle}>
              {`В план ${monthGen(f.effect.ym)} ${f.effect.delta_minor > 0 ? '+' : '−'}${formatWithCurrency(Math.abs(f.effect.delta_minor), f.effect.currency)}`}
            </Text>
            <Text style={styles.plateText}>Каждое списание — в план своего месяца.</Text>
          </View>
        ) : null}
        <SheetActions
          submit={{ title: 'Сохранить', onPress: save, disabled: !f.input || !f.due }}
          onCancel={target?.from_operation ? skip : onClose} cancelTitle={target?.from_operation ? 'Пропустить' : 'Отмена'}
        />
      </SheetScrollView>
      <TextInputModal
        visible={otherOpen} title="Раз в сколько месяцев" initialValue={custom ? String(f.period) : ''} keyboardType="number-pad"
        placeholder="Например, 2" submitLabel="Готово" onClose={() => setOtherOpen(false)}
        onSubmit={async (v) => {
          const n = Number(v.trim());
          if (!Number.isInteger(n) || n < 1 || n > 36) return 'Введите число месяцев, от 1 до 36';
          f.setPeriod(n);
          setOtherOpen(false);
          return null;
        }}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: { maxHeight: '94%' },
  content: { paddingHorizontal: 20, paddingBottom: 8 },
  lead: { marginTop: 0 },
  amountRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  amount: { flex: 1, fontSize: 18 },
  error: { color: colors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  plate: { marginTop: 14, borderRadius: 10, padding: 12, backgroundColor: colors.surface, gap: 4 },
  plateTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  plateText: { fontSize: 13, color: colors.muted },
});
