import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../../navigation';
import { HistoryMonth, monthStats, MonthStats, parseYm, planHistory } from '../../db/plans';
import { onTransactionsChanged } from '../../events';
import { formatMoney } from '../money';
import { chart, colors } from '../theme';
import { monthTitle } from './months';

/** Planned vs actually spent, per month and (expanded) per category. */
export default function HistoryView() {
  const [months, setMonths] = useState<HistoryMonth[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    planHistory().then(setMonths).catch((e) => console.error('load history failed', e));
  }, []);
  useFocusEffect(load);
  useEffect(() => onTransactionsChanged(load), [load]);

  if (!months) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <FlatList
      data={months}
      keyExtractor={(m) => m.ym}
      contentContainerStyle={styles.content}
      ListEmptyComponent={<Text style={styles.hint}>Истории пока нет.</Text>}
      renderItem={({ item }) => (
        <MonthRow
          month={item}
          expanded={expanded === item.ym}
          onToggle={() => setExpanded((cur) => (cur === item.ym ? null : item.ym))}
        />
      )}
    />
  );
}

function MonthRow({ month, expanded, onToggle }: { month: HistoryMonth; expanded: boolean; onToggle: () => void }) {
  const { year, month: m } = parseYm(month.ym);
  const { planned_minor: planned, spent_minor: spent } = month;
  const diff = planned - spent;

  return (
    <View style={styles.month}>
      <TouchableOpacity onPress={onToggle}>
        <View style={styles.monthTop}>
          <Text style={styles.monthTitle}>{monthTitle(year, m)}</Text>
          <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
        </View>
        <View style={styles.totals}>
          <Total label="План" value={planned ? formatMoney(planned, { compact: true }) : '—'} />
          <Total label="Потрачено" value={formatMoney(spent, { compact: true })} />
          <Total
            label={planned ? (diff >= 0 ? 'Осталось' : 'Перерасход') : ''}
            value={planned ? `${diff < 0 ? '⚠ ' : ''}${formatMoney(Math.abs(diff), { compact: true })}` : ''}
            danger={planned > 0 && diff < 0}
          />
        </View>
        {planned ? <Meter spent={spent} limit={planned} /> : null}
      </TouchableOpacity>
      {expanded ? <MonthDetails ym={month.ym} /> : null}
    </View>
  );
}

function MonthDetails({ ym }: { ym: string }) {
  // tap a category: its transactions (category filter), same as on the stats screen
  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const [stats, setStats] = useState<MonthStats | null>(null);
  useEffect(() => {
    const { year, month } = parseYm(ym);
    monthStats(year, month).then(setStats).catch((e) => console.error('load month failed', e));
  }, [ym]);

  if (!stats) return <ActivityIndicator style={styles.detailsLoading} />;
  if (stats.categories.length === 0) return <Text style={styles.hint}>Нет трат и плана.</Text>;

  return (
    <View style={styles.details}>
      <View style={styles.detailRow}>
        <Text style={[styles.detailName, styles.detailHead]}>Категория</Text>
        <Text style={[styles.detailNum, styles.detailHead]}>План</Text>
        <Text style={[styles.detailNum, styles.detailHead]}>Факт</Text>
      </View>
      {stats.groups.map((g) => (
        <View key={`${g.type_id}-${g.title}`}>
          <View style={[styles.detailRow, styles.groupRow]}>
            <Text style={[styles.detailName, styles.groupTitle]} numberOfLines={1}>{g.title}</Text>
            <Text style={[styles.detailNum, styles.groupTitle]}>{g.planned_minor ? formatMoney(g.planned_minor, { compact: true }) : '—'}</Text>
            <Text style={[styles.detailNum, styles.groupTitle]}>{formatMoney(g.spent_minor, { compact: true })}</Text>
          </View>
          {g.categories.map((c) => {
            const over = c.limit_minor !== null && c.spent_minor > c.limit_minor;
            return (
              <TouchableOpacity
                key={String(c.category_id)}
                style={styles.detailRow}
                onPress={() => navigation.navigate('Transactions', { category: c.category_id ?? 'none', nonce: Date.now() })}
              >
                <Text style={styles.detailName} numberOfLines={1}>{`${c.emoji || ''} ${c.name}`.trim()}</Text>
                <Text style={styles.detailNum}>{c.limit_minor ? formatMoney(c.limit_minor, { compact: true }) : '—'}</Text>
                <Text style={[styles.detailNum, over && styles.danger]}>
                  {over ? '⚠ ' : ''}{formatMoney(c.spent_minor, { compact: true })}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      {stats.other_currencies.length > 0 ? (
        <Text style={styles.note}>
          Не учтено: {stats.other_currencies.map((o) => `${formatMoney(o.spent_minor)} ${o.currency}`).join(', ')}
        </Text>
      ) : null}
    </View>
  );
}

function Total({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.total}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={[styles.totalValue, danger && styles.danger]}>{value}</Text>
    </View>
  );
}

function Meter({ spent, limit }: { spent: number; limit: number }) {
  const ratio = spent / limit;
  const fill = ratio > 1 ? chart.critical : ratio >= 0.8 ? chart.warning : chart.meterFill;
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.min(Math.max(ratio, 0), 1) * 100}%`, backgroundColor: fill }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { color: colors.muted, fontSize: 14, textAlign: 'center', marginVertical: 12 },
  month: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  monthTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monthTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  chevron: { fontSize: 16, color: colors.muted },
  totals: { flexDirection: 'row', marginTop: 6 },
  total: { flex: 1 },
  caption: { fontSize: 12, color: colors.muted },
  totalValue: { fontSize: 15, color: colors.text, marginTop: 2 },
  danger: { color: colors.danger },
  track: { height: 6, borderRadius: 3, backgroundColor: chart.meterTrack, marginTop: 8, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  details: { marginTop: 10, backgroundColor: colors.surface, borderRadius: 8, padding: 10 },
  detailsLoading: { marginTop: 10 },
  detailRow: { flexDirection: 'row', paddingVertical: 4 },
  detailHead: { fontSize: 12, color: colors.muted },
  detailName: { flex: 1, fontSize: 14, color: colors.text, marginRight: 8 },
  detailNum: { width: 80, textAlign: 'right', fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  note: { fontSize: 12, color: colors.muted, marginTop: 6 },
  groupRow: { marginTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingTop: 6 },
  groupTitle: { fontSize: 12, fontWeight: '600', color: colors.muted, textTransform: 'uppercase' },
});

