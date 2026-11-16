import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { plural } from '@/shared/lib/format';
import { formatWithCurrency } from '@/shared/lib/money';
import { PER_PERIOD } from '@/shared/lib/strings';
import Masked from '@/shared/ui/Masked';
import type { AheadItem, MonthBreakdown } from '../model/monthBreakdown';
import { tileStyles as t } from './tileStyles';

type Props = {
  b: MonthBreakdown; currency: Currency;
  /** the month's last day ("30 нояб"): a monthly limit lasts till it */
  until: string;
  /** an unpaid payment's day ("20 нояб"), when it has one */
  dueOf: Map<number, string>;
};

type Key = 'payments' | 'limits' | 'over';

/**
 * Under the current month's bar, three tiles: «Платежи» (left to pay, «3 впереди»), «Лимиты» (left of them, for how
 * many days), «Перерасход» (past the plan, in how many categories; orange). A tap on one lists its categories under them
 * (again — closes): a payment with its day, a limit with its share per its rhythm («≈ 93 ₾ в неделю»), an overspend.
 */
export default function MonthTiles({ b, currency, until, dueOf }: Props) {
  const [open, setOpen] = useState<Key | null>(null);
  const money = (minor: number) => formatWithCurrency(Math.round(minor), currency);
  const n = (count: number, words: [string, string, string]) => `${count} ${plural(count, words)}`;
  const tiles: Array<{ key: Key; title: string; total: number; sub: string; items: AheadItem[]; warn?: boolean }> = [
    { key: 'payments', title: 'Платежи', total: b.payments.total, items: b.payments.items,
      sub: b.payments.items.length ? `${b.payments.items.length} впереди` : 'всё оплачено' },
    { key: 'limits', title: 'Лимиты', total: b.limits.total, items: b.limits.items, sub: `на ${n(b.limits.days, ['день', 'дня', 'дней'])}` },
    { key: 'over', title: 'Перерасход', total: b.over.total, items: b.over.items, warn: b.over.total > 0,
      sub: b.over.items.length ? n(b.over.items.length, ['категория', 'категории', 'категорий']) : 'нет' },
  ];
  // what stands by an item's amount: a payment's day, a limit's share per its rhythm (a monthly one — till the month's end)
  const note = (key: Key, i: AheadItem) => {
    if (key === 'payments') return dueOf.get(i.id) ?? '';
    if (key !== 'limits') return '';
    const l = b.limits.items.find((x) => x.id === i.id)!;
    return l.per === null ? `до ${until}` : `≈ ${money(l.per)} ${PER_PERIOD[l.norm]}`;
  };
  const shown = tiles.find((x) => x.key === open);
  return (
    <View>
      <View style={t.row}>
        {tiles.map((x) => (
          <TouchableOpacity
            key={x.key} style={[t.tile, x.warn && t.warnTile, open === x.key && t.picked]} disabled={!x.items.length}
            onPress={() => setOpen(open === x.key ? null : x.key)} accessibilityRole="button" accessibilityState={{ expanded: open === x.key }}
            testID={`tile-${x.key}`}
          >
            <Text style={[t.title, x.warn && t.warnText]} numberOfLines={1}>{x.title}</Text>
            <Masked style={[t.total, x.warn && t.warnText]}>{money(x.total)}</Masked>
            <Text style={[t.sub, x.warn && t.warnText]} numberOfLines={1}>{x.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {shown ? shown.items.map((i) => (
        <View key={i.id} style={t.item}>
          <Text style={t.label} numberOfLines={1}>{i.label}</Text>
          <Text style={t.amount}>
            {note(shown.key, i) ? <Text style={t.note}>{`${note(shown.key, i)} · `}</Text> : null}
            <Masked style={[t.amount, shown.key === 'over' && t.over]}>{money(i.minor)}</Masked>
          </Text>
        </View>
      )) : null}
    </View>
  );
}
