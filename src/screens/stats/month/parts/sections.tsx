// The month's sections. Plain functions returning fragments, not components: StickyScrollView sticks the
// SectionHeaders it finds among its children and opened fragments only.
import React from 'react';
import { Text, View } from 'react-native';
import type { CategoryStat, MonthStats, StatGroup } from '@/db/plans';
import { formatPercent } from '@/shared/lib/format';
import { formatShort, formatWithCurrency } from '@/shared/lib/money';
import Masked, { MaskedTotal } from '@/shared/ui/Masked';
import Meter from '@/shared/ui/Meter';
import { SectionHeader } from '@/shared/ui/StickyScrollView';
import { formStyles } from '@/shared/theme/formStyles';
import { chart, colors } from '@/shared/theme/theme';
import { overStyle, styles } from './styles';

/** the bottom section of the categories without a plan (as in the plan) */
const UNPLANNED = 'Вне плана';

/** A row of a category (made by the screen: it knows the month, the norms, "＋ В план"). */
type RowOf = (c: CategoryStat, unplanned: boolean) => React.ReactElement;

const header = (title: string, total: React.ReactNode) => (
  <SectionHeader style={[formStyles.sectionHeader, styles.groupHeader, styles.group]}>
    <Text style={styles.groupTitle}>{title}</Text>
    {total}
  </SectionHeader>
);

/** "fact / plan ₾ (%)", as in the period stats; "Скрыть суммы" leaves just the % (of the plan, else of all spending). */
const factOfPlan = (stats: MonthStats, spent: number, planned: number) => (
  <MaskedTotal style={styles.groupTotal} hiddenText={planned ? formatPercent(spent, planned) : formatPercent(spent, stats.spent_minor)}>
    {planned ? <Text style={overStyle(spent, planned)}>{formatShort(spent)}</Text> : formatWithCurrency(spent, stats.currency)}
    {planned ? <Text style={styles.rowLimit}> / {formatWithCurrency(planned, stats.currency)}</Text> : null}
    {planned ? <Text style={[styles.rowLimit, overStyle(spent, planned)]}> ({formatPercent(spent, planned)})</Text> : null}
  </MaskedTotal>
);

/** The planned categories by their sections (types); one category: its row says it all, the header only names it. */
export function typeSections(stats: MonthStats, groups: StatGroup[], rowOf: RowOf) {
  return groups.map((g) => (
    <React.Fragment key={`${g.type_id}-${g.title}`}>
      {header(g.title, g.categories.length > 1 ? factOfPlan(stats, g.spent_minor, g.planned_minor) : null)}
      <View>{g.categories.map((c) => rowOf(c, false))}</View>
    </React.Fragment>
  ));
}

/** "Вне плана": the categories without a plan and the uncategorized, against the budget's share for them. */
export function unplannedSection(stats: MonthStats, split: { unplanned: CategoryStat[]; spent: number }, share: number, rowOf: RowOf) {
  if (!split.unplanned.length && !(share > 0)) return null;
  const money = (minor: number) => formatWithCurrency(minor, stats.currency);
  return (
    <>
      {header(UNPLANNED, factOfPlan(stats, split.spent, share))}
      <View>
        {/* the share as a limit: an overspend scales the bar to the spending, a tick at the share; on the header's grey
            band, worded like a month limit's row. Nothing spent outside the plan yet: no empty bar, just the hint below */}
        {share > 0 ? (
          <View style={styles.sectionBand}>
            {split.spent > 0 ? (split.spent > share
              ? <Meter ratio={1} over={share / split.spent} height={6} color={colors.warn} />
              : <Meter ratio={split.spent / share} height={6} color={chart.meterFill} />) : null}
            <Text style={styles.rowStatus}>
              {split.spent > share
                ? <Text style={styles.overLine}>Перерасход <Masked style={styles.overLine}>{money(split.spent - share)}</Masked></Text>
                : <>осталось <Masked style={styles.rowStatus}>{money(share - split.spent)}</Masked></>}
            </Text>
          </View>
        ) : null}
        {split.unplanned.length === 0 ? <Text style={styles.hint}>Трат вне плана пока не было.</Text> : null}
        {split.unplanned.map((c) => rowOf(c, true))}
      </View>
    </>
  );
}
