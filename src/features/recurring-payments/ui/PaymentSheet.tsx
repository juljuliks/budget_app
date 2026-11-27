import { toastFailure } from '@/shared/ui/toast';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { AMOUNT_HINT, SAVE_FAILED } from '@/shared/lib/strings';

import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import CurrencyButton from '@/shared/ui/CurrencyButton';
import TextField from '@/shared/ui/TextField';
import { TrashIcon } from '@/shared/ui/icons';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import { ONCE } from '@/db/recurring';

import { confirmDeletePayment, submitPayment } from '../model/commands';
import { CategorySummaryRow, SUBSCRIPTION_WORDS as w } from '@/entities/category';
import { showOperationsFrom } from '@/shared/navigation/navigation';
import { PaymentTarget, usePaymentForm } from '../model/usePaymentForm';
import { usePaymentOperations } from '../model/usePaymentOperations';
import { PaymentPlanPlate, PaymentWhen } from './PaymentSheetParts';
import { SavingFields, usePaymentSaving } from '@/entities/plan';

import { space } from '@/shared/theme/tokens';

type Props = {
  /** null = closed */
  target: PaymentTarget | null;
  onClose: () => void;
  /** after it is saved (an operation picked for it: back to where it was picked for) */
  onSaved?: () => void;
  /** before going to its operations: closes this sheet and the ones under it (by default — this one) */
  onLeave?: () => void;
};

/**
 * A repeating payment: name, amount, how often, the next charge's day (offered from the merchant's last charge, follows the
 * period until picked by hand) and what it does to the plan ("В план октября +30 ₾"). Opened from an operation just
 * put in "Подписки": "Пропустить" keeps it without a day ("Без даты списания"), not asked again.
 */
export default function PaymentSheet({ target, onClose, onSaved, onLeave }: Props) {
  const f = usePaymentForm(target);
  const ops = usePaymentOperations(target);
  const saving = usePaymentSaving(target, f.period, f.input?.amount_minor ?? null, f.due);
  const amountBad = f.amount.trim() !== '' && f.input === null && !!f.name.trim();
  // its end before the next charge: no charge at all
  const endBad = f.period !== ONCE && !!f.until && !!f.due && f.until < f.due;
  const save = () => {
    if (f.input)
      submitPayment(
        f.input,
        target?.id,
        () => {
          onClose();
          onSaved?.();
        },
        saving.choice,
      );
  };
  const skip = () => {
    if (f.input) submitPayment({ ...f.input, due: null }, target?.id, onClose);
    else onClose();
  };
  const icon = target?.category.emoji ?? '🔁';
  const title =
    target?.id !== undefined
      ? `${icon} ${target.name}`
      : target?.merchant_key
        ? `${icon} ${w.One} «${target.merchant_key}»`
        : target
          ? `${icon} ${target.name}`
          : '';
  return (
    <BottomSheet
      visible={target !== null}
      onClose={onClose}
      title={title}
      style={styles.root}
      headerRight={
        target?.id !== undefined ? (
          <TouchableOpacity
            onPress={() => {
              confirmDeletePayment(target.id!, target.name, target.currency, target.category, onClose).catch(
                toastFailure('confirmDeletePayment', SAVE_FAILED),
              );
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Удалить ${w.acc}`}
          >
            <TrashIcon color={colors.danger} size={22} />
          </TouchableOpacity>
        ) : null
      }
    >
      <SheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* like a merchant's and a category's page: how many operations and how much — a link to them */}
        {ops ? (
          <CategorySummaryRow
            summary={ops.summary}
            onShow={() => {
              (onLeave ?? onClose)();
              showOperationsFrom(ops.filter);
            }}
          />
        ) : null}
        {target?.from_operation ? (
          <Text style={[formStyles.hint, styles.lead]}>
            Запомним, когда спишется следующая, — она встанет в план своего месяца.
          </Text>
        ) : null}
        <TextField
          label="Название"
          value={f.name}
          onChangeText={f.setName}
          placeholder="Например, Netflix"
          maxLength={40}
          accessibilityLabel="Название"
        />
        <TextField
          label="Сумма"
          amount
          large
          value={f.amount}
          onChangeText={f.setAmount}
          accessibilityLabel="Сумма"
          right={<CurrencyButton value={f.currency} onChange={f.setCurrency} />}
          error={amountBad ? AMOUNT_HINT : null}
        />
        <PaymentWhen f={f} endBad={endBad} />
        <SavingFields s={saving} amount={f.input?.amount_minor ?? null} currency={f.currency} due={f.due} />
        <PaymentPlanPlate f={f} contribution={saving.contribution} />
        <SheetActions
          submit={{
            title: 'Сохранить',
            onPress: save,
            disabled: !f.input || !f.due || endBad || saving.startBad || !saving.choice,
          }}
          onCancel={target?.from_operation ? skip : onClose}
          cancelTitle={target?.from_operation ? 'Пропустить' : 'Отмена'}
        />
      </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: { maxHeight: '94%' },
  content: { paddingHorizontal: space[20], paddingBottom: space[8] },
  lead: { marginTop: 0 },
});
