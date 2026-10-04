import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { periodStats, PeriodStats } from '../../db/plans';
import { useDisplayCurrency } from '../../displayCurrency';
import { onTransactionsChanged } from '../../events';
import type { RootStackParamList } from '../../navigation';
import Donut from '../Donut';
import { formatDay } from '../format';
import { formatShort } from '../money';
import { colors } from '../theme';
import { DonutCenter } from './StatsView';

type Props = NativeStackScreenProps<RootStackParamList, 'DayStats'>;

const DAY = 86400;

/** Like the month's stats, for one day (opened from a day header in the transactions list). */
export default function DayStats({ route, navigation }: Props) {
  const { day } = route.params;
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // the currency picked on the transactions screen
  const currency = useDisplayCurrency('transactions');

  useLayoutEffect(() => {
    navigation.setOptions({ title: `Траты: ${formatDay(day).toLowerCase()}` });
  }, [navigation, day]);

  const load = useCallback(() => {
    // the day's local midnight to the next one (a DST day is 23 / 25 hours)
    const start = new Date(day * 1000);
    const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1).getTime() / 1000;
    periodStats(day, next || day + DAY, currency).then(setStats).catch((e) => console.error('load day stats failed', e));
  }, [day, currency]);
  useEffect(load, [load]);
  useEffect(() => onTransactionsChanged(load), [load]);

  const segments = useMemo(() => (stats?.groups ?? []).flatMap((g) => g.categories)
    .map((c) => ({ key: String(c.category_id), value: c.spent_minor, color: c.color })), [stats]);

  if (!stats) return <View style={styles.center}><ActivityIndicator /></View>;
  const picked = selected === null ? undefined : stats.categories.find((c) => String(c.category_id) === selected);
  const share = (minor: number) => (stats.spent_minor > 0 ? Math.round((minor / stats.spent_minor) * 100) : 0);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.donutWrap}>
        <Donut segments={segments} selectedKey={picked ? selected : null} onSelect={setSelected}>
          <DonutCenter total={stats.spent_minor} picked={picked} currency={stats.currency} />
        </Donut>
      </View>
      {stats.categories.length === 0 ? <Text style={styles.hint}>В этот день трат нет.</Text> : null}
      {stats.groups.map((g) => (
        <View key={`${g.type_id}-${g.title}`} style={styles.group}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            <Text style={styles.groupTotal}>{formatShort(g.spent_minor)}</Text>
          </View>
          {g.categories.map((c) => (
            <View key={String(c.category_id)} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: c.color }]} />
              <Text style={styles.name} numberOfLines={1}>{`${c.emoji || ''} ${c.name}`.trim()}</Text>
              <Text style={styles.share}>{share(c.spent_minor)}%</Text>
              <Text style={styles.amount}>{formatShort(c.spent_minor)} {stats.currency}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  donutWrap: { alignItems: 'center', marginBottom: 8 },
  hint: { color: colors.muted, fontSize: 14, textAlign: 'center', marginVertical: 12 },
  group: { marginTop: 16 },
  groupHeader: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingBottom: 4, borderBottomWidth: 1, borderColor: colors.border,
  },
  groupTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase' },
  groupTotal: { fontSize: 13, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  name: { flex: 1, fontSize: 15, color: colors.text },
  share: { fontSize: 13, color: colors.muted, marginHorizontal: 10, fontVariant: ['tabular-nums'] },
  amount: { fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
});
