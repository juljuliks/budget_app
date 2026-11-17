// «Подробнее» under the ring's legend: the budget of the month, every piece of it — by categories or by sections, as
// the ring's cut — with its share, what is spent of its plan against it and a bar; «Свободно» at the bottom.
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import type { Currency } from '@/db/fx';
import { formatPercent } from '@/shared/lib/format';
import { formatShort, formatWithCurrency } from '@/shared/lib/money';
import { colors } from '@/shared/theme/theme';
import BottomSheet, { SheetScrollView } from '@/shared/ui/BottomSheet';
import { PencilIcon } from '@/shared/ui/icons';
import Masked, { MaskedTotal } from '@/shared/ui/Masked';
import Meter from '@/shared/ui/Meter';
import Segmented from '@/shared/ui/Segmented';
import { CUTS, type DonutCut, type Slice } from '../model/donutSlices';
import { SAVINGS_ID } from './sections';
import { overStyle, styles } from './styles';

type Props = {
  visible: boolean;
  onClose: () => void;
  cut: DonutCut;
  onCut: (cut: DonutCut) => void;
  /** the plan's slices of that cut */
  items: Slice[];
  /** the budget (else the whole plan) and its word, «бюджета» / «плана» */
  base: number; word: string;
  currency: Currency;
  /** the pencil by the budget: its sheet (this one closed first) */
  onBudget: () => void;
};

export default function DistributionSheet({ visible, onClose, cut, onCut, items, base, word, currency, onBudget }: Props) {
  const free = items.find((s) => s.key === 'free');
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Распределение бюджета">
      <View style={styles.splitBody}>
      <TouchableOpacity style={styles.splitBudget} onPress={() => { onClose(); onBudget(); }} hitSlop={6} accessibilityRole="button">
        <Text style={styles.rowStatus}>{word === 'бюджета' ? 'Бюджет месяца' : 'План месяца'} · </Text>
        <Masked style={styles.rowStatus}>{formatWithCurrency(Math.round(base), currency)}</Masked>
        <PencilIcon color={colors.accent} size={14} />
      </TouchableOpacity>
      <Segmented options={CUTS} value={cut} onChange={onCut} style={styles.splitCuts} />
      <SheetScrollView>
        {items.filter((s) => s.key !== 'free').map((s) => <Row key={s.key} s={s} base={base} currency={currency} />)}
        <View style={styles.splitFree}>
          <Text style={styles.rowName}>Свободно</Text>
          <Masked style={styles.leftBig}>{formatWithCurrency(Math.round(free?.value ?? 0), currency)}</Masked>
        </View>
      </SheetScrollView>
      </View>
    </BottomSheet>
  );
}

/** A piece: its name and share of the budget, "spent / plan ₾", its bar (past the plan — scaled to the spending). */
function Row({ s, base, currency }: { s: Slice; base: number; currency: Currency }) {
  const plan = Math.round(s.value);
  const spent = Math.round((s.done ?? 0) * s.value);
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={[styles.dot, { backgroundColor: s.color ?? colors.faint }]} />
        <Text style={styles.rowName} numberOfLines={1}>{`${s.emoji || ''} ${s.title}`.trim()}<Text style={styles.rowStatusMuted}>{` · ${formatPercent(s.value, base)}`}</Text></Text>
        <MaskedTotal style={styles.rowAmount} hiddenText={formatPercent(spent, plan)}>
          <Text style={s.key === SAVINGS_ID ? undefined : overStyle(spent, plan)}>{formatShort(spent)}</Text>
          <Text style={styles.rowLimit}>{` / ${formatWithCurrency(plan, currency)}`}</Text>
        </MaskedTotal>
      </View>
      {spent > plan && s.key !== SAVINGS_ID
        ? <Meter ratio={1} over={plan / spent} height={8} color={s.color ?? colors.faint} />
        : <Meter ratio={plan ? spent / plan : 0} height={8} color={s.color ?? colors.faint} />}
    </View>
  );
}
