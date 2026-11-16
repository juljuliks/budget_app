import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { shortRange } from '@/shared/lib/dateRange';
import type { BarMark } from '../model/monthPace';
import { MARK_STATUS } from './BarMarks';
import { markStyles as s } from './markStyles';

const STATUS_STYLE = { paid: s.infoPaid, missed: s.infoMissed, ahead: s.infoAhead };

type Props = {
  /** the tapped mark's payments (several — those drawn as one) */
  marks: BarMark[];
  /** an amount in the month's currency; null — «Скрыть суммы» */
  money: ((minor: number) => string) | null;
  onClose: () => void;
};

/**
 * Under the month's bar instead of «Осталось …», after a tap on a payment's mark: each of its payments — «🏠 Аренда ·
 * 1 373 ₾ · 3 ноя · оплачен». A tap on it (or on the mark again) — «Осталось …» back.
 */
export default function MarkInfo({ marks, money, onClose }: Props) {
  return (
    <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityHint="Скрыть" testID="mark-info">
      {marks.map((m) => (
        <Text key={m.key} style={s.infoLine}>
          {`${m.emoji} ${m.name}${money ? ` · ${money(Math.round(m.minor))}` : ''} · ${shortRange({ from: m.day, to: m.day })} · `}
          <Text style={STATUS_STYLE[m.status]}>{MARK_STATUS[m.status]}</Text>
        </Text>
      ))}
    </TouchableOpacity>
  );
}
