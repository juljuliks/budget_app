import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { Currency } from '@/db/fx';
import type { PlanItem } from '@/db/plans';
import { formatWithCurrency } from '@/shared/lib/money';
import { LockIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import { normText, percentOf, PlanView, SystemRow } from '../model/planView';
import LessNote from './LessNote';
import { KindIcon } from './PlanIcon';
import { styles, toneStyle } from './styles';

type Props = {
  p: PlanView; item: PlanItem; ym: string; currency: Currency; hidden: boolean;
  toShown: (minor: number, from: Currency) => number | null;
  onOpen: () => void;
};

/** Under a row's amount: its share of the budget, "10%" (after `before`, e.g. "в месяц · 10%"); "Скрыть суммы" — it alone. */
export function Share({ p, value, before }: { p: PlanView; value: number | null; before?: string }) {
  const share = p.shownBudget && value ? percentOf(value, p.shownBudget) || '0%' : '';
  const text = [before, share].filter(Boolean).join(' · ');
  return text ? <Text style={styles.amountOriginal}>{text}</Text> : null;
}

/**
 * A plan item: its kind's icon (a limit, a one-off payment; pinned — the badge on it), the amount and its share under it;
 * the whole row opens its sheet (amount, kind, "Повторять каждый месяц"; delete is in its title).
 */
export function PlanItemRow({ p, item, ym, currency, hidden, toShown, onOpen }: Props) {
  // an amount in the screen's currency (its own one if there's no rate)
  const inShown = (minor: number, from: Currency) => {
    const c = from === currency ? minor : toShown(minor, from);
    return c === null ? formatWithCurrency(minor, from) : p.money(c);
  };
  const label = `${item.emoji || ''} ${item.name}`.trim();
  // a one-off payment; a flexible item's amount per its norm rhythm, e.g. "лимит ≈ 46 ₾ в неделю"
  const note = item.kind === 'fixed' ? 'разовый платёж' : item.kind === 'limit' && !hidden ? normText(item, ym, currency) : '';
  return (
    <TouchableOpacity style={styles.row} onPress={onOpen} accessibilityLabel={`Изменить: ${categoryLabel(item)}`}>
      <KindIcon item={item} />
      <View style={styles.nameBox}>
        {/* the type is the section title, so just emoji + name here */}
        <Text style={styles.name} numberOfLines={1}>{label}</Text>
        {note ? <Text style={styles.percent}>{note}</Text> : null}
      </View>
      {item.limit_minor ? (
        <View style={styles.amountBox}>
          {/* "(200 $)" before an amount shown converted from another currency; "Скрыть суммы": the share only */}
          {hidden ? null : (
            <View style={styles.amountLine}>
              {item.converted_minor !== null && item.currency !== currency ? (
                <Text style={[styles.amount, styles.amountForeign]}>({formatWithCurrency(item.limit_minor, item.currency)})</Text>
              ) : null}
              <Text style={styles.amount}>
                {item.converted_minor !== null ? p.money(item.converted_minor) : formatWithCurrency(item.limit_minor, item.currency)}
              </Text>
            </View>
          )}
          <Share p={p} value={item.converted_minor} />
        </View>
      ) : hidden ? null : (
        // carried over without an amount: last month's as a muted hint, in the app's currency
        <Text style={[styles.amount, styles.amountEmpty]}>
          {item.previous_minor ? `в прошлом месяце ${inShown(item.previous_minor, item.currency)}` : '0'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/**
 * A system "category" (savings, the share outside the plan, what the month before sent): a lock for its icon, a tap
 * opens the budget (what the month before sent: how it's covered). The overspend took part of it: "меньше из-за
 * перерасхода: −15 ₾ ⓘ" under its name.
 */
export function SystemRowView({ p, r, hidden, onOpen, onLess }: { p: PlanView; r: SystemRow; hidden: boolean; onOpen: () => void; onLess: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onOpen} accessibilityLabel={`Изменить: ${r.name}`}>
      <View style={styles.pin}><LockIcon color={colors.muted} size={20} /></View>
      <View style={styles.nameBox}>
        <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
        {r.was !== undefined
          ? <LessNote label={r.note} less={r.was - r.value} money={p.money} onPress={onLess} />
          : <Text style={styles.percent}>{r.note}</Text>}
      </View>
      <View style={styles.amountBox}>
        {hidden ? null : (
          <View style={styles.amountLine}>
            {r.inBudget !== undefined && p.budgetMoney ? <Text style={[styles.amount, styles.savingForeign]}>{p.budgetMoney(r.inBudget)}</Text> : null}
            <Text style={[styles.amount, toneStyle(r.tone)]}>{`${r.carry === 'plus' ? '+' : ''}${p.money(r.value)}`}</Text>
          </View>
        )}
        {/* the leftover moved in: on top of the budget, no share */}
        {r.carry === 'plus' || !p.shownBudget ? null : <Text style={styles.amountOriginal}>{percentOf(r.value, p.shownBudget) || '0%'}</Text>}
      </View>
    </TouchableOpacity>
  );
}
