import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from './theme';

/** Round "+" pinned to the bottom right corner. */
export default function Fab({ onPress, accessibilityLabel }: { onPress: () => void; accessibilityLabel: string }) {
  return (
    <TouchableOpacity style={styles.fab} onPress={onPress} accessibilityLabel={accessibilityLabel} accessibilityRole="button">
      <Text style={styles.text}>＋</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute', right: 16, bottom: 16, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
  text: { color: '#FFFFFF', fontSize: 28, lineHeight: 32 },
});
