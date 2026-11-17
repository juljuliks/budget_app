// The month's ring in «План»: in the hole the budget and what is free of it ("Бюджет 3 724 ₾ · свободно 120 ₾ ✏️", a
// tap — its sheet); a slice tapped — its plan, its share of the budget and how much of it is spent.
import React from 'react';
import { Text, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { formatPercent } from '@/shared/lib/format';
import { formatWithCurrency } from '@/shared/lib/money';
import { colors } from '@/shared/theme/theme';
import { PencilIcon } from '@/shared/ui/icons';
import Masked from '@/shared/ui/Masked';
import { centerStyles as s, fitSize } from '../../parts/DonutCenter';
import type { Slice } from '../model/donutSlices';
import { SAVINGS_ID } from './sections';

type Props = {
  base: number; word: string; free: number; picked?: Slice; currency: Currency;
  /** the hole's width for the text */
  hole: number;
};

export default function PlanCenter({ base, word, free, picked, currency, hole: W }: Props) {
  const money = (minor: number) => formatWithCurrency(Math.round(minor), currency);
  const cap = [s.caption, s.captionSmall];
  if (!picked) {
    return (
      <>
        <Text style={cap}>{word === 'бюджета' ? 'Бюджет' : 'План'}</Text>
        <Masked style={[s.hero, { fontSize: fitSize(money(base), 28, W) }]}>{money(base)}</Masked>
        <View style={[s.ofRow, s.ofRowSmall, { maxWidth: W }]}>
          {free > 0 ? <Masked style={cap}>{`свободно ${money(free)}`}</Masked> : <Text style={cap}>всё распределено</Text>}
          <PencilIcon color={colors.accent} size={14} />
        </View>
      </>
    );
  }
  const done = picked.done ?? 0;
  return (
    <>
      <Text style={[s.pickedName, s.pickedNameSmall, { maxWidth: W }]} numberOfLines={2}>{`${picked.emoji || ''} ${picked.title}`.trim()}</Text>
      <Masked style={[s.pickedAmount, { fontSize: fitSize(money(picked.value), 20, W) }]}>{money(picked.value)}</Masked>
      <Text style={cap}>{`${formatPercent(picked.value, base)} ${word}`}</Text>
      {picked.key !== 'free' ? (
        <Text style={[...cap, done > 1.005 && s.over]}>{`${picked.key === SAVINGS_ID ? 'отложено' : 'потрачено'} ${formatPercent(done, 1)}`}</Text>
      ) : null}
    </>
  );
}
