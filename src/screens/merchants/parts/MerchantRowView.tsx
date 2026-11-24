import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MerchantRow } from '@/db/merchants';
import Checkbox from '@/shared/ui/Checkbox';
import { colors } from '@/shared/theme/theme';
import { activityText } from '../model/activity';
import { font, space } from '@/shared/theme/tokens';

type Props = {
  m: MerchantRow;
  /** the stale section mixes categories: each row names its own */
  category: string | null;
  selecting: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onPressIn: () => void;
};

/** A merchant: its name, its purchases lately; a checkbox in front while selecting. */
export default function MerchantRowView({ m, category, selecting, selected, onPress, onLongPress, onPressIn }: Props) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} onLongPress={onLongPress} onPressIn={onPressIn}>
      {selecting ? <Checkbox checked={selected} size={20} /> : null}
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {m.name}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {category ? `${category} · ` : ''}
          {activityText(m.activity)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingHorizontal: space[16],
    paddingVertical: space[12],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  main: { flex: 1, minWidth: 0 },
  name: { fontSize: font.input, color: colors.text },
  meta: { fontSize: font.meta, color: colors.muted, marginTop: space[2] },
});
