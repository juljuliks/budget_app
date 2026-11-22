import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { styles } from './styles';

/** A settings row opening a page or a sheet: its name and ›. */
export default function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button">
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}
