import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SettingsButton } from '@/features/settings';
import { PencilIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';

/** "Редактировать" / "Готово" in the tab header, next to the title, and the gear. */
export default function HeaderActions({ editMode, onToggle }: { editMode: boolean; onToggle: () => void }) {
  return (
    <View style={styles.headerRight}>
      <TouchableOpacity
        style={[styles.editToggle, editMode && styles.editToggleOn]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ selected: editMode }}
      >
        <PencilIcon color={editMode ? colors.onAccent : colors.accent} size={13} />
        <Text style={[styles.editToggleText, editMode && styles.editToggleTextOn]}>{editMode ? 'Готово' : 'Редактировать'}</Text>
      </TouchableOpacity>
      <SettingsButton />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 16 },
  editToggle: {
    // as tall as the title text
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 2,
    borderRadius: 16, borderWidth: 1, borderColor: colors.accent,
  },
  editToggleOn: { backgroundColor: colors.accent },
  editToggleText: { fontSize: 13, color: colors.accent },
  editToggleTextOn: { color: colors.onAccent },
});
