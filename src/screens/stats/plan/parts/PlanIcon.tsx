import React from 'react';
import type { PlanItem } from '@/db/plans';
import { LimitIcon, OneOffIcon, RepeatIcon } from '@/shared/ui/icons';
import { colors } from '@/shared/theme/theme';

/** A plan item's kind: a limit's bars, a regular payment's 🔁 or a one-off's tag. */
export function KindIcon({ item }: { item: PlanItem }) {
  return (
    <>
      {item.every ? (
        <RepeatIcon color={colors.accent} size={20} />
      ) : item.kind === 'fixed' ? (
        <OneOffIcon color={colors.muted} />
      ) : (
        <LimitIcon color={colors.muted} />
      )}
    </>
  );
}
