import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { GearIcon } from '@/shared/ui/icons';
import { guardLeave } from '@/shared/navigation/leaveGuard';
import { openSettings } from '@/shared/navigation/sheets';
import { colors } from '@/shared/theme/theme';

/** Gear in the tab headers: opens the settings sheet (ModalHost draws it). */
export default function SettingsButton() {
  return (
    <TouchableOpacity onPress={() => guardLeave(openSettings)} hitSlop={10} style={styles.button} accessibilityLabel="Настройки">
      <GearIcon color={colors.accent} size={22} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { padding: 4 },
});
