import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from './theme';

type Props<T extends string> = {
  options: ReadonlyArray<readonly [T, string, string?]>;
  value: T;
  onChange: (value: T) => void;
};

/** Vertical list of radio buttons: [value, label, optional hint under the label]. */
export default function RadioGroup<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.group}>
      {options.map(([key, label, hint]) => {
        const on = value === key;
        return (
          <TouchableOpacity
            key={key}
            style={styles.option}
            onPress={() => onChange(key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
          >
            <View style={[styles.circle, on && styles.circleOn]}>{on ? <View style={styles.dot} /> : null}</View>
            <View style={styles.texts}>
              <Text style={styles.label}>{label}</Text>
              {hint ? <Text style={styles.hint}>{hint}</Text> : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 4 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  circle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.muted,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  circleOn: { borderColor: colors.accent },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  texts: { flex: 1 },
  label: { fontSize: 15, color: colors.text },
  hint: { fontSize: 12, color: colors.muted, marginTop: 1 },
});
