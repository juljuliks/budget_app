// A limit spent daily / weekly / by 2 weeks, in the month's stats: its limit per that period after "665 из 900 ₾"
// (" · лимит ≈ 113 ₾ в неделю", moved — " · лимит 95 ₾ в неделю ⓘ") and, in the current month, a line of what is
// left in today's / this week's window, coloured by pace.
import React from 'react';
import { Text } from 'react-native';
import type { Currency } from '@/db/fx';
import { RHYTHM_DAYS, WEEKDAYS } from '@/shared/lib/dates';
import { formatWithCurrency } from '@/shared/lib/money';
import { PER_PERIOD } from '@/shared/lib/strings';
import { CategoryNorm, flatOf, limitChange, Pace, paceOf } from '@/stats/norms';
import { hiddenLeft, limitMove } from '../../model/hiddenText';
import { styles } from './styles';

type Rhythm = keyof typeof RHYTHM_DAYS;
const RHYTHM_NOW = { day: 'Сегодня', week: 'На этой неделе', '2weeks': 'За эти 2 недели' } as const;

type Props = {
  rhythm: Rhythm;
  limit: number;
  dim: number;
  currency: Currency;
  hidden: boolean;
  /** the current month only: the norm window around today */
  now?: CategoryNorm;
  /** planned in another currency: the norms (in the stats' currency) by the plan's rate */
  scale: number;
};

/** A rhythm's limit now: the plan's even share, this window's (rebalanced on what's left), and whether it moved. */
export function rhythmMove({
  rhythm,
  limit,
  dim,
  now,
  scale,
}: Pick<Props, 'rhythm' | 'limit' | 'dim' | 'now' | 'scale'>) {
  const current = now && now.rhythm === rhythm ? now : undefined;
  const flat = current ? flatOf(current.windowParts) * scale : (limit / dim) * RHYTHM_DAYS[rhythm];
  const value = current ? current.windowNorm * scale : flat;
  // more than 5% off the plan's share
  return { flat, value, change: limitChange(value, flat), current };
}

/**
 * " · лимит ≈ 113 ₾ в неделю": the current month — this window's limit, rebalanced on what's left; a past one — the
 * plan's share. Moved — just the new one, coloured (lower — orange, higher — green), ⓘ after the line says why.
 */
export function RhythmLimit(p: Props) {
  const { rhythm, currency, hidden } = p;
  const { flat, value, change } = rhythmMove(p);
  // "Скрыть суммы": just how much it moved, "лимит ↓ 16%"; unmoved — nothing
  if (hidden) {
    const move = change ? limitMove(flat, value) : '';
    return move ? <Text style={change === 'down' ? styles.paceAhead : styles.paceOk}>{` · лимит ${move}`}</Text> : null;
  }
  return (
    <Text>
      {change ? ' · лимит ' : ' · лимит ≈ '}
      <Text style={change === 'down' ? styles.paceAhead : change === 'up' ? styles.paceOk : undefined}>
        {formatWithCurrency(Math.round(value), currency)}
      </Text>
      {` ${PER_PERIOD[rhythm]}`}
    </Text>
  );
}

/** The current month: "На этой неделе осталось 40 ₾ · до вс", coloured by pace. */
export function RhythmNow({
  rhythm,
  currency,
  hidden,
  now,
  scale,
  monthToDate,
}: Omit<Props, 'limit' | 'dim'> & { now: CategoryNorm; monthToDate: number }) {
  const left = Math.round((now.windowNorm - now.windowSpent) * scale);
  const p: Pace = paceOf(now.windowSpent, now.windowNorm, monthToDate, now.monthLimit);
  return (
    <Text
      style={[
        styles.rowStatus,
        styles.paceLine,
        p === 'ok' ? styles.paceOk : p === 'ahead' ? styles.paceAhead : styles.dangerText,
      ]}
    >
      {RHYTHM_NOW[rhythm]}{' '}
      {hidden
        ? hiddenLeft(left, now.windowNorm * scale)
        : left < 0
          ? `перерасход ${formatWithCurrency(-left, currency)}`
          : `осталось ${formatWithCurrency(left, currency)}`}
      {left >= 0 && rhythm !== 'day' ? (
        <Text style={styles.rowStatusMuted}> · до {WEEKDAYS[new Date(`${now.window.to}T12:00:00`).getDay()]}</Text>
      ) : null}
    </Text>
  );
}
