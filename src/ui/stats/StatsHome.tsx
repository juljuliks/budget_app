import React, { useEffect, useLayoutEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { TabParamList } from '../../navigation';
import { currentYm, ymOf } from '../../db/plans';
import Segmented from '../Segmented';
import Button from '../Button';
import BottomSheet from '../BottomSheet';
import RangeCalendar from '../RangeCalendar';
import { dayKeyOf, DayRange, PeriodKind, periodLabel, periodRange, shiftAnchor } from '../dateRange';
import { useDisplayCurrency } from '../../displayCurrency';
import { colors } from '../theme';
import { ChevronDownIcon } from '../icons';
import PeriodStatsView from './PeriodStatsView';
import HistoryView from './HistoryView';
import { monthTitle } from './months';
import PlanView from './PlanView';
import StatsView from './StatsView';

const SECTIONS = [['stats', 'Статистика'], ['plan', 'План'], ['history', 'История']] as const;
type Section = typeof SECTIONS[number][0];

const PERIODS: Array<[PeriodKind, string, string]> = [
  ['day', 'За день', 'за день'],
  ['week', 'За неделю', 'за неделю'],
  ['month', 'За месяц', 'за месяц'],
  ['year', 'За год', 'за год'],
  // one day or several, picked in the calendar
  ['custom', 'Свой период', 'за период'],
];

/** "Статистика" tab: stats for a period (a month by default), the month's plan and plan-vs-actual history. */
export default function StatsHome() {
  const now = new Date();
  const navigation = useNavigation();
  const [section, setSection] = useState<Section>('stats');
  // shared by stats and plan, so switching between them keeps the month
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() });
  // stats, plan and history are shown converted to the app's currency (Настройки → Валюта)
  const currency = useDisplayCurrency();

  // what the stats cover: a month (the default, with the plan) or a day / week / year around `anchor`, or a range
  const [kind, setKind] = useState<PeriodKind>('month');
  const [anchor, setAnchor] = useState(now);
  const [custom, setCustom] = useState<DayRange | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draft, setDraft] = useState<DayRange | null>(null);

  // from a day header in the transactions list: that day's stats
  const route = useRoute<RouteProp<TabParamList, 'Stats'>>();
  const { day, nonce } = route.params ?? {};
  useEffect(() => {
    if (day === undefined) return;
    setSection('stats');
    setKind('day');
    setAnchor(new Date(day * 1000));
  }, [day, nonce]);

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

  const byPeriod = section === 'stats' && kind !== 'month';
  const range: DayRange | null = kind === 'custom' ? custom : kind === 'month' ? null : periodRange(kind, anchor);
  const today = dayKeyOf(now);

  // the header title picks the period while the stats are shown: "Статистика за месяц ▾"
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (section === 'stats' ? (
        <TouchableOpacity style={styles.titleRow} onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="Выбрать период">
          <Text style={styles.title}>Статистика</Text>
          <Text style={styles.titlePeriod}>{PERIODS.find((p) => p[0] === kind)![2]}</Text>
          <View style={styles.titleArrow}><ChevronDownIcon color={colors.accent} size={20} /></View>
        </TouchableOpacity>
      ) : <Text style={styles.title}>Статистика</Text>),
    });
  }, [navigation, section, kind]);

  function pick(k: PeriodKind) {
    setMenuOpen(false);
    // the calendar sheet comes up once the list has slid away
    if (k === 'custom') { setDraft(custom); setTimeout(() => setCalendarOpen(true), 220); return; }
    setKind(k);
    setAnchor(new Date());
  }

  function applyRange() {
    if (!draft) return;
    setCustom(draft);
    setKind('custom');
    setCalendarOpen(false);
  }

  return (
    <View style={styles.screen}>
      <Segmented options={SECTIONS} value={section} onChange={setSection} style={styles.segmented} />

      {section === 'history' ? null : byPeriod && range ? (
        <View style={styles.monthRow}>
          {kind === 'custom' ? (
            // a chosen range: no arrows, tap to change it
            <TouchableOpacity style={styles.rangeButton} onPress={() => { setDraft(custom); setCalendarOpen(true); }}>
              <Text style={styles.month}>{periodLabel(kind, range)}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity onPress={() => setAnchor((a) => shiftAnchor(kind as 'day', a, -1))} hitSlop={12}><Text style={styles.arrow}>‹</Text></TouchableOpacity>
              <Text style={styles.month}>{periodLabel(kind, range)}</Text>
              <TouchableOpacity onPress={() => setAnchor((a) => shiftAnchor(kind as 'day', a, 1))} hitSlop={12} disabled={range.to >= today}>
                <Text style={[styles.arrow, range.to >= today && styles.arrowDisabled]}>›</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : (
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={() => shift(-1)} hitSlop={12}><Text style={styles.arrow}>‹</Text></TouchableOpacity>
          <Text style={styles.month}>{monthTitle(shown.year, shown.month)}</Text>
          <TouchableOpacity onPress={() => shift(1)} hitSlop={12} disabled={shownYm >= maxYm}>
            <Text style={[styles.arrow, shownYm >= maxYm && styles.arrowDisabled]}>›</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.body}>
        {section === 'stats' && byPeriod && range ? (
          <PeriodStatsView
            key={`${range.from}-${range.to}`}
            range={range}
            normLabel={kind === 'day' ? 'на день' : kind === 'week' ? 'на неделю' : 'на период'}
          />
        ) : null}
        {section === 'stats' && !byPeriod ? <StatsView year={shown.year} month={shown.month} currency={currency} /> : null}
        {section === 'plan' ? <PlanView key={shownYm} ym={shownYm} currency={currency} /> : null}
        {section === 'history' ? <HistoryView currency={currency} /> : null}
      </View>

      {/* the period list, as a sheet like every other choice */}
      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Период">
        {PERIODS.map(([k, label]) => (
          <TouchableOpacity key={k} style={styles.menuItem} onPress={() => pick(k)} accessibilityState={{ selected: k === kind }}>
            <Text style={[styles.menuText, k === kind && styles.menuSelected]}>{label}</Text>
            {k === kind ? <Text style={styles.menuCheck}>✓</Text> : null}
          </TouchableOpacity>
        ))}
      </BottomSheet>

      {/* "Свой период": the transactions' range calendar in a sheet */}
      <BottomSheet visible={calendarOpen} onClose={() => setCalendarOpen(false)} title="Свой период">
        <View style={styles.sheet}>
          <Text style={styles.sheetHint}>{draft ? periodLabel('custom', draft) : 'Выберите день или период'}</Text>
          <RangeCalendar value={draft} onChange={setDraft} />
          <Button title="Показать" onPress={applyRange} disabled={!draft} style={styles.sheetButton} />
          <TouchableOpacity style={styles.sheetCancel} onPress={() => setCalendarOpen(false)}>
            <Text style={styles.sheetCancelText}>Отмена</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  // close under the header title
  segmented: { marginHorizontal: 16, marginTop: 4, marginBottom: 8 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 8 },
  rangeButton: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  arrow: { fontSize: 28, color: colors.accent, paddingHorizontal: 8 },
  arrowDisabled: { color: colors.border },
  month: { fontSize: 17, fontWeight: '600', color: colors.text },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 20, fontWeight: '500', color: colors.text },
  titlePeriod: { fontSize: 20, fontWeight: '500', color: colors.accent },
  titleArrow: { marginTop: 2 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  menuText: { flex: 1, fontSize: 16, color: colors.text },
  menuSelected: { color: colors.accent, fontWeight: '600' },
  menuCheck: { fontSize: 16, color: colors.accent, marginLeft: 12 },
  sheet: { paddingHorizontal: 16 },
  sheetHint: { fontSize: 14, color: colors.muted, marginBottom: 8, paddingHorizontal: 4 },
  sheetButton: { marginTop: 12 },
  sheetCancel: { alignItems: 'center', paddingTop: 12 },
  sheetCancelText: { fontSize: 16, color: colors.muted },
});
