import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ImpulseSummary } from '@/stats/impulse';
import Masked from '@/shared/ui/Masked';
import { chart, colors } from '@/shared/theme/theme';

/**
 * "Импульсивные · 7" against "Обдуманные · 5": a bar of their counts and under each its sum and average purchase (the
 * month's report, a category's dynamics). `big`: the dynamics' larger text.
 */
export default function ImpulseShare({ s, money, big }: { s: ImpulseSummary; money: (minor: number) => string; big?: boolean }) {
  const side = (label: string, color: string, t: ImpulseSummary['impulsive'], right?: boolean) => (
    <View style={right ? styles.right : undefined}>
      <Text style={[styles.label, big && styles.labelBig]}><Text style={{ color }}>● </Text>{label} · {t.count}</Text>
      <Text style={styles.note}>
        <Masked style={styles.note}>{money(t.sum)}</Masked>
        {t.count > 0 ? <> · в среднем <Masked style={styles.note}>{money(t.sum / t.count)}</Masked></> : null}
      </Text>
    </View>
  );
  return (
    <>
      <View style={styles.bar}>
        {s.impulsive.count > 0 ? <View style={[styles.part, { flex: s.impulsive.count, backgroundColor: colors.impulse }]} /> : null}
        {s.intentional.count > 0 ? <View style={[styles.part, { flex: s.intentional.count, backgroundColor: chart.meterFill }]} /> : null}
      </View>
      <View style={styles.sides}>
        {side('Импульсивные', colors.impulse, s.impulsive)}
        {side('Обдуманные', chart.meterFill, s.intentional, true)}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2, marginTop: 4 },
  part: { height: '100%' },
  sides: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  right: { alignItems: 'flex-end' },
  label: { fontSize: 14, color: colors.text },
  labelBig: { fontSize: 16 },
  note: { fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
});
