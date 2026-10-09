import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useDisplayCurrency } from '@/displayCurrency';
import { useHideAmounts } from '@/hideAmounts';
import { DayRange, dayKeyOf } from '@/shared/lib/dateRange';
import { formatWithCurrency } from '@/shared/lib/money';
import { NO_RATE } from '@/shared/lib/strings';
import { useOpenCategoryTransactions } from '@/shared/navigation/navigation';
import Donut from '@/shared/ui/Donut';
import { InfoIcon } from '@/shared/ui/icons';
import StickyScrollView from '@/shared/ui/StickyScrollView';
import { colors } from '@/shared/theme/theme';
import DonutCenter from '../parts/DonutCenter';
import RefundsRow from '../parts/RefundsRow';
import { PACE_MAX_DAYS, usePeriodData } from './model/usePeriodData';
import { periodView } from './model/periodView';
import InfoSheet from './parts/InfoSheet';
import { limitSections, typeSections, unplannedSection } from './parts/sections';
import { INFO_SIZE, styles } from './parts/styles';
import type { Handlers, Info } from './parts/types';

type Props = {
  range: DayRange;
  /** "на день" / "на неделю" / "на период": the period's kind, for the section headers ("за неделю") */
  normLabel?: string;
  emptyText?: string;
};

/**
 * Spending of a period by category, with a donut. A short period (a day, a week, up to a month) is measured
 * against the plan's norm for these days: are we on pace? A long one (a year) shows the structure and the
 * average per month.
 */
export default function PeriodStatsView({ range, normLabel, emptyText = 'За этот период трат нет.' }: Props) {
  // the app's currency (Настройки → Валюта)
  const currency = useDisplayCurrency();
  const data = usePeriodData(range, currency);
  const { stats } = data;
  const [selected, setSelected] = useState<string | null>(null);
  // which explanation is open: the line under the donut, a category or a limits block
  const [info, setInfo] = useState<Info | null>(null);
  const openTransactions = useOpenCategoryTransactions();
  const hidden = useHideAmounts();
  const segments = useMemo(() => (stats?.groups ?? []).flatMap((g) => g.categories)
    .map((c) => ({ key: String(c.category_id), value: c.spent_minor, color: c.color })), [stats]);

  if (!stats) return <View style={styles.center}><ActivityIndicator /></View>;
  const v = periodView({ ...data, stats, range, normLabel, today: dayKeyOf(new Date()) });
  const h: Handlers = { hidden, openInfo: setInfo, openTransactions: (id) => openTransactions(id, range) };
  const picked = selected === null ? undefined : stats.categories.find((c) => String(c.category_id) === selected);

  return (
    <StickyScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.donutWrap}>
        <Donut segments={segments} selectedKey={picked ? selected : null} onSelect={setSelected}>
          <DonutCenter total={stats.spent_minor} picked={picked} currency={v.cur} />
        </Donut>
      </View>
      {v.byLimits || (!data.pace && data.days <= PACE_MAX_DAYS) || !v.summary ? null : (
        <TouchableOpacity style={styles.summaryRow} onPress={() => setInfo('summary')} accessibilityLabel="Как считаются траты">
          <Text style={styles.summary}>{v.summary}</Text>
          <InfoIcon color={colors.accent} size={INFO_SIZE} />
        </TouchableOpacity>
      )}

      {stats.categories.length === 0 ? <Text style={styles.hint}>{emptyText}</Text> : null}
      {/* shorter than a month: the categories by their limit, each section with its total; longer: by their sections */}
      {v.byLimits ? limitSections(v, h) : typeSections(v, h)}
      {unplannedSection(v, h)}
      <RefundsRow amount={stats.refunds_unassigned_minor} currency={stats.currency} onPress={() => openTransactions(null, range, ['refund'])} />
      {stats.other_currencies.length > 0 ? (
        <Text style={styles.hint}>
          {NO_RATE} {stats.other_currencies.map((o) => formatWithCurrency(o.spent_minor, o.currency)).join(', ')}
        </Text>
      ) : null}

      <InfoSheet v={v} info={info} onClose={() => setInfo(null)} />
    </StickyScrollView>
  );
}
