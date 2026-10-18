import React, { useState } from 'react';
import { View } from 'react-native';
import { LockIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';
import type { PlanView } from '../model/planView';
import { percentOf } from '../model/planView';
import { BAR_HEIGHT, LOCK_BADGE, LOCK_MIN, LOCK_SHARE, RING_DEBT } from './palette';
import { styles } from './styles';

/**
 * The budget as one bar: planned / outside the plan / the funds / savings; the locked part dark with its 🔒 over it, what
 * the overspend took of the savings red between the leftover and it.
 */
export default function BudgetBar({ p }: { p: PlanView }) {
  // where the locked part sits in the bar: its 🔒 is drawn over it, taller than the bar
  const [lockBox, setLockBox] = useState<{ x: number; width: number } | null>(null);
  const { locked, free, timing, less } = p;
  // what the overspend took of the savings: red between 💰 and 🔒, out of both
  const freeNow = less ? less.free.now : free ?? 0;
  const lockedNow = less ? less.locked.now : locked;
  const eaten = less ? less.was - less.now : 0;
  const lockedPart = <View style={[styles.lockedPart, { flex: lockedNow }]} onLayout={(e) => setLockBox({ x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width })} />;
  const size = lockBox ? Math.round(Math.min(LOCK_BADGE, lockBox.width * LOCK_SHARE)) : 0;
  return (
    <View style={styles.barBox}>
      <View style={styles.bar} accessibilityLabel={`Запланировано ${percentOf(p.total, p.shownBudget!) || '0%'} бюджета`}>
        {/* the savings part: the leftover light, the locked part dark, its 🔒 drawn over it below */}
        {p.parts.filter((x) => x.key !== 'locked').map((x) => (x.key === 'free' && timing !== 'past' ? (
          <React.Fragment key={x.key}>
            {freeNow > 0 ? <View style={{ flex: freeNow, backgroundColor: x.color }} /> : null}
            {eaten > 0 ? <View style={{ flex: eaten, backgroundColor: RING_DEBT }} accessibilityLabel="Перерасход съел сбережения" /> : null}
            {lockedNow > 0 ? lockedPart : null}
          </React.Fragment>
        ) : x.value > 0 ? <View key={x.key} style={{ flex: x.value, backgroundColor: x.color }} /> : null))}
      </View>
      {/* the 🔒 in the middle of the locked part: 60% of that part's width, up to twice the bar's height (sticking out above
          and below); too narrow a part has none — its dark color says it */}
      {lockedNow > 0 && lockBox && lockBox.width * LOCK_SHARE >= LOCK_MIN ? (
        <View pointerEvents="none" style={[styles.lockBadgeBox, { left: lockBox.x, width: lockBox.width, top: (BAR_HEIGHT - size) / 2, height: size }]}>
          <View style={[styles.lockBadge, { width: size, height: size, borderRadius: size / 2, borderWidth: size >= 20 ? 2 : 1 }]}>
            {/* the lock about two thirds of the circle: "size − 10" left a dot in a small one */}
            <LockIcon color={colors.onAccent} size={Math.round(size * 0.65)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}
