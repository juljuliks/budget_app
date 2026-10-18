import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GearIcon } from './icons';
import { colors } from '../theme/theme';

type Props = {
  title: string;
  onSettings?: () => void;
  settingsLabel?: string;
  /** an action at the right edge, on the title's line ("Разделить по категориям") */
  right?: React.ReactNode;
};

/** Small uppercase section title, optionally with a gear that opens its settings screen, an action at the right. */
export default function SectionHeading({ title, onSettings, settingsLabel, right }: Props) {
  return (
    <View style={styles.row}>
      <Text style={[styles.title, right ? styles.grow : null]}>{title}</Text>
      {onSettings ? (
        <TouchableOpacity onPress={onSettings} hitSlop={12} accessibilityLabel={settingsLabel ?? `Настройки: ${title}`}>
          <GearIcon color={colors.muted} size={18} />
        </TouchableOpacity>
      ) : null}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 8 },
  title: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase' },
  grow: { flex: 1 },
});
