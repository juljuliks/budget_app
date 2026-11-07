import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { getCategory, isSystemCategory, isTransferCategory } from '@/db/categories';
import { getFund } from '@/db/plans';
import { onTransactionsChanged } from '@/domain/events';
import SwitchRow from '@/shared/ui/SwitchRow';
import { switchImpulse } from '../model/commands';
import { IMPULSE_HINT_OFF, IMPULSE_HINT_ON, IMPULSE_NO_FUND, IMPULSE_SWITCH } from '../texts';

/**
 * A category's page: "Импульсивные покупки" — its operations ask "Обдуманная" / "Импульсивная"; not for a system or a
 * transfer category (no purchases there).
 */
export default function ImpulseSwitch({ categoryId }: { categoryId: number }) {
  // null — not shown
  const [on, setOn] = useState<boolean | null>(null);
  // a fund's purchases are planned: not asked while it has one
  const [fund, setFund] = useState(false);
  const load = useCallback(() => {
    Promise.all([getCategory(categoryId), getFund(categoryId)])
      .then(([c, f]) => { setOn(!c || isSystemCategory(c) || isTransferCategory(c) ? null : !!c.impulse); setFund(!!f && !f.closed_ym); })
      .catch((e) => console.error('load category failed', e));
  }, [categoryId]);
  useEffect(() => { load(); return onTransactionsChanged(load); }, [load]);
  if (on === null) return null;
  const change = (v: boolean) => {
    setOn(v);
    switchImpulse(categoryId, v).catch((e) => { setOn(!v); console.error('impulse switch failed', e); });
  };
  if (fund) return <SwitchRow label={IMPULSE_SWITCH} hint={IMPULSE_NO_FUND} on={false} onChange={() => {}} disabled style={styles.row} />;
  return <SwitchRow label={IMPULSE_SWITCH} hint={on ? IMPULSE_HINT_ON : IMPULSE_HINT_OFF} on={on} onChange={change} style={styles.row} />;
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 0, marginTop: 16 },
});
