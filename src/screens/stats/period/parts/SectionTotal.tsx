import React from 'react';
import { Text } from 'react-native';
import { formatPercent } from '@/shared/lib/format';
import { formatShort } from '@/shared/lib/money';
import { MaskedTotal } from '@/shared/ui/Masked';
import type { PeriodView } from '../model/periodView';
import { overStyle, styles } from './styles';

/** A section's header total: "spent / its plans for the month (%)" as in the month stats, or just the spent. */
export default function SectionTotal({ v, spent, planned }: { v: PeriodView; spent: number; planned: number }) {
  return (
    <MaskedTotal style={styles.groupTotal} hiddenText={v.headerPct(spent, planned)}>
      {/* the fact black without ₾, the rest muted */}
      {planned > 0 ? <Text style={overStyle(spent, planned)}>{formatShort(spent)}</Text> : v.money(spent)}
      {planned > 0 ? <Text style={styles.groupPlan}> / {v.money(planned)}</Text> : null}
      {planned > 0 ? <Text style={[styles.groupPlan, overStyle(spent, planned)]}> ({formatPercent(spent, Math.round(planned))})</Text> : null}
    </MaskedTotal>
  );
}
