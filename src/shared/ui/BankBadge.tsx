import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/theme';
import { font, radius, weight } from '../theme/tokens';

/** A bank's round mark: its short name on its color ("TBC"); large — the bank's card in «Банки». */
export default function BankBadge({ short, color, large }: { short: string; color: string; large?: boolean }) {
  return (
    <View style={[styles.badge, large && styles.large, { backgroundColor: color }]}>
      <Text style={[styles.text, large && styles.textLarge]}>{short}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  large: { width: 34, height: 34 },
  text: { fontSize: font.micro, fontWeight: weight.bold, color: colors.onAccent },
  textLarge: { fontSize: font.caption },
});
