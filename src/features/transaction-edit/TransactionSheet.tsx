import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { confirmDeleteTransaction } from '@/entities/transaction';
import { isRememberable } from '@/types';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import { useLast } from '@/shared/lib/useLast';
import { openMerchant } from '@/shared/navigation/sheets';
import { colors } from '@/shared/theme/theme';
import { useCategoryChoice } from './model/useCategoryChoice';
import { useTransaction } from './model/useTransaction';
import AmountModal from './ui/AmountModal';
import NoteSection from './ui/NoteSection';
import TransactionCategory from './ui/TransactionCategory';
import TransactionHeader from './ui/TransactionHeader';

type Props = {
  /** the operation to show; null = closed */
  txId: number | null;
  onClose: () => void;
};

/**
 * An operation in a sheet (from the list or a notification): the amount (tap to correct it), its category and the
 * merchant's (a refund is subtracted from its category), the SMS, a note; "Удалить операцию" at the bottom.
 */
export default function TransactionSheet({ txId: openId, onClose }: Props) {
  // kept while the sheet slides away
  const txId = useLast(openId) ?? -1;
  const visible = openId !== null;
  const { tx, merchantCategory, mixedCats, reload } = useTransaction(txId, visible);
  const { saving, choose } = useCategoryChoice(txId, tx, visible, onClose);
  const [amountOpen, setAmountOpen] = useState(false);

  if (!tx) {
    return (
      <BottomSheet visible={visible} onClose={onClose} title="Операция">
        <View style={styles.center}><ActivityIndicator /></View>
      </BottomSheet>
    );
  }
  const merchantName = tx.raw_merchant || tx.merchant_key;
  // only purchases / payments are remembered for their merchant (see assignCategory)
  const rememberable = !!tx.merchant_key && isRememberable(tx.kind);

  return (
    <BottomSheet visible={visible} onClose={onClose} style={styles.sheet}>
    <SheetScrollView contentContainerStyle={styles.content}>
      <TransactionHeader tx={tx} onEditAmount={() => setAmountOpen(true)} onOpenMerchant={rememberable ? () => openMerchant(tx.merchant_key!) : undefined} />
      <TransactionCategory tx={tx} mixedCats={mixedCats} saving={saving} choose={choose} />

      {rememberable && mixedCats ? (
        <Text style={styles.merchantInfo}>У «{merchantName}» разные категории: каждая новая операция спрашивает.</Text>
      ) : null}
      {rememberable && merchantCategory ? (
        <Text style={styles.merchantInfo}>
          Категория мерчанта «{merchantName}»: {merchantCategory}. Новые операции мерчанта получают её автоматически.
        </Text>
      ) : null}

      {tx.raw_sms ? (
        <>
          <Text style={styles.heading}>SMS</Text>
          <Text style={styles.sms} selectable>{tx.raw_sms}</Text>
        </>
      ) : null}

      <NoteSection txId={tx.id} note={tx.note} onSaved={reload} />
      <AmountModal visible={amountOpen} tx={tx} onClose={() => setAmountOpen(false)} onSaved={reload} />

      <SheetActions submit={null} extra={[{ title: 'Удалить операцию', danger: true, onPress: () => confirmDeleteTransaction(tx, onClose) }]} />
    </SheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { maxHeight: '92%' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  center: { height: 160, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: 24, marginBottom: 8, textTransform: 'uppercase' },
  merchantInfo: { fontSize: 13, color: colors.muted, marginTop: 10 },
  sms: { fontSize: 13, color: colors.muted, backgroundColor: colors.surface, padding: 12, borderRadius: 8 },
});
