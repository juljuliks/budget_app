import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from './theme';

export default function Checkbox({ checked, size = 22 }: { checked: boolean; size?: number }) {
  return (
    <View style={[styles.box, { width: size, height: size, borderRadius: size / 4 }, checked && styles.on]}>
      {checked ? <Text style={[styles.tick, { fontSize: size * 0.7, lineHeight: size * 0.9 }]}>✓</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  on: { backgroundColor: colors.accent, borderColor: colors.accent },
  tick: { color: '#FFFFFF', fontWeight: '700' },
});
