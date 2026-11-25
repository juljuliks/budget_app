import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '../theme/theme';
import { font, radius, space, weight } from '../theme/tokens';

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
            <Text style={[styles.text, value === key && styles.textOn, off && styles.textOff]} numberOfLines={1}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.sm, padding: space[2] },
  segment: { flex: 1, paddingVertical: space[8], alignItems: 'center', borderRadius: radius.sm },
  segmentOn: { backgroundColor: colors.bg },
  text: { fontSize: font.secondary, color: colors.muted },
  textOn: { color: colors.text, fontWeight: weight.semibold },
  textOff: { opacity: 0.4 },
});
