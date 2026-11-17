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
import { InfoIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import { explainLimit } from './limitWhy';
import { RhythmLimit, RhythmNow, rhythmMove } from './RhythmLimit';
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

  const lines = limit ? { ...props, spent, limit, currency, hidden, cameIn, scale } : null;
  // under the name: what was spent of the plan (a payment's note and charges first; a rhythm's limit after)
  const sub = lines ? (fixed ? paymentSub(lines, note) : <LimitSub {...lines} />) : null;

  return (
    <PressMenu style={styles.row} actions={actions ?? []} accessibilityHint="Операции, план, динамика">
      {/* two columns over the bar: the name over its amounts at the left, what is left over its word at the right */}
      <View style={styles.rowCols}>
        <View style={styles.rowMain}>
          <View style={styles.rowTop}>
            <View style={[styles.dot, { backgroundColor: stat.color }]} />
            <Text style={styles.rowName} numberOfLines={1}>{withType ? categoryLabel(stat) : `${stat.emoji || ''} ${stat.name}`.trim()}</Text>
            {onAddToPlan ? (
              <TouchableOpacity style={styles.addToPlan} onPress={onAddToPlan} hitSlop={8} accessibilityLabel={`Добавить в план: ${stat.name}`}>
                <Text style={styles.addToPlanText}>＋ В план</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {sub ? <SubLine why={lines && !fixed ? limitWhy(lines) : undefined}>{sub}</SubLine> : note ? <Text style={styles.rowSub} numberOfLines={1}>{note}</Text> : null}
        </View>
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
      {lines ? (fixed ? <PaymentBar {...lines} /> : <LimitBar {...lines} />) : null}
      {usual ? <Text style={styles.rowStatus}>{usual}</Text> : null}
    </PressMenu>
  );
}

type Lines = Props & { spent: number; limit: number; currency: Currency; hidden: boolean; cameIn: number; scale: number };

/** the category's bars: thin, as the rows are */
const BAR = 6;
const rhythmOf = (stat: CategoryStat) => (stat.plan_norm && stat.plan_norm !== 'month' ? stat.plan_norm : null);

/** Under the name, one line; a rebalanced limit — ⓘ after it, saying why. */
function SubLine({ why, children }: { why?: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.rowSubLine}>
      <Text style={styles.rowSubText} numberOfLines={1}>{children}</Text>
      {why ? (
        <TouchableOpacity style={styles.infoGap} onPress={why} hitSlop={8} accessibilityRole="button" accessibilityLabel="Почему лимит изменился">
          <InfoIcon color={colors.accent} size={13} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** A rhythm's limit rebalanced this month (not overspent): ⓘ opens why. */
function limitWhy({ stat, spent, limit, dim, now, scale, ym, currency }: Lines): (() => void) | undefined {
  const rhythm = rhythmOf(stat);
  if (!rhythm || spent > limit) return undefined;
  const m = rhythmMove({ rhythm, limit, dim, now, scale });
  const current = m.current;
  return m.change && current ? () => explainLimit(rhythm, current, ym, m.flat, m.value, scale, currency) : undefined;
}

/** "665 из 900 ₾"; hidden — its share of the plan */
function spentOfPlan(spent: number, limit: number, currency: Currency, hidden: boolean): string {
  return hidden ? `${formatPercent(spent, limit)} плана` : `${formatShort(spent)} из ${formatWithCurrency(limit, currency)}`;
}

/** A limit under its name: "665 из 900 ₾" (what came back: "+50 из 900 ₾"), a rhythm's limit after it. */
function LimitSub({ stat, spent, limit, currency, hidden, cameIn, scale, dim, now }: Lines) {
  const rhythm = rhythmOf(stat);
  return (
    <>
      {cameIn && !hidden ? <Text style={styles.paceOk}>+{formatShort(cameIn)}</Text> : null}
      {cameIn && !hidden ? ` из ${formatWithCurrency(limit, currency)}` : spentOfPlan(spent, limit, currency, hidden)}
      {/* the month's plan overspent: no limits any more, just the overspend */}
      {rhythm && spent <= limit ? <RhythmLimit rhythm={rhythm} limit={limit} dim={dim} currency={currency} hidden={hidden} now={now} scale={scale} /> : null}
    </>
  );
}

/** A limit's bar (over it — scaled to the spending, a tick at the plan) and its window's line. */
function LimitBar({ stat, spent, limit, currency, hidden, scale, evenPace, now, monthToDate }: Lines) {
  const ratio = spent / limit;
  const rhythm = rhythmOf(stat);
  return (
    <>
      {/* the category's own color, as its dot and the ring (an overspend is orange anyway) */}
      {ratio > 1 ? <Meter ratio={1} over={limit / spent} height={BAR} marginTop={6} color={stat.color} />
        : <Meter ratio={ratio} height={BAR} marginTop={6} color={stat.color} marker={rhythm ? evenPace : undefined} />}
      {rhythm && ratio <= 1 && now && now.rhythm === rhythm
        ? <RhythmNow rhythm={rhythm} currency={currency} hidden={hidden} now={now} scale={scale} monthToDate={monthToDate} /> : null}
    </>
  );
}

/** A payment under its name: "оплачено 2 из 4" when charged several times, "88 из 106 ₾" (paid — its amount), its note. */
function paymentSub({ spent, limit, currency, hidden, charges }: Lines, note?: string): React.ReactNode {
  const several = charges && charges.total > 1 ? charges : null;
  const over = spent > Math.round(limit);
  const amounts = isPaid(spent, limit) && !over ? (hidden ? '' : formatWithCurrency(limit, currency)) : spentOfPlan(spent, limit, currency, hidden);
  // the numbers first: a long note is what gets cut
  const numbers = [several ? `оплачено ${several.done} из ${several.total}` : '', amounts].filter(Boolean).join(' · ');
  return <>{numbers}{numbers && note ? ' · ' : ''}{note ? <Text>{note}</Text> : null}</>;
}

/** A payment's bar: charged several times — a piece per charge; paid over the plan — the overspend's. */
function PaymentBar({ stat, spent, limit, charges }: Lines) {
  const several = charges && charges.total > 1 ? charges : null;
  if (several) return <PaymentsBar total={several.total} done={several.done} color={stat.color} />;
  return spent > Math.round(limit) ? <Meter ratio={1} over={limit / spent} height={BAR} marginTop={6} color={stat.color} /> : null;
}
