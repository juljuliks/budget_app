import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { CategoryStat } from '@/db/plans';
import { formatPercent } from '@/shared/lib/format';
import { formatShort } from '@/shared/lib/money';
import { colors } from '@/shared/theme/theme';
import type { PeriodView } from '../model/periodView';
import { GLYPH_ROOM } from '../model/periodText';
import { FixedLine, MonthLine, RhythmLine } from './LimitLines';
import { ofLimitOf } from './OfLimit';
import { overStyle, styles } from './styles';
import type { Handlers } from './types';

type Props = {
  v: PeriodView;
  h: Handlers;
  c: CategoryStat;
  /** in a limits section of several categories the section's bar shows them all */
  noBar?: boolean;
  /** outside the period's own limit sections (a month's overspend): just the spending on the right, no bar */
  plainAmount?: boolean;
  /** "Жизнь: Покупки": where the sections aren't the categories' types */
  withType?: boolean;
};

const nameOf = (c: CategoryStat, withType: boolean) => (withType ? categoryLabel(c) : `${c.emoji || ''} ${c.name}`.trim());

/** A category's row: tap opens its operations in the period; a limit's line has its ⓘ. */
export function CategoryRow({ v, h, c, noBar = false, plainAmount = false, withType = v.byLimits }: Props) {
  const plan = v.planOf(c);
  const name = nameOf(c, withType);
  const ofLimit = plainAmount ? null : ofLimitOf(v, c, plan);
  const onInfo = () => h.openInfo({ id: c.category_id!, name });
  const line = { v, c, noBar, onInfo };
  return (
    // tap: the category's operations in this period (the ⓘ line inside keeps its own tap)
    <TouchableOpacity style={styles.row} onPress={() => h.openTransactions(c.category_id)} accessibilityHint="Показать операции категории за период">
      <View style={styles.rowTop}>
        <View style={[styles.dot, { backgroundColor: c.color }]} />
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {/* one line, never wrapped: a wrapped "0 / 106.81 ₾" showed just "0 /" (its second line hidden) */}
        {/* as in the month stats: with a limit the spending without ₾, "/ limit ₾ (%)" muted; "Скрыть суммы": just the
            % — of its limit, or of all spending without one. Separate texts in a row, each measured on its own: one
            nested text was cut short on Android ("0 /", "0 / 106.8…") */}
        {h.hidden ? <Text style={styles.amount} numberOfLines={1}>{v.hiddenShare(c, plan)}</Text> : (
          <View style={styles.amountBox}>
            <Text style={[styles.amountText, ofLimit ? overStyle(v.rightSpent(c, plan), v.rightLimit(c, plan)) : v.cameIn(c) && { color: colors.income }]}>
              {ofLimit ? formatShort(v.rightSpent(c, plan)) : `${v.signed(c)}${GLYPH_ROOM}`}
            </Text>
            {ofLimit ? <Text style={[styles.amountText, styles.ofLimit]}>{ofLimit}</Text> : null}
          </View>
        )}
      </View>
      {plan?.kind === 'limit' && plan.rhythm !== 'month' ? <RhythmLine {...line} plan={plan} />
        : plan?.kind === 'limit' ? <MonthLine {...line} plan={plan} />
          : plan ? <FixedLine {...line} plan={plan} />
            : <Text style={styles.share}>{formatPercent(c.spent_minor, v.stats.spent_minor)} всех трат</Text>}
    </TouchableOpacity>
  );
}

/** A row with just the name and the period's spending (no limit to judge it by): tap opens its operations. */
export function PlainRow({ v, h, c, withType = v.byLimits }: { v: PeriodView; h: Handlers; c: CategoryStat; withType?: boolean }) {
  return (
    <TouchableOpacity style={styles.row} onPress={() => h.openTransactions(c.category_id)} accessibilityHint="Показать операции категории за период">
      <View style={styles.rowTop}>
        <View style={[styles.dot, { backgroundColor: c.color }]} />
        <Text style={styles.name} numberOfLines={1}>{nameOf(c, withType)}</Text>
        <Text style={[styles.amount, styles.amountPad, v.cameIn(c) && { color: colors.income }]}>{h.hidden ? v.headerPct(c.spent_minor, 0) : `${v.signed(c)}${GLYPH_ROOM}`}</Text>
      </View>
    </TouchableOpacity>
  );
}
