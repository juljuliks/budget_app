import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { Currency } from '@/db/fx';
import { CategoryStat, spentOf } from '@/db/plans';
import { useHideAmounts } from '@/hideAmounts';
import { monthDays } from '@/shared/lib/dateRange';
import { RHYTHM_DAYS, WEEKDAYS } from '@/shared/lib/dates';
import { formatPercent } from '@/shared/lib/format';
import { formatShort, formatWithCurrency } from '@/shared/lib/money';
import { PER_PERIOD } from '@/shared/lib/strings';
import type { useOpenCategoryTransactions } from '@/shared/navigation/navigation';
import Meter from '@/shared/ui/Meter';
import { CategoryNorm, flatOf, limitChange, Pace, paceOf } from '@/stats/norms';
import { overStyle, styles } from './styles';

/** " (50%)" after "spent / limit" of a flexible category; nothing while nothing is spent. */
function planShare(spent: number, limit: number): string {
  return spent > 0 && limit > 0 ? ` (${formatPercent(spent, limit)})` : '';
}

const RHYTHM_NOW = { day: 'Сегодня', week: 'На этой неделе', '2weeks': 'За эти 2 недели' } as const;

export default function CategoryRow({ stat, total, currency, evenPace, dim, ym, openTransactions, now, monthToDate, onAddToPlan, withType }: {
  stat: CategoryStat;
  /** the month's spending: a row's share of it when the amounts are hidden */
  total: number;
  currency: Currency; evenPace?: number; dim: number;
  /** the month shown: its operations open for this period */
  ym: string;
  openTransactions: ReturnType<typeof useOpenCategoryTransactions>;
  /** the current month only: the norm window around today */
  now?: CategoryNorm; monthToDate: number;
  onAddToPlan?: () => void;
  /** "Жизнь: Покупки": outside the plan, where the rows aren't under their type's section */
  withType?: boolean;
}) {
  const { limit_minor: limit } = stat;
  // a transfer category: sent minus what came back; more came back = "+", and nothing spent for its plan
  const spent = spentOf(stat);
  const cameIn = stat.transfer && stat.spent_minor < 0 ? -stat.spent_minor : 0;
  const hidden = useHideAmounts();
  const ratio = limit ? spent / limit : 0;
  // fixed payment (rent, subscription): paid once this month's spending covers its plan (the share is by the amount)
  const fixed = stat.plan_kind === 'fixed';
  const paid = !!limit && spent >= limit;
  const rhythm = !fixed && stat.plan_norm && stat.plan_norm !== 'month' ? stat.plan_norm : null;

  return (
    <TouchableOpacity style={styles.row} onPress={() => openTransactions(stat.category_id, monthDays(ym))} accessibilityHint="Показать операции категории">
      <View style={styles.rowTop}>
        <View style={[styles.dot, { backgroundColor: stat.color }]} />
        <Text style={styles.rowName} numberOfLines={1}>{withType ? categoryLabel(stat) : `${stat.emoji || ''} ${stat.name}`.trim()}</Text>
        {/* an obligatory payment: all paid — a green tick, otherwise (partly too) a grey circle */}
        {limit && fixed ? (
          <Text style={[styles.paidMark, paid ? styles.paidOn : styles.paidOff]} accessibilityLabel={paid ? 'Оплачено' : 'Не оплачено'}>
            {paid ? '✓' : '○'}
          </Text>
        ) : null}
        {onAddToPlan ? (
          <TouchableOpacity style={styles.addToPlan} onPress={onAddToPlan} hitSlop={8} accessibilityLabel={`Добавить в план: ${stat.name}`}>
            <Text style={styles.addToPlanText}>＋ В план</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.rowAmount}>
          {/* "Скрыть суммы": just the % — of its plan, or of all spending without one */}
          {hidden ? (limit ? `${formatPercent(spent, limit)} плана` : `${formatPercent(spent, total)} трат`)
            : <>{cameIn ? <Text style={styles.refundsAmount}>+{limit ? formatShort(cameIn) : formatWithCurrency(cameIn, currency)}</Text>
              : limit ? <Text style={overStyle(spent, limit)}>{formatShort(spent)}</Text>
              // transfers carry their sign, as in the operations: what went out
              : stat.transfer ? `−${formatWithCurrency(spent, currency)}`
              : formatWithCurrency(spent, currency)}{limit ? <Text style={styles.rowLimit}> / {formatWithCurrency(limit, currency)}</Text> : null}{limit ? <Text style={[styles.rowLimit, overStyle(spent, limit)]}>{planShare(spent, limit)}</Text> : null}</>}
        </Text>
      </View>
      {/* an obligatory payment paid more than planned: an overspend like a limit's */}
      {limit && fixed && spent > limit ? (
        <>
          {/* as everywhere: the bar scaled to the spending, a tick at the plan; the overspend bold orange */}
          <Meter ratio={1} over={limit / spent} height={8} color={stat.color} />
          <Text style={[styles.rowStatus, styles.overLine]}>Перерасход {formatWithCurrency(spent - limit, currency)}</Text>
        </>
      ) : null}
      {limit && !fixed ? (
        <>
          {ratio > 1
            ? <Meter ratio={1} over={limit / spent} height={8} color={stat.color} />
            // nothing spent yet: no empty bar, "осталось" says it
            : ratio > 0 ? <Meter ratio={ratio} height={8} marker={stat.plan_norm === 'month' ? undefined : evenPace} /> : null}
          <Text style={styles.rowStatus}>
            {ratio > 1
              ? <Text style={styles.overLine}>Перерасход {formatWithCurrency(spent - limit, currency)}</Text>
              : `осталось ${formatWithCurrency(limit - spent, currency)}`}
            {/* a category spent daily / weekly: its limit per that period, "лимит ≈ 113 ₾ в неделю" */}
            {/* the current month: this window's limit, rebalanced on what's left of the month; a past one: the plan's share */}
            {/* the month's plan overspent: no limits any more, just the overspend */}
            {rhythm && ratio <= 1 ? (() => {
              const current = now && now.rhythm === rhythm ? now : undefined;
              const flat = current ? flatOf(current.windowParts) : (limit / dim) * RHYTHM_DAYS[rhythm];
              const value = current ? current.windowNorm : flat;
              // more than 5% off the plan's share: "лимит 113 ₾ (crossed out) → 95 ₾"
              const change = limitChange(value, flat);
              return (
                <Text style={styles.rowStatusMuted}>
                  {/* "старый → новый": no "лимит" word, it's plain what it is */}
                  {change ? ' · ' : ' · лимит '}
                  {change ? <Text style={styles.crossed}>{formatWithCurrency(Math.round(flat), currency)}</Text> : '≈ '}
                  {change ? ' → ' : ''}
                  <Text style={change === 'down' ? styles.paceAhead : change === 'up' ? styles.paceOk : undefined}>{formatWithCurrency(Math.round(value), currency)}</Text>
                  {` ${PER_PERIOD[rhythm]}`}
                </Text>
              );
            })() : null}
          </Text>
          {rhythm && ratio <= 1 && now && now.rhythm === rhythm ? (() => {
            // the current month: what's left in today's / this week's window, colored by pace
            const left = Math.round(now.windowNorm) - now.windowSpent;
            const p: Pace = paceOf(now.windowSpent, now.windowNorm, monthToDate, now.monthLimit);
            return (
              <Text style={[styles.rowStatus, styles.paceLine, p === 'ok' ? styles.paceOk : p === 'ahead' ? styles.paceAhead : styles.dangerText]}>
                {RHYTHM_NOW[rhythm]} {left < 0 ? `перерасход ${formatWithCurrency(-left, currency)}` : `осталось ${formatWithCurrency(left, currency)}`}
                {left >= 0 && rhythm !== 'day' ? <Text style={styles.rowStatusMuted}> · до {WEEKDAYS[new Date(`${now.window.to}T12:00:00`).getDay()]}</Text> : null}
              </Text>
            );
          })() : null}
        </>
      ) : null}
    </TouchableOpacity>
  );
}
