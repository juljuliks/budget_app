import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/shared/theme/theme';

type Option<T extends string> = { value: T; title: string; note: string };

/** Cards to pick one of ("Чем покрыть?", "Куда остаток?"): a title and what it does; the picked one outlined. */
export default function Choice<T extends string>({ options, value, onChange }: { options: Array<Option<T>>; value: T | null; onChange: (v: T) => void }) {
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <TouchableOpacity key={o.value} style={[styles.card, on && styles.on]} onPress={() => onChange(o.value)}
            accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={o.title}>
            <Text style={styles.title}>{o.title}</Text>
            <Text style={styles.note}>{o.note}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  card: { backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#D1D5DB', gap: 2 },
  // the border takes a point of the padding: the same size as the others
  on: { borderWidth: 2, borderColor: colors.accent, paddingHorizontal: 11, paddingVertical: 9 },
  title: { fontSize: 15, fontWeight: '500', color: colors.text },
  note: { fontSize: 13, color: colors.muted },
});
