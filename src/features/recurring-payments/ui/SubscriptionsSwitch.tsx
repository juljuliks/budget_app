import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Category, getCategory, isSystemCategory, isTransferCategory } from '@/db/categories';
import SwitchRow from '@/shared/ui/SwitchRow';
import { switchSubscriptions } from '../model/subscriptionsSwitch';

const HINT_ON = 'Каждый мерчант категории — отдельная подписка: сумма, как часто, следующее списание. План категории считается из них.';
const HINT_OFF = 'Следить за списаниями мерчантов, как у Netflix или страховки: подписка делается из операции.';

/** A category's page: "Подписки" (not for a system or a transfer one) — its merchants' subscriptions followed by their charges. */
export default function SubscriptionsSwitch({ categoryId }: { categoryId: number }) {
  const [c, setC] = useState<Category | null>(null);
  const load = useCallback(() => { getCategory(categoryId).then((x) => setC(x ?? null)).catch((e) => console.error('load category failed', e)); }, [categoryId]);
  useEffect(load, [load]);
  if (!c || isSystemCategory(c) || isTransferCategory(c)) return null;
  const on = !!c.by_merchant;
  return (
    <SwitchRow
      label="Подписки" hint={on ? HINT_ON : HINT_OFF} on={on} style={styles.row}
      onChange={(v) => { switchSubscriptions(categoryId, v, load).catch((e) => console.error('subscriptions switch failed', e)); }}
    />
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 0, marginTop: 16 },
});
