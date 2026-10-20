import React from 'react';
import { View } from 'react-native';
import type { PlanItem } from '@/db/plans';
import { LimitIcon, OneOffIcon, RepeatIcon, TiltedPinIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import { styles } from './styles';

/** "Повторять каждый месяц": a blue circle with a tilted pin, on an icon's corner (`corner`) or alone (the legend). */
export function PinBadge({ corner = false }: { corner?: boolean }) {
  return (
    <View style={[styles.pinBadge, corner && styles.pinBadgeCorner]} accessibilityLabel={corner ? 'повторяется каждый месяц' : undefined}>
      <TiltedPinIcon color={colors.onAccent} size={11} />
    </View>
  );
}

/**
 * A plan item's kind: a limit's bars, a regular payment's 🔁 or a one-off's tag; a limit with "Повторять каждый месяц" —
 * the pin on its corner (a regular payment repeats by itself: no pin, whatever `pinned` it keeps).
 */
export function KindIcon({ item }: { item: PlanItem }) {
  return (
    <View style={styles.pin}>
      <View>
        {item.every ? <RepeatIcon color={colors.accent} size={20} /> : item.kind === 'fixed' ? <OneOffIcon color={colors.muted} /> : <LimitIcon color={colors.muted} />}
        {item.pinned && item.kind === 'limit' ? <PinBadge corner /> : null}
      </View>
    </View>
  );
}
