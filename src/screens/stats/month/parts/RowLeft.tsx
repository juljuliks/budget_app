// At the right of a planned category's row in the month's stats: what is left of its plan, big, and what that is under
// it — "235 ₾ / осталось", a payment's "18 ₾ / осталось оплатить" or "✓ / оплачено", over the plan "−176 ₾ / перерасход".
import React from 'react';
import { Text, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { isPaid } from '@/db/plans';
import { formatPercent } from '@/shared/lib/format';
import { formatWithCurrency } from '@/shared/lib/money';
import { styles } from './styles';

type Props = {
  spent: number;
  limit: number;
  currency: Currency;
  /** a payment (rent, a subscription): "осталось оплатить", paid — "✓ оплачено" */
  fixed: boolean;
  /** "Скрыть суммы": what is left as a share of the plan, an overspend just the word */
  hidden: boolean;
};

export default function RowLeft({ spent, limit, currency, fixed, hidden }: Props) {
  const over = spent > Math.round(limit);
  const paid = fixed && !over && isPaid(spent, limit);
  const [big, caption] = over
    ? [hidden ? '' : `−${formatWithCurrency(spent - limit, currency)}`, 'перерасход']
    : paid
      ? ['✓', 'оплачено']
      : [
          hidden ? formatPercent(limit - spent, limit) : formatWithCurrency(limit - spent, currency),
          fixed ? 'осталось оплатить' : 'осталось',
        ];
  const tone = over ? styles.overNum : paid ? styles.paidOn : undefined;
  return (
    <View style={styles.rowLeft}>
      {big ? <Text style={[styles.leftBig, tone]}>{big}</Text> : null}
      <Text style={[styles.leftCaption, tone, !big && styles.leftBig]}>{caption}</Text>
    </View>
  );
}
