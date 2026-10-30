import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { PlanItem } from '@/db/plans';
import { paymentWords } from '@/entities/category';
import { inMonthYear, inTime, periodText, shortDay } from '@/features/recurring-payments';
import { chargeAt, ONCE, todayKey } from '@/db/recurring';
import { RepeatIcon } from '@/shared/ui/icons';
import { formatWithCurrency } from '@/shared/lib/money';
import { colors } from '@/shared/theme/theme';
import type { PlanView } from '../model/planView';
import { Share } from './PlanItemRow';
import { styles } from './styles';

type Props = { p: PlanView; item: PlanItem; hidden: boolean; onOpen: () => void };

/**
 * A category with repeating payments in the plan: the repeat sign for its icon, its payments with a day by name ("копим: …" — those
 * saved up for), the month's charges (counted from them; by hand until one has a day; the contributions — in
 * "Сбережения", SavingItemRow) and their share. All its payments in another currency — "(6 $)"
 * before. A tap opens the "Подписки" sheet.
 */
export function RecurringItemRow({ p, item, hidden, onOpen }: Props) {
  const names = item.subs?.names ?? [];
  const saving = item.subs?.saving_names ?? [];
  const listed = [names.join(', '), saving.length ? `копим: ${saving.join(', ')}` : ''].filter(Boolean).join(' · ');
  const w = paymentWords(!!item.by_merchant);
  const one = item.subs?.single;
  // its only payment: how often and when (the plan, not what was paid: a charge done — the next one); a subscription
  // without a day — "без даты"; a monthly regular payment has none: how often only
  const next = one?.day && one.done ? (one.period === ONCE ? null : chargeAt(one.day, one.period, 1)) : null;
  const single = one ? [periodText(one.period),
    next ? `следующее ${shortDay(next)}` : one.day && one.done ? shortDay(one.day)
      // "через N дней" — from today: in the current month's plan only (in November's "через месяц" read as December)
      : one.day ? [shortDay(one.day), p.timing === 'current' ? inTime(one.day, todayKey()) : null].filter(Boolean).join(', ') : item.by_merchant ? 'без даты' : null,
  ].filter(Boolean).join(' · ') : null;
  // "(6 $)": all its payments in one currency, not the screen's
  const own = item.kind === 'subs' ? item.subs?.in_currency : undefined;
  const foreign = own && own.currency !== p.currency && own.charges_minor > 0 ? formatWithCurrency(own.charges_minor, own.currency) : null;
  // none charged this month (0 at the right, the row faded and last in its section): when and how much next — "30 ₾ в ноябре"
  const up = item.subs?.upcoming;
  const upcoming = up ? `${formatWithCurrency(up.amount_minor, up.currency)} ${inMonthYear(up.ym)}` : null;
  // none at all: nothing to set a day to
  const note = upcoming ?? single ?? (item.subs?.empty ? w.none : item.kind !== 'subs' ? `вручную · задайте даты ${w.toAll}` : listed || w.noDated);
  return (
    <TouchableOpacity style={[styles.row, up && styles.later]} onPress={onOpen} accessibilityLabel={categoryLabel(item)}>
      <View style={styles.pin}><RepeatIcon color={colors.accent} size={20} /></View>
      <View style={styles.nameBox}>
        <Text style={styles.name} numberOfLines={1}>{`${item.emoji || ''} ${item.name}`.trim()}</Text>
        <Text style={styles.percent} numberOfLines={1}>{note}</Text>
      </View>
      <View style={styles.amountBox}>
        {hidden ? null : (
          <View style={styles.amountLine}>
            {foreign ? <Text style={[styles.amount, styles.amountForeign]}>{`(${foreign})`}</Text> : null}
            <Text style={styles.amount}>{item.converted_minor !== null ? p.money(item.converted_minor) : formatWithCurrency(item.limit_minor, item.currency)}</Text>
          </View>
        )}
        <Share p={p} value={item.converted_minor} />
      </View>
    </TouchableOpacity>
  );
}
