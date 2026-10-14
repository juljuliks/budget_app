import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { SheetActions } from '@/shared/ui/Button';
import Masked from '@/shared/ui/Masked';
import { colors } from '@/shared/theme/theme';
import type { Overspent, SavingsLess } from '../model/savingsLess';

type Props = {
  less: SavingsLess | null;
  visible: boolean;
  money: (minor: number) => string;
  onClose: () => void;
  /** a category's plan (a tap on it) */
  onOpen: (categoryId: number) => void;
};

function Row({ o, money, onOpen }: { o: Overspent; money: (minor: number) => string; onOpen?: () => void }) {
  const body = (
    <>
      <Text style={styles.emoji}>{o.emoji ?? ''}</Text>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>{o.name}</Text>
        <Masked style={styles.note}>{`${o.category_id === null ? 'доля' : 'план'} ${money(o.plan)} · потрачено ${money(o.spent)}`}</Masked>
      </View>
      <Masked style={styles.over}>{`−${money(o.over)}`}</Masked>
    </>
  );
  return onOpen ? (
    <TouchableOpacity style={styles.row} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`План: ${o.name}`}>{body}</TouchableOpacity>
  ) : <View style={styles.row}>{body}</View>;
}

/**
 * ⓘ of the savings the overspend took part of: by how much, what they'll be if the rest is spent by plan, and every
 * category past its plan (the spending outside the plan past its share too), the biggest first; a tap opens its plan.
 */
export default function SavingsLessSheet({ less, visible, money, onClose, onOpen }: Props) {
  return (
    <BottomSheet visible={visible && !!less} onClose={onClose} title={less ? `Сбережения меньше на ${money(less.less)}` : ''}>
      {less ? (
        <SheetScrollView contentContainerStyle={styles.content}>
          <Text style={styles.lead}>
            {`Эти категории потратили больше плана. Если дальше тратить по плану, в сбережения пойдёт ${money(less.now)} (−${money(less.less)})`}
          </Text>
          {less.overs.map((o) => (
            <Row key={o.key} o={o} money={money} onOpen={o.category_id === null ? undefined : () => { onClose(); onOpen(o.category_id!); }} />
          ))}
          <Text style={styles.hint}>Тап по категории — изменить её план</Text>
          <SheetActions submit={{ title: 'Понятно', onPress: onClose }} />
        </SheetScrollView>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 16 },
  lead: { fontSize: 14, color: colors.muted, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  emoji: { fontSize: 20, width: 26 },
  text: { flex: 1 },
  name: { fontSize: 16, color: colors.text },
  note: { fontSize: 13, color: colors.muted, marginTop: 2 },
  over: { fontSize: 16, color: colors.danger, fontVariant: ['tabular-nums'] },
  hint: { fontSize: 13, color: colors.muted, marginTop: 10 },
});
