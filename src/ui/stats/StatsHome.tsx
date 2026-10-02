import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { currentYm, ymOf } from '../../db/plans';
import Segmented from '../Segmented';
import { colors } from '../theme';
import HistoryView from './HistoryView';
import { monthTitle } from './months';
import PlanView from './PlanView';
import StatsView from './StatsView';

const SECTIONS = [['stats', 'Статистика'], ['plan', 'План'], ['history', 'История']] as const;
type Section = typeof SECTIONS[number][0];

/** "Статистика" tab: month stats, the month's plan and plan-vs-actual history. */
export default function StatsHome() {
  const now = new Date();
  const [section, setSection] = useState<Section>('stats');
  // shared by stats and plan, so switching between them keeps the month
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const ym = ymOf(period.year, period.month);
  const thisYm = currentYm(now);
  // the plan can be prepared one month ahead; stats stop at the current month
  const maxYm = section === 'plan' ? ymOf(now.getFullYear(), now.getMonth() + 1) : thisYm;
  const shownYm = ym > maxYm ? maxYm : ym;
  const shown = shownYm === ym ? period : { year: now.getFullYear(), month: now.getMonth() };

  const shift = (delta: number) => setPeriod(() => {
    const d = new Date(shown.year, shown.month + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  return (
    <View style={styles.screen}>
      <Segmented options={SECTIONS} value={section} onChange={setSection} style={styles.segmented} />

      {section !== 'history' ? (
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={() => shift(-1)} hitSlop={12}><Text style={styles.arrow}>‹</Text></TouchableOpacity>
          <Text style={styles.month}>{monthTitle(shown.year, shown.month)}</Text>
          <TouchableOpacity onPress={() => shift(1)} hitSlop={12} disabled={shownYm >= maxYm}>
            <Text style={[styles.arrow, shownYm >= maxYm && styles.arrowDisabled]}>›</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.body}>
        {section === 'stats' ? <StatsView year={shown.year} month={shown.month} /> : null}
        {section === 'plan' ? <PlanView key={shownYm} ym={shownYm} /> : null}
        {section === 'history' ? <HistoryView /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  segmented: { margin: 16, marginBottom: 8 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 8 },
  arrow: { fontSize: 28, color: colors.accent, paddingHorizontal: 8 },
  arrowDisabled: { color: colors.border },
  month: { fontSize: 17, fontWeight: '600', color: colors.text },
  body: { flex: 1 },
});
