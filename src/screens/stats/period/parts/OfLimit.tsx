import React from 'react';
import { Text } from 'react-native';
import type { CategoryStat } from '@/db/plans';
import { formatPercent } from '@/shared/lib/format';
import type { CategoryNorm } from '@/stats/norms';
import type { PeriodView } from '../model/periodView';
import { GLYPH_ROOM } from '../model/periodText';
import { overStyle, styles } from './styles';

/** "/ limit ₾ (%)" after a category's spending, or null. */
export function ofLimitOf(v: PeriodView, c: CategoryStat, plan?: CategoryNorm): React.ReactElement | null {
  // "/ limit (%)": the period's own limit; a rhythm's window (a cut week) too when its spending is just this
  // period's — measured over other days it would read against the wrong amount
  // an obligatory payment: its month's plan, when what was paid differs from it
  if (plan?.kind === 'fixed') {
    const paid = v.monthToDate(c);
    if (plan.monthLimit <= 0 || Math.round(paid) === Math.round(plan.monthLimit) || paid !== c.spent_minor) return null;
    return <Text style={styles.ofLimit}>{' / '}{v.m(plan.monthLimit)}{c.spent_minor > 0 ? <Text style={overStyle(c.spent_minor, plan.monthLimit)}>{` (${formatPercent(c.spent_minor, Math.round(plan.monthLimit))})`}</Text> : GLYPH_ROOM}</Text>;
  }
  if (plan?.kind !== 'limit' || plan.rhythm === 'month') return null;
  const { spent, limit: lim } = v.limitPair(plan, c);
  if (lim <= 0) return null;
  // no "(0%)" while nothing is spent
  return <Text style={styles.ofLimit}>{' / '}{v.m(lim)}{spent > 0 ? <Text style={overStyle(spent, lim)}>{` (${formatPercent(spent, Math.round(lim))})`}</Text> : GLYPH_ROOM}</Text>;
}
