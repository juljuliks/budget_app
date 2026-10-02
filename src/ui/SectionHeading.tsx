import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GearIcon } from './icons';
import { colors } from './theme';

/** Small uppercase section title, optionally with a gear that opens its settings screen. */
export default function SectionHeading({ title, onSettings, settingsLabel }: { title: string; onSettings?: () => void; settingsLabel?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {onSettings ? (
        <TouchableOpacity onPress={onSettings} hitSlop={12} accessibilityLabel={settingsLabel ?? `Настройки: ${title}`}>
          <GearIcon color={colors.muted} size={18} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 8 },
  title: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase' },
});
