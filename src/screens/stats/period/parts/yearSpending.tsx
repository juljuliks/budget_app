import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { CategoryStat } from '@/db/plans';
import type { YearReport } from '@/db/yearReport';
import { topNote } from '@/features/month-report';
import { formatWithCurrency } from '@/shared/lib/money';
import Donut from '@/shared/ui/Donut';
import { InfoIcon } from '@/shared/ui/icons';
import { SectionHeader } from '@/shared/ui/StickyScrollView';
import { formStyles } from '@/shared/theme/formStyles';
import { colors } from '@/shared/theme/theme';
import DonutCenter from '../../parts/DonutCenter';
import RefundsRow from '../../parts/RefundsRow';
import type { PeriodView } from '../model/periodView';
import { typeSections, unplannedSection } from './sections';
import { INFO_SIZE, styles } from './styles';
import type { Handlers } from './types';

type Props = {
  v: PeriodView;
  h: Handlers;
  r: YearReport;
  segments: Array<{ key: string; value: number; color: string }>;
  picked: CategoryStat | undefined;
  selected: string | null;
  onSelect: (k: string | null) => void;
  onRefunds: () => void;
};

/**
 * The year's stats' «Траты по категориям»: its section, the ring and the categories by their sections as the stats
 * show them, each with its month on average and how often over its plan (the year's report). A fragment: the sections'
 * headers stick in the page's StickyScrollView.
 */
export function yearSpending({ v, h, r, segments, picked, selected, onSelect, onRefunds }: Props) {
  const money = (minor: number) => formatWithCurrency(Math.round(minor), r.currency);
  const noteOf = (id: number | null) => {
    const c = id === null ? undefined : r.byCategory.get(id);
    return c ? topNote(c, money) : null;
  };
  const hh: Handlers = { ...h, noteOf };
  return (
    <>
      <SectionHeader style={[formStyles.sectionHeader, styles.groupHeader, styles.group]}>
        <Text style={styles.groupTitle}>Траты по категориям</Text>
        <Text style={styles.groupTotal}>{money(v.stats.spent_minor)}</Text>
      </SectionHeader>
      <View style={styles.donutWrap}>
        <Donut segments={segments} selectedKey={picked ? selected : null} onSelect={onSelect}>
          <DonutCenter total={v.stats.spent_minor} picked={picked} currency={v.cur} />
        </Donut>
      </View>
      {v.summary ? (
        <TouchableOpacity
          style={styles.summaryRow}
          onPress={() => h.openInfo('summary')}
          accessibilityLabel="Как считаются траты"
        >
          <Text style={styles.summary}>{v.summary}</Text>
          <InfoIcon color={colors.accent} size={INFO_SIZE} />
        </TouchableOpacity>
      ) : null}
      {typeSections(v, hh)}
      {unplannedSection(v, hh)}
      <RefundsRow amount={v.stats.refunds_unassigned_minor} currency={v.stats.currency} onPress={onRefunds} />
    </>
  );
}
