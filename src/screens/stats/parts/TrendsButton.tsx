import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { openTrends } from '@/shared/navigation/navigation';
import { colors } from '@/shared/theme/theme';
import { TrendsIcon } from '@/shared/ui/icons';

/** By the eye in the stats header: «Динамика трат». */
export default function TrendsButton() {
  return (
    <TouchableOpacity onPress={openTrends} hitSlop={10} style={styles.button} accessibilityRole="button" accessibilityLabel="Динамика трат">
      <TrendsIcon color={colors.accent} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { padding: 4 },
});
