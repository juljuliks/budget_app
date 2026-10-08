import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { GearIcon } from './icons';
import { guardLeave } from '../leaveGuard';
import SettingsSheet from './SettingsSheet';
import { colors } from './theme';

/** Gear in the tab headers: opens the settings sheet. */
export default function SettingsButton() {
  const [open, setOpen] = useState(false);
  // one view for the button and its sheet, so opening it doesn't shift the header row
  return (
    <View>
      <TouchableOpacity onPress={() => guardLeave(() => setOpen(true))} hitSlop={10} style={styles.button} accessibilityLabel="Настройки">
        <GearIcon color={colors.accent} size={22} />
      </TouchableOpacity>
      <SettingsSheet open={open} onClose={() => setOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { padding: 4 },
});
