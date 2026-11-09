import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Masked from '@/shared/ui/Masked';
import { colors } from '@/shared/theme/theme';
import type { CoverRoom } from '../model/savingsLess';

type Props = {
  rooms: CoverRoom[];
  /** by how much the spending outside the plan is past its share */
  over: number;
  money: (minor: number) => string;
  onPick: (room: CoverRoom) => void;
};

/**
 * "Покрыть из плана" in "Сбережения меньше на …": the limits with something left, the most first — a tap takes of it
 * what the spending outside the plan is past its share (or all that is left) and adds it to the share this month.
 */
export default function CoverRooms({ rooms, over, money, onPick }: Props) {
  return (
    <>
      <Masked style={styles.lead}>{`Траты вне плана больше доли на ${money(over)}. Из какой категории взять?`}</Masked>
      {rooms.map((r) => (
        <TouchableOpacity
          key={r.category_id} style={styles.row} onPress={() => onPick(r)} accessibilityRole="button" accessibilityLabel={`Взять из «${r.name}»`}
        >
          <Text style={styles.emoji}>{r.emoji ?? ''}</Text>
          <View style={styles.text}>
            <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
            <Masked style={styles.note}>{`план ${money(r.plan)} · осталось ${money(r.left)}`}</Masked>
          </View>
          <Masked style={styles.take}>{`−${money(r.take)}`}</Masked>
        </TouchableOpacity>
      ))}
      <Text style={styles.hint}>План категории станет меньше, а доля вне плана в этом месяце — больше</Text>
    </>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 14, color: colors.muted, marginBottom: 6 },
  // as the overspent rows of the sheet
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  emoji: { fontSize: 20, width: 26 },
  text: { flex: 1 },
  name: { fontSize: 16, color: colors.text },
  note: { fontSize: 13, color: colors.muted, marginTop: 2 },
  take: { fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  hint: { fontSize: 13, color: colors.muted, marginTop: 10 },
});
