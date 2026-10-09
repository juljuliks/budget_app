import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Checkbox from '@/shared/ui/Checkbox';
import { colors } from '@/shared/theme/theme';

type Props = { count: number; allSelected: boolean; onToggleAll: () => void; onCancel?: () => void };

/** While selecting (started by a long press on a row; always while sorting out): how many, "Выбрать все", "Отмена". */
export default function SelectToolbar({ count, allSelected, onToggleAll, onCancel }: Props) {
  return (
    <View style={styles.toolbar}>
      <Text style={[styles.label, styles.flex]}>Выбрано: {count}</Text>
      <TouchableOpacity style={styles.toggle} onPress={onToggleAll} accessibilityRole="checkbox" accessibilityState={{ checked: allSelected }}>
        <Checkbox checked={allSelected} size={20} />
        <Text style={styles.label}>Выбрать все</Text>
      </TouchableOpacity>
      {onCancel ? (
        <TouchableOpacity onPress={onCancel} hitSlop={8} accessibilityRole="button">
          <Text style={styles.cancel}>Отмена</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // wraps to a second line when "Выбрать все" is shown and everything doesn't fit
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingVertical: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  label: { fontSize: 15, color: colors.text },
  flex: { flex: 1 },
  cancel: { fontSize: 15, color: colors.accent },
});
