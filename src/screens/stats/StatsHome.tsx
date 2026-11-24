import React, { useEffect, useLayoutEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { TabParamList } from '@/shared/navigation/navigation';
import { PLAN_MONTHS_AHEAD, ymOf } from '@/db/plans';
import { SheetActions } from '@/shared/ui/Button';
import BottomSheet from '@/shared/ui/BottomSheet';
import RangeCalendar from '@/shared/ui/RangeCalendar';
import Segmented from '@/shared/ui/Segmented';
import {
  dayKeyOf,
  DayRange,
  parseDayKey,
  PeriodKind,
  periodLabel,
  periodRange,
  shiftAnchor,
  weekInMonth,
} from '@/shared/lib/dateRange';
import { useDisplayCurrency } from '@/shared/settings/displayCurrency';
import { colors } from '@/shared/theme/theme';
import { ChevronDownIcon } from '@/shared/ui/icons';
import PeriodStatsView from './period/PeriodStatsView';
import YearStatsView from './period/YearStatsView';
import { ReportBanner } from '@/features/month-report';
import { monthTitle } from '@/shared/lib/dates';
import PeriodNav from './parts/PeriodNav';
import { useStatsBack } from './model/useStatsBack';
import CloseBanner from './parts/CloseBanner';
import PlanAlert from './parts/PlanAlert';
import StatsView from './month/StatsView';
import PeriodSheet, { PERIODS } from './parts/PeriodSheet';

// the month's spending, or its plan: the ring, its legend and the categories under it
const TABS = [
  ['spending', 'Траты'],
  ['plan', 'План'],
] as const;
type Tab = (typeof TABS)[number][0];

/**
 * "Статистика" tab: «Траты» — stats for a period (a month by default, its plan changed right there); «План» — the
 * month's plans by category. Plan-vs-actual by months — a page, «История по месяцам ›» at the end of the period list.
 */
export default function StatsHome() {
  const now = new Date();
  const navigation = useNavigation();
  // the month of the stats
  const [period, setPeriod] = useState({ year: now.getFullYear(), month: now.getMonth() });
  // the stats are shown converted to the app's currency (Настройки → Валюта)
  const currency = useDisplayCurrency();

  // what the stats cover: a month (the default, with the plan) or a day / week / year around `anchor`, or a range
  const [tab, setTab] = useState<Tab>('spending');
  const [kind, setKind] = useState<PeriodKind>('month');
  const [anchor, setAnchor] = useState(now);
  const [custom, setCustom] = useState<DayRange | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draft, setDraft] = useState<DayRange | null>(null);

  // from a day header in the transactions list: that day's stats
  const route = useRoute<RouteProp<TabParamList, 'Stats'>>();
  const { day, year, nonce } = route.params ?? {};
  useEffect(() => {
    if (day === undefined) return;
    setTab('spending');
    setKind('day');
    setAnchor(new Date(day * 1000));
  }, [day, nonce]);
  // «Итоги 2026» past its stories: the year's stats
  useEffect(() => {
    if (year === undefined) return;
    setTab('spending');
    setKind('year');
    setAnchor(new Date(year, 6, 1));
  }, [year, nonce]);

  // opened from elsewhere: back returns there, the stats as usual next time
  useStatsBack(() => {
    setKind('month');
    setAnchor(new Date());
  });

  const ym = ymOf(period.year, period.month);
  // the stats go some months ahead: nothing spent yet, their plans made in advance
  const maxYm = ymOf(now.getFullYear(), now.getMonth() + PLAN_MONTHS_AHEAD);
  const shownYm = ym > maxYm ? maxYm : ym;
  const shown = shownYm === ym ? period : { year: now.getFullYear(), month: now.getMonth() };

  const shift = (delta: number) =>
    setPeriod(() => {
      const d = new Date(shown.year, shown.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  // the plan is a month's: «План» shows the month whatever period «Траты» show
  const planTab = tab === 'plan';
  const byPeriod = !planTab && kind !== 'month';
  // a week across two months shows only its days in one month (the arrows step to the other part)
  const range: DayRange | null =
    kind === 'custom'
      ? custom
      : kind === 'month'
        ? null
        : kind === 'week'
          ? weekInMonth(anchor)
          : periodRange(kind, anchor);
  /** previous / next day, week (part) or year */
  const step = (delta: number) =>
    setAnchor((a) => {
      if (kind !== 'week' || !range) return shiftAnchor(kind as 'day', a, delta);
      const edge = parseDayKey(delta < 0 ? range.from : range.to);
      return new Date(edge.getFullYear(), edge.getMonth(), edge.getDate() + delta);
    });
  const today = dayKeyOf(now);

  // the header title picks the period while the spending is shown: "Статистика за месяц ▾"
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () =>
        planTab ? (
          <Text style={styles.title}>Статистика</Text>
        ) : (
          <TouchableOpacity
            style={styles.titleRow}
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Выбрать период"
          >
            <Text style={styles.title}>Статистика</Text>
            <Text style={styles.titlePeriod}>{PERIODS.find((p) => p[0] === kind)![2]}</Text>
            <View style={styles.titleArrow}>
              <ChevronDownIcon color={colors.accent} size={20} />
            </View>
          </TouchableOpacity>
        ),
    });
  }, [navigation, kind, planTab]);

  function pick(k: PeriodKind) {
    setMenuOpen(false);
    // the calendar sheet comes up once the list has slid away
    if (k === 'custom') {
      setDraft(custom);
      setTimeout(() => setCalendarOpen(true), 220);
      return;
    }
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
      {/* the 1st to the 3rd: a month over to close */}
      <CloseBanner />
      {/* the overspend's alert: the current month's stats only (not a past month, a year or a period) */}
      {!byPeriod && !planTab && shownYm === ymOf(now.getFullYear(), now.getMonth()) ? (
        <PlanAlert currency={currency} />
      ) : null}
      {/* a fresh report (the 24th to the 7th): its stories */}
      <ReportBanner />
      {/* the reports and the alerts over them: the tabs right over the month */}
      <Segmented options={TABS} value={tab} onChange={setTab} style={styles.segmented} />

      {byPeriod && range ? (
        <PeriodNav
          unit="период"
          label={periodLabel(kind, range)}
          onPick={
            kind === 'custom'
              ? () => {
                  setDraft(custom);
                  setCalendarOpen(true);
                }
              : undefined
          }
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          nextDisabled={range.to >= today}
        />
      ) : (
        <PeriodNav
          unit="месяц"
          label={monthTitle(shown.year, shown.month)}
          onPrev={() => shift(-1)}
          onNext={() => shift(1)}
          nextDisabled={shownYm >= maxYm}
        />
      )}

      <View style={styles.body}>
        {/* a year: its report on one page */}
        {byPeriod && range && kind === 'year' ? <YearStatsView key={range.from} range={range} /> : null}
        {byPeriod && range && kind !== 'year' ? (
          <PeriodStatsView
            key={`${range.from}-${range.to}`}
            range={range}
            normLabel={kind === 'day' ? 'на день' : kind === 'week' ? 'на неделю' : 'на период'}
          />
        ) : null}
        {!byPeriod ? (
          <StatsView year={shown.year} month={shown.month} currency={currency} view={planTab ? 'plan' : 'spent'} />
        ) : null}
      </View>

      <PeriodSheet visible={menuOpen} kind={kind} onPick={pick} onClose={() => setMenuOpen(false)} />

      {/* "Свой период": the transactions' range calendar in a sheet */}
      <BottomSheet visible={calendarOpen} onClose={() => setCalendarOpen(false)} title="Свой период">
        <View style={styles.sheet}>
          <Text style={styles.sheetHint}>{draft ? periodLabel('custom', draft) : 'Выберите день или период'}</Text>
          <RangeCalendar value={draft} onChange={setDraft} />
          <SheetActions
            submit={{ title: 'Показать', onPress: applyRange, disabled: !draft }}
            onCancel={() => setCalendarOpen(false)}
          />
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 20, fontWeight: '500', color: colors.text },
  titlePeriod: { fontSize: 20, fontWeight: '500', color: colors.accent },
  titleArrow: { marginTop: 2 },
  segmented: { marginHorizontal: 16, marginTop: 4, marginBottom: 8 },
  sheet: { paddingHorizontal: 16 },
  sheetHint: { fontSize: 14, color: colors.muted, marginBottom: 8, paddingHorizontal: 4 },
});
