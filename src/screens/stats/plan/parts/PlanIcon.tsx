import React from 'react';
import { View } from 'react-native';
import type { PlanItem } from '@/db/plans';
import { LimitIcon, OneOffIcon, TiltedPinIcon } from '@/shared/ui/icons';
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

/** A plan item's kind: a limit's bars or a one-off's tag; pinned — the badge on its corner. */
export function KindIcon({ item }: { item: PlanItem }) {
  return (
    <View style={styles.pin}>
      <View>
        {item.kind === 'fixed' ? <OneOffIcon color={colors.muted} /> : <LimitIcon color={colors.muted} />}
        {item.pinned ? <PinBadge corner /> : null}
      </View>
    </View>
  );
}
