import React from 'react';
import AmountRow from '@/shared/ui/AmountRow';
import { Text, View } from 'react-native';
import { categoryLabel } from '@/db/categories';
import type { PlanItem } from '@/db/plans';
import { fundProgress, isSaved } from '@/entities/plan';
import { formatWithCurrency } from '@/shared/lib/money';
import ProgressRing from '@/shared/ui/ProgressRing';
import { colors } from '@/shared/theme/theme';
import type { PlanView } from '../model/planView';
import { Share } from './PlanItemRow';
import { styles } from './styles';
import { fundFitStatus } from '../../month/model/savingsSection';

type Props = { p: PlanView; item: PlanItem; hidden: boolean; onOpen: () => void };

/**
 * A fund in the plan: a ring of how far along it is for its icon, "1 200 из 3 000 ₾ · к 31 июля 2027", the month's
 * contribution ("(385 $)" before it: in the target's currency, when the screen shows another) and its share; saved up —
 * "можно тратить". A tap opens the fund.
 */
export function FundItemRow({ p, item, hidden, onOpen }: Props) {
  const f = item.fund;
  const saved = f ? isSaved(f.saved_minor, f.target_minor) : false;
  const value = item.converted_minor;
  const own =
    item.currency !== p.currency && item.limit_minor ? formatWithCurrency(item.limit_minor, item.currency) : null;
  // what the budget fitted of its contribution (from 🔒, less, none)
  const fit = fundFitStatus(item, p.ym, hidden);
  return (
    <AmountRow
      onPress={onOpen}
      accessibilityLabel={`Копилка: ${categoryLabel(item)}`}
      icon={
        <ProgressRing
          ratio={f ? f.saved_minor / f.target_minor : 0}
          color={saved ? colors.income : colors.fund}
          track={colors.fundTrack}
          size={22}
        />
      }
      title={`${item.emoji || ''} ${item.name}`.trim()}
      notes={
        <>
          {f ? (
            <Text style={styles.percent}>
              {hidden
                ? saved
                  ? 'накоплено'
                  : `${Math.floor((f.saved_minor / f.target_minor) * 100)}%`
                : fundProgress(f.saved_minor, f.target_minor, f.due, item.currency)}
            </Text>
          ) : null}
          {fit ? <Text style={[styles.percent, fit.tone === 'warn' && { color: colors.warn }]}>{fit.text}</Text> : null}
        </>
      }
      amount={
        <View style={styles.amountBox}>
          {hidden ? null : (
            <View style={styles.amountLine}>
              <Text style={styles.amount}>
                {own ?? (value !== null ? p.money(value) : formatWithCurrency(item.limit_minor, item.currency))}
              </Text>
            </View>
          )}
          <Share p={p} value={value} before={saved && !item.limit_minor ? 'можно тратить' : undefined} />
        </View>
      }
    />
  );
}
