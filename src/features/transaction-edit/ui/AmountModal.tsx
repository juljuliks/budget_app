import React from 'react';
import { Controller } from 'react-hook-form';
import { Currency, isCurrency } from '@/db/fx';
import { saveTransactionAmount } from '@/entities/transaction';
import CurrencyButton from '@/shared/ui/CurrencyButton';
import TextInputModal from '@/shared/ui/TextInputModal';
import { useLoadedForm } from '@/shared/ui/form';
import { toast } from '@/shared/ui/toast';
import { parseAmountInput, toInputValue } from '@/shared/lib/money';
import { AMOUNT_HINT } from '@/shared/lib/strings';
import type { Tx } from '../model/useTransaction';

type Props = { visible: boolean; tx: Tx; onClose: () => void; onSaved: () => void };

/** Correcting the operation's amount and its currency. */
export default function AmountModal({ visible, tx, onClose, onSaved }: Props) {
  // the amount and its currency, from what is saved
  const form = useLoadedForm<{ value: string; currency: Currency }>(
    visible ? { value: toInputValue(tx.amount_minor), currency: isCurrency(tx.currency) ? tx.currency : 'GEL' } : null, visible);

  async function save(text: string): Promise<string | null> {
    const minor = parseAmountInput(text);
    if (minor === null) return AMOUNT_HINT;
    await saveTransactionAmount(tx.id, minor, form.getValues('currency'));
    toast('Сумма изменена');
    onSaved();
    return null;
  }

  return (
    <TextInputModal
      visible={visible}
      title="Сумма"
      form={form}
      placeholder="0.00"
      keyboardType="decimal-pad"
      maxLength={12}
      onSubmit={save}
      onClose={onClose}
      inputAccessory={<Controller control={form.control} name="currency" render={({ field }) => <CurrencyButton value={field.value} onChange={field.onChange} />} />}
    />
  );
}
