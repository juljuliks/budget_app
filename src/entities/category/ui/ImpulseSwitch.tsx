import React, { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { getCategory, isSystemCategory, isTransferCategory } from '@/db/categories';
import SwitchRow from '@/shared/ui/SwitchRow';
import { switchImpulse } from '../model/commands';
import { IMPULSE_HINT_OFF, IMPULSE_HINT_ON, IMPULSE_SWITCH } from '../texts';

/**
 * A category's page: "Импульсивные покупки" — its operations ask "Обдуманная" / "Импульсивная"; not for a system or a
 * transfer category (no purchases there).
 */
export default function ImpulseSwitch({ categoryId }: { categoryId: number }) {
  // null — not shown
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    getCategory(categoryId)
      .then((c) => setOn(!c || isSystemCategory(c) || isTransferCategory(c) ? null : !!c.impulse))
      .catch((e) => console.error('load category failed', e));
  }, [categoryId]);
  if (on === null) return null;
  const change = (v: boolean) => {
    setOn(v);
    switchImpulse(categoryId, v).catch((e) => { setOn(!v); console.error('impulse switch failed', e); });
  };
  return <SwitchRow label={IMPULSE_SWITCH} hint={on ? IMPULSE_HINT_ON : IMPULSE_HINT_OFF} on={on} onChange={change} style={styles.row} />;
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 0, marginTop: 16 },
});
