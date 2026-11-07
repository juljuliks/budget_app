import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { colors } from '../theme/theme';

/** "‹ Назад" over a sheet: a step back (StepsNav) or back to where the sheet was opened from. */
export default function BackLink({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <TouchableOpacity style={style} onPress={onPress} hitSlop={8} accessibilityRole="button">
      <Text style={styles.back}>‹ Назад</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  back: { fontSize: 15, color: colors.accent },
});
