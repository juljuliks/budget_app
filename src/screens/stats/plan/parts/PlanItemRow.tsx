import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { Currency } from '@/db/fx';
import type { PlanItem } from '@/db/plans';
import { formatWithCurrency } from '@/shared/lib/money';
import { LockIcon, PinIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import { normText, percentOf, PlanView, SystemRow } from '../model/planView';
import { styles, toneStyle } from './styles';

type Props = {
  p: PlanView; item: PlanItem; ym: string; currency: Currency; hidden: boolean;
  toShown: (minor: number, from: Currency) => number | null;
  onOpen: () => void; onPin: () => void;
};

/** A plan item: the whole row opens its sheet (amount, kind; delete is in its title); the pin is its own button. */
export function PlanItemRow({ p, item, ym, currency, hidden, toShown, onOpen, onPin }: Props) {
  const { shownBudget } = p;
  // an amount in the screen's currency (its own one if there's no rate)
  const inShown = (minor: number, from: Currency) => {
    const c = from === currency ? minor : toShown(minor, from);
    return c === null ? formatWithCurrency(minor, from) : p.money(c);
  };
  const label = `${item.emoji || ''} ${item.name}`.trim();
  return (
    <TouchableOpacity style={styles.row} onPress={onOpen} accessibilityLabel={`Изменить: ${categoryLabel(item)}`}>
      <TouchableOpacity onPress={onPin} hitSlop={8} accessibilityLabel={item.pinned ? 'Не повторять каждый месяц' : 'Повторять каждый месяц'} style={styles.pin}>
        <PinIcon color={item.pinned ? colors.accent : colors.muted} filled={item.pinned} />
      </TouchableOpacity>
      <View style={styles.nameBox}>
        {/* the type is the section title, so just emoji + name here */}
        <Text style={styles.name} numberOfLines={1}>{label}</Text>
        {item.kind === 'fixed' || item.limit_minor || (shownBudget && item.converted_minor) ? (
          <Text style={styles.percent}>
            {[
              item.kind === 'fixed' ? 'обязательный платёж' : '',
              // a flexible item's amount per its norm rhythm, e.g. "≈ 46 ₾ в неделю"
              item.kind === 'limit' && !hidden ? normText(item, ym, currency) : '',
              shownBudget && item.converted_minor ? `${percentOf(item.converted_minor, shownBudget)} бюджета` : '',
            ].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
      {/* "Скрыть суммы": the amounts left out (the % of the budget stays in the line under the name) */}
      {hidden ? null : item.limit_minor ? (
        <View style={styles.amountBox}>
          <Text style={styles.amount}>
            {item.converted_minor !== null ? p.money(item.converted_minor) : formatWithCurrency(item.limit_minor, item.currency)}
          </Text>
          {/* "200 $" under an amount shown converted from another currency */}
          {item.converted_minor !== null && item.currency !== currency ? (
            <Text style={styles.amountOriginal}>({formatWithCurrency(item.limit_minor, item.currency)})</Text>
          ) : null}
        </View>
      ) : (
        // carried over without an amount: last month's as a muted hint, in the app's currency
        <Text style={[styles.amount, styles.amountEmpty]}>
          {item.previous_minor ? `в прошлом месяце ${inShown(item.previous_minor, item.currency)}` : '0'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/** A system "category" (savings, the share outside the plan): a lock in the pin's place, a tap opens the budget. */
export function SystemRowView({ p, r, hidden, onOpen }: { p: PlanView; r: SystemRow; hidden: boolean; onOpen: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onOpen} accessibilityLabel={`Изменить: ${r.name}`}>
      <View style={styles.pin}><LockIcon color={colors.muted} size={20} /></View>
      <View style={styles.nameBox}>
        <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
        <Text style={styles.percent}>{[r.note, `${percentOf(r.value, p.shownBudget!) || '0%'} бюджета`].filter(Boolean).join(' · ')}</Text>
      </View>
      {hidden ? null : (
        <View style={styles.amountBox}>
          <Text style={[styles.amount, toneStyle(r.tone)]}>{p.money(r.value)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
