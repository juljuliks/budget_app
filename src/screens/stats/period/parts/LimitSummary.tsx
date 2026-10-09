import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { NormPeriod } from '@/db/plans';
import type { SummaryGroup } from '@/entities/plan';
import { parseDayKey } from '@/shared/lib/dateRange';
import { WEEKDAYS } from '@/shared/lib/dates';
import { InfoIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import type { PeriodView } from '../model/periodView';
import { capitalize } from '../model/periodText';
import { INFO_SIZE, styles } from './styles';

type Props = { v: PeriodView; g: SummaryGroup; onInfo: () => void };

/** A limits section's total: the bar of its categories, what's left or the overspend, how the period moved the limit. */
export default function LimitSummary({ v, g, onInfo }: Props) {
  const limit = Math.round(g.limit);
  if (limit <= 0) return null;
  const left = limit - g.spent;
  const over = left < 0;
  const paid = g.items.filter((i) => i.spent >= i.limit).length;
  const rhythm = g.key === 'day' || g.key === 'week' || g.key === '2weeks';
  // a rhythm's days end on a weekday ("до вс"), the month's on its last day
  const until = rhythm ? WEEKDAYS[parseDayKey(g.end).getDay()] : v.monthEndShort;
  const moved = g.change && g.change.after !== null && Math.round(g.change.after) !== Math.round(g.change.before);
  const label = g.window && rhythm ? v.windowLabel(g.key as NormPeriod, g.window) : '';
  return (
    <View style={styles.limitSummary}>
      {/* each category's spending in its own color; past the limit the bar is the spending, a tick at the limit */}
      {/* the tick stands out of the bar like a category's: the bar clips its segments, not the tick */}
      <View style={styles.stackWrap}>
        <View style={styles.stack}>
          {g.items.filter((i) => i.spent > 0).map((i) => (
            <View key={i.id} style={{ flex: i.spent, backgroundColor: v.stats.categories.find((c) => c.category_id === i.id)?.color ?? colors.muted }} />
          ))}
          {!over && limit - g.spent > 0 ? <View style={[styles.stackRest, { flex: limit - g.spent }]} /> : null}
        </View>
        {/* as on every bar: no tick at the very end */}
        {over && limit / g.spent < 0.97 ? <View style={[styles.stackTick, { left: `${(limit / g.spent) * 100}%` }]} /> : null}
      </View>
      <TouchableOpacity style={styles.paceRow} onPress={onInfo} accessibilityLabel="Как считается раздел">
        <Text style={[styles.share, styles.paceText]}>
          {/* as in the category rows: the limit first, then what's left */}
          {g.change && rhythm ? (
            <>
              {/* "старый → новый": no "Лимит" word, it's plain what it is */}
              {moved ? <><Text style={styles.crossed}>{v.m(g.change.before)}</Text>{' → '}</> : 'Лимит '}
              <Text style={moved ? (g.change.after! < g.change.before ? styles.paceAhead : styles.paceOk) : undefined}>{v.m(moved ? g.change.after! : g.change.before)}</Text>
              {/* no "в неделю": the section says which limit it is */}{'\n'}
            </>
          ) : null}
          {rhythm ? label : `${capitalize(v.monthIn)}: `}
          <Text style={[styles.pace, over ? styles.paceAhead : g.key === 'fixed' ? undefined : styles.paceOk]}>
            {(over ? `перерасход ${v.money(-left)}` : g.key === 'fixed' ? (left > 0 ? `осталось оплатить ${v.money(left)}` : 'всё оплачено')
              : g.ongoing ? `осталось ${v.money(left)}` : `сэкономлено ${v.money(left)}`).replace(/^./, (ch) => (label || !rhythm ? ch : ch.toUpperCase()))}
          </Text>
          {!over && g.ongoing && g.key !== 'fixed' && (g.key !== 'day' || v.days > 1) ? ` · до ${until}` : ''}
          {g.key === 'fixed' ? ` · ${paid} из ${g.items.length} оплачены` : ''}
        </Text>
        <InfoIcon color={colors.accent} size={INFO_SIZE} />
      </TouchableOpacity>
    </View>
  );
}
