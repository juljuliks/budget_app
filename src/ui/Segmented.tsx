import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from './theme';

type Props<T extends string> = {
  options: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

/** iOS-style segmented control: "Расход | Доход", "Статистика | План | История", filter modes. */
export default function Segmented<T extends string>({ options, value, onChange, style }: Props<T>) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map(([key, label]) => (
        <TouchableOpacity
          key={key}
          style={[styles.segment, value === key && styles.segmentOn]}
          onPress={() => onChange(key)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === key }}
        >
          <Text style={[styles.text, value === key && styles.textOn]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 8, padding: 2 },
  segment: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 6 },
  segmentOn: { backgroundColor: colors.bg },
  text: { fontSize: 14, color: colors.muted },
  textOn: { color: colors.text, fontWeight: '600' },
});
