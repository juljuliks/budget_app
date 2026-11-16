import React from 'react';
import { Text, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { formatWithCurrency } from '@/shared/lib/money';
import Masked from '@/shared/ui/Masked';
import { hiddenLeft } from '../../model/hiddenText';
import type { MonthBreakdown as Breakdown } from '../model/monthBreakdown';
import { styles } from './styles';

type Props = {
  b: Breakdown; currency: Currency; hidden: boolean; until: string;
  /** an unpaid payment's day ("20 нояб"), when it has one */
  dueOf?: Map<number, string>;
};

/** A line: what it is on the left, the amount on the right, then its overspend in orange ("· перерасход 13 ₾"). */
function Line({ label, value, over, tone }: { label: string; value: string; over?: string; tone?: 'ok' }) {
  return (
    <View style={styles.breakdownLine}>
      <Text style={styles.breakdownLabel} numberOfLines={1}>{label}</Text>
      <Text style={[styles.breakdownValue, tone === 'ok' && styles.paceOk]}>
        {value}{over ? <Text style={styles.overNum}>{value ? ' · ' : ''}{over}</Text> : null}
      </Text>
    </View>
  );
}

/**
 * Under the month's bar, opened by its chevron: the obligatory payments still to pay (how many paid, each unpaid one by
 * name), what is left of the limits and of the share outside the plan, the overspend, and a day's share of what is left
 * after the payments. "Скрыть суммы": the shares of each line's own plan, no amounts.
 */
export default function MonthBreakdown({ b, currency, hidden, until, dueOf }: Props) {
  const money = (minor: number) => formatWithCurrency(Math.round(minor), currency);
  const leftText = (left: number, of: number, word = 'осталось') => (hidden ? hiddenLeft(left, of, word) : `${word} ${money(left)}`);
  // a group's overspend: "перерасход 13 ₾" ("Скрыть суммы": the word)
  const overText = (over: number) => (over > 0 ? `перерасход${hidden ? '' : ` ${money(over)}`}` : undefined);
  const p = b.payments;
  return (
    <View style={styles.breakdown}>
      {p ? (
        <>
          <Line
            label={`Платежи · ${p.paid} из ${p.count} оплачены`}
            value={p.left > 0 ? leftText(p.left, p.plan, 'осталось оплатить') : 'всё оплачено'}
            over={overText(p.over)}
            tone={p.left > 0 ? undefined : 'ok'}
          />
          {p.unpaid.map((u) => (
            <View key={u.id} style={styles.breakdownLine}>
              <Text style={[styles.breakdownLabel, styles.breakdownSub, styles.breakdownIndent]} numberOfLines={1}>{dueOf?.has(u.id) ? `${u.label} · ${dueOf.get(u.id)}` : u.label}</Text>
              <Masked style={[styles.breakdownValue, styles.breakdownSub]}>{money(u.left)}</Masked>
            </View>
          ))}
        </>
      ) : null}
      {b.limits ? <Line label="Траты с лимитом" value={b.limits.left > 0 || !b.limits.over ? leftText(b.limits.left, b.limits.limit) : ''} over={overText(b.limits.over)} /> : null}
      {/* outside the plan, past its share: just the overspend */}
      {b.outside ? <Line label="Вне плана" value={b.outside.over ? '' : leftText(b.outside.left, b.outside.share)} over={overText(b.outside.over)} /> : null}
      {b.perDay && !hidden ? <Line label={`В день до ${until}, без платежей`} value={`≈ ${money(b.perDay.value)}`} /> : null}
    </View>
  );
}
