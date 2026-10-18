import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LastCharge, merchantsForPayment } from '@/db/recurring';
import { formatWithCurrency } from '@/shared/lib/money';
import { LOAD_FAILED } from '@/shared/lib/strings';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import SearchBar from '@/shared/ui/SearchBar';
import StepsNav from '@/shared/ui/StepsNav';
import { toastFailure } from '@/shared/ui/toast';
import { formStyles } from '@/shared/theme/formStyles';
import { paymentWords } from '@/entities/category';
import { PaymentCategory, PaymentTarget } from '../model/usePaymentForm';
import { shortDay } from '../texts';
import PaymentRow from './PaymentRow';

type Props = {
  visible: boolean;
  /** the payment's category */
  category: PaymentCategory;
  onClose: () => void;
  /** the merchant picked (or none): step 2, the repeating payment */
  onPick: (target: PaymentTarget) => void;
};

/**
 * Step 1 of "Добавить подписку": the merchant — those charged the same amount in two months or more first ("Похожи на
 * подписку"), then the others, found by name; "Без мерчанта" — one put in by name. Its last charge fills step 2.
 */
export default function AddPaymentSheet({ visible, category, onClose, onPick }: Props) {
  const w = paymentWords(category.name);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Array<LastCharge & { likely: boolean }> | null>(null);
  useEffect(() => {
    if (!visible) return undefined;
    let live = true;
    merchantsForPayment(query).then((r) => { if (live) setRows(r); }).catch(toastFailure('load merchants for a payment', LOAD_FAILED));
    return () => { live = false; };
  }, [visible, query]);
  useEffect(() => { if (!visible) setQuery(''); }, [visible]);

  const pick = (m: LastCharge) => onPick({
    category, merchant_key: m.merchant_key, name: m.name, amount_minor: m.amount_minor, currency: m.currency, period_months: 1, due: null, last_day: m.day,
  });
  const row = (m: LastCharge) => (
    <PaymentRow
      key={m.merchant_key} name={m.name} label={w.One} note={[`последняя ${shortDay(m.day)}`]}
      amount={formatWithCurrency(m.amount_minor, m.currency)} onPress={() => pick(m)}
    />
  );
  const likely = rows?.filter((r) => r.likely) ?? [];
  const others = rows?.filter((r) => !r.likely) ?? [];
  return (
    <BottomSheet visible={visible} onClose={onClose} title={w.add} style={styles.root}>
      <View style={styles.inset}>
        <StepsNav at={0} count={2} name="Мерчант" />
        <SearchBar value={query} onChange={setQuery} placeholder="Поиск мерчанта" />
      </View>
      <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {likely.length ? <Text style={formStyles.label}>{w.like}</Text> : null}
        {likely.map(row)}
        {others.length ? <Text style={formStyles.label}>{likely.length ? 'Остальные' : 'Мерчанты'}</Text> : null}
        {others.map(row)}
        {rows && !rows.length ? <Text style={formStyles.hint}>Не найдено</Text> : null}
        <SheetActions
          submit={null}
          extra={[{ title: 'Без мерчанта — ввести название', onPress: () => onPick({ category, merchant_key: null, name: query.trim(), amount_minor: 0, currency: 'GEL', period_months: 1, due: null }) }]}
          onCancel={onClose}
        />
      </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: { maxHeight: '94%' },
  inset: { paddingHorizontal: 20, gap: 8 },
  body: { paddingHorizontal: 20, paddingBottom: 20 },
});
