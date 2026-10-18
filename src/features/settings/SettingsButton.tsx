import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { GearIcon } from '@/shared/ui/icons';
import { guardLeave } from '@/shared/navigation/leaveGuard';
import { navigationRef } from '@/shared/navigation/navigation';
import { colors } from '@/shared/theme/theme';

/** Gear in the tab headers: opens the settings page. */
export default function SettingsButton() {
  return (
    <TouchableOpacity onPress={() => guardLeave(() => navigationRef.navigate('Settings'))} hitSlop={10} style={styles.button} accessibilityLabel="Настройки">
      <GearIcon color={colors.accent} size={22} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { padding: 4 },
});
