import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from './theme';

type Props<T extends string> = {
  options: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  /** greyed out, not selectable */
  disabled?: ReadonlyArray<T>;
};

/** iOS-style segmented control: "Расход | Доход", "Статистика | План | История", filter modes. */
export default function Segmented<T extends string>({ options, value, onChange, style, disabled }: Props<T>) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map(([key, label]) => {
        const off = disabled?.includes(key) ?? false;
        return (
          <TouchableOpacity
            key={key}
            style={[styles.segment, value === key && styles.segmentOn]}
            onPress={() => onChange(key)}
            disabled={off}
            accessibilityRole="tab"
            accessibilityState={{ selected: value === key, disabled: off }}
          >
            <Text style={[styles.text, value === key && styles.textOn, off && styles.textOff]} numberOfLines={1}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 8, padding: 2 },
  segment: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 6 },
  segmentOn: { backgroundColor: colors.bg },
  text: { fontSize: 14, color: colors.muted },
  textOn: { color: colors.text, fontWeight: '600' },
  textOff: { opacity: 0.4 },
});
