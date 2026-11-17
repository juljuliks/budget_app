import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { Currency } from '@/db/fx';
import { CategoryStat, isPaid, spentOf } from '@/db/plans';
import { useHideAmounts } from '@/shared/settings/hideAmounts';
import { formatPercent } from '@/shared/lib/format';
import { formatShort, formatWithCurrency } from '@/shared/lib/money';
import type { useOpenCategoryTransactions } from '@/shared/navigation/navigation';
import Meter from '@/shared/ui/Meter';
import PressMenu, { PressAction } from '@/shared/ui/PressMenu';
import type { CategoryNorm } from '@/stats/norms';
import PaymentsBar from './PaymentsBar';
import { RhythmLimit, RhythmNow } from './RhythmLimit';
import RowLeft from './RowLeft';
import { styles } from './styles';

type Props = {
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
  /** a tap or a long press: these as buttons over the finger (its operations, its plan, its dynamics) */
  actions?: PressAction[];
  /** "Жизнь: Покупки": outside the plan, where the rows aren't under their type's section */
  withType?: boolean;
  /** the current month, well off its usual by the same days: "+44% к обычному" (Динамика трат) */
  usual?: string;
  /** a category with repeating payments: what they are ("каждый месяц · следующее 3 ноя") */
  note?: string;
  /** its payments' charges this month: more than one — a bar of them, "оплачено 2 из 4" */
  charges?: { total: number; done: number };
};

/**
 * A category in the month's stats. Planned: what is left at the right ("235 ₾ осталось", "−176 ₾ перерасход"), its bar,
 * "665 из 900 ₾" under it (a rhythm's limit after it, its window's line below); a payment — "осталось оплатить" /
 * "✓ оплачено", charged several times — a bar of its charges. Unplanned: what was spent.
 */
export default function CategoryRow(props: Props) {
  const { stat: shownStat, total, currency: shown, onAddToPlan, actions, withType, usual, note } = props;
  // planned in another currency: the row in it; the norms (counted in the stats' currency) scaled by the plan's rate
  const own = shownStat.own;
  const stat = own ? { ...shownStat, spent_minor: own.spent_minor, limit_minor: own.limit_minor } : shownStat;
  const currency = own ? own.currency : shown;
  const scale = own && shownStat.limit_minor ? own.limit_minor / shownStat.limit_minor : 1;
  const { limit_minor: limit } = stat;
  // a transfer category: sent minus what came back; more came back = "+", and nothing spent for its plan
  const spent = spentOf(stat);
  const cameIn = stat.transfer && stat.spent_minor < 0 ? -stat.spent_minor : 0;
  const hidden = useHideAmounts();
  const fixed = stat.plan_kind === 'fixed';

  return (
    <PressMenu style={styles.row} actions={actions ?? []} accessibilityHint="Операции, план, динамика">
      <View style={styles.rowTop}>
        <View style={[styles.dot, { backgroundColor: stat.color }]} />
        <Text style={styles.rowName} numberOfLines={1}>{withType ? categoryLabel(stat) : `${stat.emoji || ''} ${stat.name}`.trim()}</Text>
        {onAddToPlan ? (
          <TouchableOpacity style={styles.addToPlan} onPress={onAddToPlan} hitSlop={8} accessibilityLabel={`Добавить в план: ${stat.name}`}>
            <Text style={styles.addToPlanText}>＋ В план</Text>
          </TouchableOpacity>
        ) : null}
        {limit ? <RowLeft spent={spent} limit={limit} currency={currency} fixed={fixed} hidden={hidden} /> : (
          <Text style={styles.rowAmount}>
            {/* "Скрыть суммы": its share of all spending */}
            {hidden ? `${formatPercent(spent, total)} трат`
              : cameIn ? <Text style={styles.refundsAmount}>+{formatWithCurrency(cameIn, currency)}</Text>
              // transfers carry their sign, as in the operations: what went out
              : stat.transfer ? `−${formatWithCurrency(spent, currency)}`
              : formatWithCurrency(spent, currency)}
          </Text>
        )}
      </View>
      {note ? <Text style={styles.rowStatus} numberOfLines={1}>{note}</Text> : null}
      {limit ? (fixed ? <PaymentLines {...props} spent={spent} limit={limit} currency={currency} hidden={hidden} />
        : <LimitLines {...props} spent={spent} limit={limit} currency={currency} hidden={hidden} cameIn={cameIn} scale={scale} />) : null}
      {usual ? <Text style={styles.rowStatus}>{usual}</Text> : null}
    </PressMenu>
  );
}

type Lines = Props & { spent: number; limit: number; currency: Currency; hidden: boolean };

/** "665 из 900 ₾"; hidden — its share of the plan */
function spentOfPlan(spent: number, limit: number, currency: Currency, hidden: boolean): string {
  return hidden ? `${formatPercent(spent, limit)} плана` : `${formatShort(spent)} из ${formatWithCurrency(limit, currency)}`;
}

/** A limit: the bar (over it — scaled to the spending, a tick at the plan), "665 из 900 ₾", a rhythm's limit and window. */
function LimitLines({ stat, spent, limit, currency, hidden, cameIn, scale, evenPace, dim, now, monthToDate }: Lines & { cameIn: number; scale: number }) {
  const ratio = spent / limit;
  const rhythm = stat.plan_norm && stat.plan_norm !== 'month' ? stat.plan_norm : null;
  return (
    <>
      {/* the category's own color, as its dot and the ring (an overspend is orange anyway) */}
      {ratio > 1 ? <Meter ratio={1} over={limit / spent} height={8} color={stat.color} />
        : <Meter ratio={ratio} height={8} color={stat.color} marker={rhythm ? evenPace : undefined} />}
      <Text style={styles.rowStatus}>
        {cameIn && !hidden ? <Text style={styles.paceOk}>+{formatShort(cameIn)}</Text> : null}
        {cameIn && !hidden ? ` из ${formatWithCurrency(limit, currency)}` : spentOfPlan(spent, limit, currency, hidden)}
        {/* the month's plan overspent: no limits any more, just the overspend */}
        {rhythm && ratio <= 1 ? <RhythmLimit rhythm={rhythm} limit={limit} dim={dim} currency={currency} hidden={hidden} now={now} scale={scale} /> : null}
      </Text>
      {rhythm && ratio <= 1 && now && now.rhythm === rhythm
        ? <RhythmNow rhythm={rhythm} currency={currency} hidden={hidden} now={now} scale={scale} monthToDate={monthToDate} /> : null}
    </>
  );
}

/** A payment: charged several times this month — a bar of its charges and "оплачено 2 из 4"; paid over the plan — the overspend's bar. */
function PaymentLines({ stat, spent, limit, currency, hidden, charges }: Lines) {
  const several = charges && charges.total > 1 ? charges : null;
  const over = spent > Math.round(limit);
  const amounts = isPaid(spent, limit) && !over ? (hidden ? '' : formatWithCurrency(limit, currency)) : spentOfPlan(spent, limit, currency, hidden);
  return (
    <>
      {several ? <PaymentsBar total={several.total} done={several.done} color={stat.color} />
        : over ? <Meter ratio={1} over={limit / spent} height={8} color={stat.color} /> : null}
      {several || amounts ? (
        <Text style={styles.rowStatus}>{[several ? `оплачено ${several.done} из ${several.total}` : '', amounts].filter(Boolean).join(' · ')}</Text>
      ) : null}
    </>
  );
}
