import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '../theme/theme';

type Props = {
  /** the step shown, from 0 */
  at: number;
  count: number;
  /** the step's name: "Шаг 2 из 2 · Сумма" */
  name: string;
  /** "‹ Назад": none on the first step */
  onBack?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Over a sheet that goes by steps ("Итоги месяца", "Добавить в план"): "‹ Назад", "Шаг N из M · …" and a dash per step. */
export default function StepsNav({ at, count, name, onBack, style }: Props) {
  return (
    <View style={style}>
      <View style={styles.nav}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={8} accessibilityRole="button">
            <Text style={styles.back}>‹ Назад</Text>
          </TouchableOpacity>
        ) : <View />}
        <Text style={styles.stepOf}>{`Шаг ${at + 1} из ${count} · ${name}`}</Text>
      </View>
      <View style={styles.progress}>
        {Array.from({ length: count }, (_, i) => <View key={i} style={[styles.dash, i <= at && styles.dashOn]} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  back: { fontSize: 15, color: colors.accent },
  stepOf: { fontSize: 13, color: colors.muted },
  progress: { flexDirection: 'row', gap: 6, paddingTop: 8, paddingBottom: 12 },
  dash: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  dashOn: { backgroundColor: colors.accent },
});
