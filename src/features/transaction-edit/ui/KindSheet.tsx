import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { IncomeKind } from '@/db/transactions';
import BottomSheet from '@/shared/ui/BottomSheet';
import RadioGroup from '@/shared/ui/RadioGroup';
import { KIND_CHOICES, pickKind } from '../model/kindChoice';
import type { Tx } from '../model/useTransaction';

type Props = { visible: boolean; tx: Tx; onClose: () => void };

/** "Тип операции" of money that came in (as "Группировать" in the operations): a tap picks and closes. */
export default function KindSheet({ visible, tx, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Тип операции">
      <View style={styles.content}>
        <RadioGroup options={KIND_CHOICES} value={tx.kind as IncomeKind} onChange={(k) => { onClose(); pickKind(tx, k); }} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 24 },
});
